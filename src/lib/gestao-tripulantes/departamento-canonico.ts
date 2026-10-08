import { supabaseAdmin } from '@/lib/supabase';
import { formatDepartamentoLabel } from '@/lib/gestao-tripulantes/departamento-label';

/**
 * Departamento é seleção estrita: com `departamento_id` o rótulo `departamento` vem sempre de
 * `gt_departamentos` (nunca do cliente). Texto legado sem id só tem código repetido colapsado.
 */
export async function aplicarDepartamentoCanonico(
  data: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = typeof data.departamento_id === 'string' ? data.departamento_id.trim() : '';
  if (id) {
    const { data: row, error } = await supabaseAdmin
      .from('gt_departamentos')
      .select('nome, codigo')
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: 'Erro ao validar departamento' };
    if (!row) return { ok: false, error: 'Departamento inválido: escolha um da lista' };
    data.departamento = formatDepartamentoLabel(row);
  } else if (typeof data.departamento === 'string') {
    data.departamento = formatDepartamentoLabel({ nome: data.departamento }) || null;
  }
  return { ok: true };
}
