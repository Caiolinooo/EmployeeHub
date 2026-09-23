'use client';

/**
 * Peças compartilhadas da UI financeira (§7): cards, chips de status e
 * formatadores. Todos os textos via useI18n (chaves §8 + extras em financeiro.*).
 */
import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import toast from 'react-hot-toast';
import type {
  FinFaturaStatus,
  FinNfseStatus,
  FinCobrancaStatus,
  FinPagamentoStatus,
  FinConciliacaoStatus,
  FinIntegracaoStatus,
} from '@/types/financeiro';

export const FIN_CARD_CLASS =
  'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm';

export const FIN_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-abz-blue focus:border-abz-blue outline-none';

export const FIN_BTN_PRIMARY_CLASS =
  'inline-flex items-center gap-2 rounded-lg bg-abz-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-abz-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition';

export const FIN_BTN_SECONDARY_CLASS =
  'inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition';

type ChipTone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet';

const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  red: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
};

export function FinChip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CHIP_TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

/** Rótulo + tom por entidade — mapa de contrato (status do banco → i18n §8). */
const FATURA_STATUS_META: Record<FinFaturaStatus, { key: string; tone: ChipTone }> = {
  rascunho: { key: 'financeiro.statusRascunho', tone: 'gray' },
  emitida: { key: 'financeiro.statusEmitida', tone: 'blue' },
  nfse_emitida: { key: 'financeiro.statusNfseEmitida', tone: 'violet' },
  paga: { key: 'financeiro.statusPaga', tone: 'green' },
  cancelada: { key: 'financeiro.statusCancelada', tone: 'red' },
};

const NFSE_STATUS_META: Record<FinNfseStatus, { key: string; tone: ChipTone }> = {
  rps_gerado: { key: 'financeiro.nfseStatusRpsGerado', tone: 'gray' },
  enviado: { key: 'financeiro.nfseStatusEnviado', tone: 'blue' },
  autorizado: { key: 'financeiro.nfseAutorizado', tone: 'green' },
  rejeitado: { key: 'financeiro.nfseRejeitado', tone: 'red' },
  cancelado: { key: 'financeiro.nfseStatusCancelado', tone: 'gray' },
};

const COBRANCA_STATUS_META: Record<FinCobrancaStatus, { key: string; tone: ChipTone }> = {
  pendente: { key: 'financeiro.cobrancaPendente', tone: 'gray' },
  gerada: { key: 'financeiro.cobrancaGerada', tone: 'blue' },
  liquidada: { key: 'financeiro.cobrancaLiquidada', tone: 'green' },
  expirada: { key: 'financeiro.cobrancaExpirada', tone: 'amber' },
  cancelada: { key: 'financeiro.cobrancaCancelada', tone: 'red' },
};

const PAGAMENTO_STATUS_META: Record<FinPagamentoStatus, { key: string; tone: ChipTone }> = {
  pendente: { key: 'financeiro.pagamentoPendente', tone: 'gray' },
  enviado: { key: 'financeiro.pagamentoEnviado', tone: 'blue' },
  processado: { key: 'financeiro.pagamentoProcessado', tone: 'green' },
  rejeitado: { key: 'financeiro.pagamentoRejeitado', tone: 'red' },
  cancelado: { key: 'financeiro.pagamentoCancelado', tone: 'gray' },
};

const CONCILIACAO_STATUS_META: Record<FinConciliacaoStatus, { key: string; tone: ChipTone }> = {
  nao_conciliado: { key: 'financeiro.statusNaoConciliado', tone: 'amber' },
  conciliado: { key: 'financeiro.statusConciliado', tone: 'green' },
  ignorado: { key: 'financeiro.statusIgnorado', tone: 'gray' },
};

const INTEGRACAO_STATUS_META: Record<FinIntegracaoStatus, { key: string; tone: ChipTone }> = {
  configurando: { key: 'financeiro.integracaoStatusConfigurando', tone: 'amber' },
  ativa: { key: 'financeiro.integracaoStatusAtiva', tone: 'green' },
  erro: { key: 'financeiro.integracaoStatusErro', tone: 'red' },
  desativada: { key: 'financeiro.integracaoStatusDesativada', tone: 'gray' },
};

export function FaturaStatusChip({ status }: { status: FinFaturaStatus }) {
  const { t } = useI18n();
  const meta = FATURA_STATUS_META[status] ?? FATURA_STATUS_META.rascunho;
  return <FinChip tone={meta.tone}>{t(meta.key)}</FinChip>;
}

export function NfseStatusChip({ status }: { status: FinNfseStatus }) {
  const { t } = useI18n();
  const meta = NFSE_STATUS_META[status] ?? NFSE_STATUS_META.rps_gerado;
  return <FinChip tone={meta.tone}>{t(meta.key)}</FinChip>;
}

export function CobrancaStatusChip({ status }: { status: FinCobrancaStatus }) {
  const { t } = useI18n();
  const meta = COBRANCA_STATUS_META[status] ?? COBRANCA_STATUS_META.pendente;
  return <FinChip tone={meta.tone}>{t(meta.key)}</FinChip>;
}

export function PagamentoStatusChip({ status }: { status: FinPagamentoStatus }) {
  const { t } = useI18n();
  const meta = PAGAMENTO_STATUS_META[status] ?? PAGAMENTO_STATUS_META.pendente;
  return <FinChip tone={meta.tone}>{t(meta.key)}</FinChip>;
}

export function ConciliacaoStatusChip({ status }: { status: FinConciliacaoStatus }) {
  const { t } = useI18n();
  const meta = CONCILIACAO_STATUS_META[status] ?? CONCILIACAO_STATUS_META.nao_conciliado;
  return <FinChip tone={meta.tone}>{t(meta.key)}</FinChip>;
}

export function IntegracaoStatusChip({ status }: { status: FinIntegracaoStatus }) {
  const { t } = useI18n();
  const meta = INTEGRACAO_STATUS_META[status] ?? INTEGRACAO_STATUS_META.configurando;
  return <FinChip tone={meta.tone}>{t(meta.key)}</FinChip>;
}

/** Rótulo de status de folha (payroll_sheets) para KPIs/combos. */
export function useFolhaStatusLabel() {
  const { t } = useI18n();
  const map: Record<string, string> = {
    draft: t('financeiro.folhaStatusDraft'),
    calculated: t('financeiro.folhaStatusCalculada'),
    approved: t('financeiro.folhaStatusAprovada'),
    paid: t('financeiro.folhaStatusPaga'),
    cancelled: t('financeiro.folhaStatusCancelada'),
  };
  return (status: string) => map[status] ?? status;
}

/** Origem da fatura → rótulo §8 (origemFolha/origemMedicao/origemManual). */
export function useOrigemLabel() {
  const { t } = useI18n();
  const map: Record<string, string> = {
    folha: t('financeiro.origemFolha'),
    medicao: t('financeiro.origemMedicao'),
    manual: t('financeiro.origemManual'),
  };
  return (origem: string) => map[origem] ?? origem;
}

/** dd/mm/aaaa a partir de YYYY-MM-DD (sem depender de timezone). */
export function formatarData(valor?: string | null): string {
  if (!valor) return '—';
  const soData = valor.slice(0, 10);
  const [ano, mes, dia] = soData.split('-');
  if (!ano || !mes || !dia) return soData;
  return `${dia}/${mes}/${ano}`;
}

export function formatarMoeda(valor: number, moeda = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(valor ?? 0);
  } catch {
    return `${moeda} ${(valor ?? 0).toFixed(2)}`;
  }
}

/** Copia texto para a área de transferência com toast de confirmação (linha digitável/QR/XML). */
export async function copiarTexto(texto: string, mensagem: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(mensagem);
  } catch {
    toast.error(mensagem);
  }
}

/** Download de conteúdo textual (XMLs da NFS-e). */
export function baixarTexto(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Mensagem de erro amigável para toasts (FinanceiroApiError | genérico). */
export function mensagemErro(erro: unknown, fallback: string): string {
  if (erro instanceof Error && erro.message) return erro.message;
  return fallback;
}
