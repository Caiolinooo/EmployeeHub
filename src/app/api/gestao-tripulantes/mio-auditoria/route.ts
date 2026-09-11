import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { mioClient } from '@/lib/mio/client';
import { runMioPull } from '@/lib/mio/pull-context';

export const dynamic = 'force-dynamic';

/**
 * Auditoria da sincronização MIO → portal (Gestão de Tripulantes).
 *
 * GET /api/gestao-tripulantes/mio-auditoria
 *  → {
 *      mio:            { total_integrantes } (leitura read-only da API do MIO),
 *      portal:         { total, ativos, inativos (origem='mio'), treinamentos, embarques },
 *      ultima_execucao:{ resultado persistido em gt_configuracoes chave
 *                        'mio_sync_ultimo_resultado': criados/atualizados/
 *                        ignorados/erros por módulo }
 *    }
 */
export async function GET(request: NextRequest) {
  try {
    // Auth: token admin/manager OU cron secret (mesmo padrão do cron/sync-mio).
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    const decoded = token ? verifyToken(token) : null;
    const isVercelCron =
      request.headers.get('x-vercel-cron-secret') === process.env.CRON_SECRET;
    const isAdminOrManager =
      !!decoded && (decoded.role === 'ADMIN' || decoded.role === 'MANAGER');
    const isLocalDevelopment = process.env.NODE_ENV === 'development';

    if (!isAdminOrManager && !isVercelCron && !isLocalDevelopment) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Totais no portal (linhas origem='mio', não deletadas).
    const [totalPortal, ativosPortal, inativosPortal, trePortal, embPortal] =
      await Promise.all([
        supabaseAdmin
          .from('gt_colaboradores')
          .select('id', { count: 'exact', head: true })
          .eq('origem', 'mio')
          .is('deleted_at', null),
        supabaseAdmin
          .from('gt_colaboradores')
          .select('id', { count: 'exact', head: true })
          .eq('origem', 'mio')
          .eq('ativo', true)
          .is('deleted_at', null),
        supabaseAdmin
          .from('gt_colaboradores')
          .select('id', { count: 'exact', head: true })
          .eq('origem', 'mio')
          .eq('ativo', false)
          .is('deleted_at', null),
        supabaseAdmin
          .from('gt_documentos')
          .select('id', { count: 'exact', head: true })
          .eq('origem', 'mio')
          .is('deleted_at', null),
        supabaseAdmin
          .from('gt_historico_embarques')
          .select('id', { count: 'exact', head: true })
          .eq('origem', 'mio'),
      ]);

    // Total no MIO (leitura read-only; falha não derruba a auditoria).
    let totalMio: number | null = null;
    let erroMio: string | null = null;
    try {
      const integrantes = await runMioPull(() => mioClient.getIntegrantes());
      totalMio = Array.isArray(integrantes) ? integrantes.length : null;
    } catch (e: any) {
      erroMio = e?.message || String(e);
    }

    // Última execução persistida.
    const { data: cfgRow } = await supabaseAdmin
      .from('gt_configuracoes')
      .select('valor, updated_at')
      .eq('chave', 'mio_sync_ultimo_resultado')
      .maybeSingle();

    return NextResponse.json({
      success: true,
      mio: {
        total_integrantes: totalMio,
        erro: erroMio,
      },
      portal: {
        colaboradores_mio: totalPortal.count ?? 0,
        ativos: ativosPortal.count ?? 0,
        inativos: inativosPortal.count ?? 0,
        documentos_treinamentos_mio: trePortal.count ?? 0,
        embarques_mio: embPortal.count ?? 0,
      },
      diferenca:
        totalMio != null
          ? (totalMio ?? 0) - (totalPortal.count ?? 0)
          : null,
      ultima_execucao: cfgRow?.valor
        ? { ...cfgRow.valor, persistido_em: cfgRow.updated_at }
        : null,
    });
  } catch (error: any) {
    console.error('Erro em /api/gestao-tripulantes/mio-auditoria:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
