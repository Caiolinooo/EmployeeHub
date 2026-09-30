import { supabaseAdmin } from '@/lib/supabase';
import { isValidCpf, normalizeCpf } from '@/lib/utils/identity';

export interface ProspectoRow {
  id: string;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  telefone_2: string | null;
  status: string;
  colaborador_id: string | null;
}

export type ConversaoResultado =
  | { ok: true; colaboradorId: string; criado: boolean }
  | { ok: false; error: string; status: number };

/**
 * Um prospecto vira um colaborador. Idempotente:
 * - já convertido (colaborador_id) → devolve o mesmo id;
 * - CPF do prospecto já existe em gt_colaboradores → vincula e não duplica.
 * Sem CPF válido → 400, nunca inventa cadastro.
 */
export async function converterProspectoParaColaborador(prospectoId: string): Promise<ConversaoResultado> {
  const { data: prospecto, error: pErr } = await supabaseAdmin
    .from('rc_prospectos')
    .select('*')
    .eq('id', prospectoId)
    .maybeSingle();

  if (pErr || !prospecto) {
    return { ok: false, error: 'Prospecto não encontrado', status: 404 };
  }
  const row = prospecto as ProspectoRow;

  if (row.colaborador_id) {
    return { ok: true, colaboradorId: row.colaborador_id, criado: false };
  }

  const cpf = normalizeCpf(String(row.cpf || ''));
  if (!isValidCpf(cpf)) {
    return { ok: false, error: 'CPF do prospecto ausente ou inválido — preencha no pré-cadastro antes de converter', status: 400 };
  }

  const { data: existente } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id')
    .eq('cpf', cpf)
    .is('deleted_at', null)
    .maybeSingle();

  let colaboradorId: string;
  let criado = false;

  if (existente?.id) {
    colaboradorId = existente.id as string;
  } else {
    const { data: criadoRow, error: cErr } = await supabaseAdmin
      .from('gt_colaboradores')
      .insert({
        nome_completo: row.nome_completo,
        cpf,
        email: row.email || null,
        telefone: row.telefone || null,
        telefone_2: row.telefone_2 || null,
        origem: 'manual',
        nacionalidade: 'BRASILEIRA',
        pais_nascimento: 'Brasil',
        status_embarque: 'desembarcado',
      })
      .select('id')
      .single();

    if (cErr || !criadoRow?.id) {
      return { ok: false, error: `Falha ao criar colaborador: ${cErr?.message || 'sem id'}`, status: 500 };
    }
    colaboradorId = criadoRow.id as string;
    criado = true;
  }

  const { error: uErr } = await supabaseAdmin
    .from('rc_prospectos')
    .update({
      colaborador_id: colaboradorId,
      status: 'convertido',
      convertido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectoId)
    .is('colaborador_id', null);

  if (uErr) {
    return { ok: false, error: `Falha ao vincular prospecto: ${uErr.message}`, status: 500 };
  }

  return { ok: true, colaboradorId, criado };
}
