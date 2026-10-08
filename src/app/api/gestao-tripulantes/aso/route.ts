import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { formatCpf, isEsocialGlobalVisible, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { filtrarPorColaboradorPermitido } from '@/lib/gestao-tripulantes/empresa-acesso';
import { MENSAGEM_DOCUMENTOS_RESTRITOS } from '@/lib/gestao-tripulantes/documento-escopo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gestao-tripulantes/aso?cpf=XXXXXXXXXXX
 * Returns only ASOs with esocial_status in (enviado, processado) for global consumers.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cpfRaw = searchParams.get('cpf') || '';
    const cpf = normalizeCpf(cpfRaw);
    if (cpf.length !== 11) {
      return NextResponse.json({ error: 'Query cpf obrigatória (11 dígitos)' }, { status: 400 });
    }

    const colaborador = await findColaboradorByCpf(cpf);
    const user = { id: payload.userId, role: payload.role };
    if ((await filtrarPorColaboradorPermitido(user, [colaborador?.id], (id) => id)).length === 0) {
      return NextResponse.json({ error: MENSAGEM_DOCUMENTOS_RESTRITOS }, { status: 403 });
    }
    const cpfFormatted = formatCpf(cpf);

    let query = supabaseAdmin
      .from('gt_documentos_aso')
      .select(`
        id,
        documento_id,
        colaborador_id,
        tipo_exame,
        resultado,
        data_realizacao,
        medico_nome,
        medico_crm,
        nome_clinica,
        esocial_status,
        esocial_evento_id,
        esocial_protocolo,
        esocial_numero_recibo,
        esocial_data_envio,
        cpf_documento,
        identity_match,
        documento:gt_documentos!documento_id(
          id,
          titulo,
          data_emissao,
          data_validade,
          status_validacao,
          arquivo_url,
          ocr_status,
          deleted_at
        )
      `)
      .in('esocial_status', ['enviado', 'processado'])
      .order('data_realizacao', { ascending: false, nullsFirst: false });

    if (colaborador) {
      query = query.or(
        `colaborador_id.eq.${colaborador.id},cpf_documento.eq.${cpf},cpf_documento.eq.${cpfFormatted}`
      );
    } else {
      query = query.or(`cpf_documento.eq.${cpf},cpf_documento.eq.${cpfFormatted}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ASO global] query error:', error);
      return NextResponse.json({ error: 'Erro ao buscar ASOs' }, { status: 500 });
    }

    const rows = (data || []).filter((row) => {
      if (!isEsocialGlobalVisible(row.esocial_status)) return false;
      const doc = row.documento as { deleted_at?: string | null } | null;
      if (doc?.deleted_at) return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      cpf,
      colaborador_id: colaborador?.id || null,
      total: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('[ASO global] error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
