/**
 * Substituição de sobreposição TYPE-AWARE (fix do caso Rômulo — 2026-09-16).
 *
 * Regra do dono (memory gt-fechamento-regras-dba-fi): DBA / FI / STB / OFF-C
 * são MARCADORES, não ciclos de rotação — eles COEXISTEM com o ON. A grade já
 * resolve conflito no mesmo dia via pickOverlappingRotation (escala-contagem.ts),
 * então o banco tolerar sobreposições de tipos diferentes é de design.
 *
 * Antes (v5.76.1 overlap-replace): salvar QUALQUER evento derrubava TODAS as
 * linhas vivas sobrepostas do colaborador — um DBA 11→11 apagava o ON aberto
 * (data_desembarque NULL) de um tripulante embarcado. Isso nunca deve acontecer.
 *
 * Regras:
 * - Rotação = APENAS db tipo 'normal' (mapCodigoToDbTipo: 'normal'|'on' →
 *   'normal'; previsto/fi/dba/stb/offc/ferias/afastamento/custom guardam tipo
 *   próprio → marcadores).
 * - Evento novo de rotação substitui somente sobrepostas de rotação ('normal'
 *   substitui 'normal' — correção de ciclo preservada do v5.76.1).
 * - Evento novo marcador substitui somente sobrepostas do MESMO marcador
 *   (re-marcar o mesmo marcador o substitui). NUNCA apaga 'normal' nem
 *   qualquer outro tipo.
 * - Os dois casos colapsam numa única regra: substitui a linha cujo tipo
 *   normalizado === tipo normalizado do evento salvo.
 * - O match exato de período ("keep" do POST /embarques) acontece ANTES deste
 *   filtro, de propósito: re-marcar a MESMA faixa exata atualiza a linha in
 *   place independentemente do tipo — é uma re-marcação deliberada daquele
 *   range, não uma substituição.
 *
 * Valores legados de banco ('folga_indenizada'|'dobra'|'standby', códigos MIO
 * como 'ON'/'STB') passam por mapCodigoToDbTipo antes de comparar — a mesma
 * normalização que as rotas usam ao gravar. Tipo ausente/não-string lê como
 * 'normal' (rotação): conservador — marcador novo nunca apaga o que não sabe
 * classificar, e rotação nova preserva o comportamento antigo sobre lixo legado.
 *
 * Módulo PURO (sem Supabase/Next): testável via npx tsx --test.
 */

import { mapCodigoToDbTipo } from './escala-tipos';

/** Único db tipo que é ciclo de rotação. Todo o resto é marcador. */
export const TIPO_ROTACAO = 'normal';

/**
 * Linha de gt_historico_embarques como as rotas a manuseiam — estruturalmente
 * idêntico a EmbarqueRow (escala-audit-writer.ts), sem importar o módulo de
 * auditoria (que puxa Supabase/Next).
 */
export type EmbarqueOverlapRow = Record<string, unknown> & { id?: string };

/** Normaliza qualquer valor de tipo (código de UI, db tipo ou legado) ao db tipo canônico. */
export function normalizarTipoEscala(tipo: unknown): string {
  return mapCodigoToDbTipo(typeof tipo === 'string' ? tipo : '');
}

/** A linha é um ciclo de rotação (ON)? Marcadores (DBA/FI/STB/OFF-C/...) nunca. */
export function isTipoRotacao(tipo: unknown): boolean {
  return normalizarTipoEscala(tipo) === TIPO_ROTACAO;
}

/**
 * Filtra, dentre as sobrepostas vivas já encontradas (buscarSobrepostos — que
 * já inclui linhas abertas e é paginada), quais PODEM ser substituídas pelo
 * evento sendo salvo: apenas as do mesmo tipo normalizado. Chame DEPOIS de
 * remover a linha "keep" de range exato (mesma data_embarque +
 * data_desembarque), se ela existir — a keep nunca passa por aqui.
 *
 * - novoTipo 'normal'           → devolve só as 'normal' (rotação vence rotação).
 * - novoTipo marcador ('dba'…)  → devolve só as do mesmo marcador; ON e os
 *   demais marcadores sobrevivem intactos.
 */
export function filtrarSubstitutiveis<T extends EmbarqueOverlapRow>(
  novoTipo: string,
  rows: T[] | null | undefined,
): T[] {
  const alvo = normalizarTipoEscala(novoTipo);
  return (rows || []).filter((row) => normalizarTipoEscala(row?.tipo) === alvo);
}
