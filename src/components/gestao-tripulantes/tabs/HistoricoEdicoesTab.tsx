'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { isFechamentoRole } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import FilaRevisaoEscala from '@/components/gestao-tripulantes/fechamento/FilaRevisaoEscala';

/**
 * Aba GLOBAL "Histórico de alterações" (fora do workspace do fechamento):
 * mesma trilha `gt_escala_edicoes` da Fila de Revisão, mas visível para quem
 * já vê a página GT — Reverter/Rejeitar continua gated por `isFechamentoRole`
 * (client pre-gate; o servidor reforça), igual à FilaRevisaoEscala e à
 * HistoricoEmbarquesTab. Status default = todos (é histórico, não fila de
 * trabalho) e o filtro ganha operação + período de/até.
 */
export default function HistoricoEdicoesTab() {
  const { t } = useI18n();
  const { profile } = useSupabaseAuth();
  // Mesmo critério da FilaRevisaoEscala / HistoricoEmbarquesTab (o servidor reforça).
  const podeRevisar = isFechamentoRole(profile?.role);

  return (
    <FilaRevisaoEscala
      podeRevisar={podeRevisar}
      mostrarSemPermissao
      statusInicial=""
      titulo={t('gtFechV2.historicoGlobal.titulo', 'Histórico Global de Alterações de Escala')}
      descricao={t(
        'gtFechV2.historicoGlobal.descricao',
        'Todas as edições de escala do portal — qualquer embarcação e colaborador. Reverter/Rejeitar é exclusivo de gestores de fechamento.',
      )}
    />
  );
}
