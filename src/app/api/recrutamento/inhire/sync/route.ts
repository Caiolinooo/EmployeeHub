import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeNivelRecrutamento } from '@/lib/recrutamento/recrutamento-auth';
import { carregarCredenciaisInhire, inhireFetch } from '@/lib/recrutamento/inhire-client';

export const dynamic = 'force-dynamic';

function texto(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/**
 * Pull de vagas e candidatos do Inhire para rc_vagas / rc_prospectos.
 * Falha de credencial/auth NÃO derruba o painel: devolve 200 com warning.
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const pode = await podeNivelRecrutamento(payload.userId, payload.role, 'manage');
    if (!pode) return NextResponse.json({ error: 'Sem permissão para sincronizar Inhire' }, { status: 403 });

    const cred = await carregarCredenciaisInhire();
    if (!cred) {
      return NextResponse.json({
        success: false,
        warning: 'Credenciais Inhire não configuradas. Salve inhire_email, inhire_password, inhire_tenant em app_secrets.',
      });
    }

    let vagasResp: unknown;
    try {
      vagasResp = await inhireFetch('/v1/jobs');
    } catch (err) {
      return NextResponse.json({
        success: false,
        warning: err instanceof Error ? err.message : 'Falha ao consultar vagas do Inhire',
      });
    }

    const vagas = Array.isArray(vagasResp) ? vagasResp : ((vagasResp as { data?: unknown[] })?.data || []);
    let vagasImportadas = 0;
    let candidatosImportados = 0;

    for (const v of vagas) {
      const job = v as Record<string, unknown>;
      const inhireId = texto(job.id || job.job_id);
      const titulo = texto(job.title || job.titulo || job.name) || 'Vaga Inhire';
      if (!inhireId) continue;

      const { data: vaga, error } = await supabaseAdmin
        .from('rc_vagas')
        .upsert({
          inhire_id: inhireId,
          titulo,
          descricao: texto(job.description || job.descricao) || null,
          empresa: texto(job.company || job.empresa) || null,
          status: 'aberta',
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'inhire_id' })
        .select('id')
        .single();

      if (error || !vaga?.id) continue;
      vagasImportadas += 1;

      let candidatos: unknown[] = [];
      try {
        const resp = await inhireFetch(`/v1/jobs/${inhireId}/candidates`);
        candidatos = Array.isArray(resp) ? resp : (((resp as { data?: unknown[] })?.data) || []);
      } catch {
        candidatos = [];
      }

      for (const c of candidatos) {
        const cand = c as Record<string, unknown>;
        const inhireCandId = texto(cand.id || cand.candidate_id);
        const nome = texto(cand.name || cand.nome_completo || cand.full_name);
        if (!inhireCandId || !nome) continue;
        const cpf = texto(cand.cpf || cand.document).replace(/\D/g, '') || null;

        const { error: pErr } = await supabaseAdmin
          .from('rc_prospectos')
          .upsert({
            vaga_id: vaga.id,
            inhire_candidato_id: inhireCandId,
            nome_completo: nome,
            cpf,
            email: texto(cand.email) || null,
            telefone: texto(cand.phone || cand.telefone) || null,
            dados: cand,
            status: 'prospecto',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'inhire_candidato_id' });

        if (!pErr) candidatosImportados += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: { vagas: vagasImportadas, prospectos: candidatosImportados },
    });
  } catch (error) {
    console.error('Erro no sync Inhire:', error);
    return NextResponse.json({
      success: false,
      warning: error instanceof Error ? error.message : 'Erro interno no sync Inhire',
    });
  }
}
