/**
 * Sincronização best-effort das datas de escala em gt_colaboradores a partir dos
 * eventos vivos de gt_historico_embarques (fonte canônica). Follow-up documentado
 * no CLAUDE.md: o pull MIO — único escritor dessas colunas — foi desligado na
 * v5.77.0; após qualquer save/exclusão local o portal recalcula.
 * Erro aqui NUNCA falha a requisição original: console.error e segue.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { derivarDatasEscala, type EventoEscalaDatasLike } from './embarques-datas';

export async function sincronizarDatasEscalaColaborador(
  colaboradorId: string | null | undefined,
): Promise<void> {
  if (!colaboradorId) return;
  try {
    const { data, error } = await supabaseAdmin
      .from('gt_historico_embarques')
      .select('data_embarque, data_desembarque')
      .eq('colaborador_id', colaboradorId)
      .is('deleted_at', null);

    if (error) {
      console.error('[sync-datas-escala] Erro ao carregar eventos vivos:', error.message);
      return;
    }

    const datas = derivarDatasEscala((data || []) as EventoEscalaDatasLike[]);
    const { error: updErr } = await supabaseAdmin
      .from('gt_colaboradores')
      .update({
        data_ultimo_embarque: datas.data_ultimo_embarque,
        data_ultimo_desembarque: datas.data_ultimo_desembarque,
        data_proximo_embarque: datas.data_proximo_embarque,
        updated_at: new Date().toISOString(),
      })
      .eq('id', colaboradorId);

    if (updErr) {
      console.error('[sync-datas-escala] Erro ao atualizar datas em gt_colaboradores:', updErr.message);
    }
  } catch (err) {
    console.error('[sync-datas-escala] Falha inesperada ao sincronizar datas de escala:', err);
  }
}
