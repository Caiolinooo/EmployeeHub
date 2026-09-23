/**
 * Trilha de eventos financeiros — tabela fin_eventos (§2.1/§5.2).
 * Gravação BEST-EFFORT (padrão audit-writer do repo): falha de trilha NUNCA
 * derruba a operação de negócio que a gerou. Retorna o id do evento ou null.
 *
 * ator: dados do JWT do portal (garantirNivelFinanceiro) ou 'system' para
 * rotinas automáticas (cron/importação).
 */
import { supabaseAdmin } from '@/lib/supabase';
import type { FinEventoEntidade } from '@/types/financeiro';

export interface EventoAtor {
  userId?: string | null;
  nome?: string | null;
}

export interface EventoInput {
  entidade: FinEventoEntidade;
  entidadeId?: string | null;
  tipo: string; // ex: fatura.emitida, nfse.autorizada, cobranca.liquidada
  payload?: Record<string, unknown> | null;
  ator?: EventoAtor | null;
}

const ATOR_SYSTEM: EventoAtor = { userId: null, nome: 'system' };

/** Nome de exibição do ator (padrão GT: first_name+last_name → name → fallback). */
export async function carregarNomeAtor(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabaseAdmin
      .from('users_unified')
      .select('first_name, last_name, name, email')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return null;
    const row = data as { first_name?: string; last_name?: string; name?: string; email?: string };
    const composto = `${row.first_name || ''} ${row.last_name || ''}`.trim();
    return composto || (row.name || '').trim() || (row.email || '').trim() || null;
  } catch {
    return null;
  }
}

/** Monta o ator completo (id + nome) para eventos a partir do userId do gate. */
export async function atorDeUserId(userId: string | null | undefined): Promise<EventoAtor> {
  if (!userId) return ATOR_SYSTEM;
  const nome = await carregarNomeAtor(userId);
  return { userId, nome: nome || 'Usuário' };
}

export async function registrarEvento(input: EventoInput): Promise<string | null> {
  try {
    const ator = input.ator?.userId || input.ator?.nome ? input.ator : ATOR_SYSTEM;
    const { data, error } = await supabaseAdmin
      .from('fin_eventos')
      .insert({
        entidade: input.entidade,
        entidade_id: input.entidadeId ?? null,
        tipo: input.tipo,
        payload: input.payload ?? {},
        ator_id: ator?.userId ?? null,
        ator_nome: ator?.nome ?? ATOR_SYSTEM.nome,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[financeiro] falha ao gravar fin_eventos (best-effort):', error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.error('[financeiro] falha ao gravar fin_eventos (best-effort):', err);
    return null;
  }
}
