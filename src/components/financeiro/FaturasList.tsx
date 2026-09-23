'use client';

/**
 * FaturasList (§7.1): tabela (nº, cliente, competência, moeda, total, status),
 * filtros empresa/status, botão Nova fatura (FaturaWizard) e ações por linha:
 * Visualizar (FaturaViewer), Emitir, NFS-e (aba com fatura pré-selecionada),
 * Cobrança (CobrancaModal), Cancelar.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  FiPlus, FiEye, FiSend, FiFilePlus, FiCreditCard, FiChevronDown, FiChevronUp, FiXCircle, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import {
  cancelarFatura, emitirFatura, listClientes, listContasBancarias, listFaturas,
} from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinCliente, FinContaBancaria, FinFatura, FinFaturaStatus } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  FaturaStatusChip,
  formatarData,
  formatarMoeda,
  mensagemErro,
  useOrigemLabel,
} from '@/components/financeiro/shared';
import CobrancaModal from '@/components/financeiro/CobrancaModal';
import FaturaViewer from '@/components/financeiro/FaturaViewer';
import FaturaWizard from '@/components/financeiro/FaturaWizard';

const STATUS_FILTRO: Array<FinFaturaStatus | ''> = ['', 'rascunho', 'emitida', 'nfse_emitida', 'paga', 'cancelada'];

/** Status → chave §8 (statusRascunho/statusEmitida/statusNfseEmitida/statusPaga/statusCancelada). */
const STATUS_FILTRO_LABEL_KEY: Record<FinFaturaStatus, string> = {
  rascunho: 'financeiro.statusRascunho',
  emitida: 'financeiro.statusEmitida',
  nfse_emitida: 'financeiro.statusNfseEmitida',
  paga: 'financeiro.statusPaga',
  cancelada: 'financeiro.statusCancelada',
};

interface EmpresaOpcao {
  id: string;
  name: string;
}

export default function FaturasList() {
  const { t } = useI18n();
  const labelOrigem = useOrigemLabel();
  const router = useRouter();
  const pathname = usePathname() || '/folha-pagamento';

  const [faturas, setFaturas] = useState<FinFatura[]>([]);
  const [clientes, setClientes] = useState<FinCliente[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [contas, setContas] = useState<FinContaBancaria[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<FinFaturaStatus | ''>('');
  const [carregando, setCarregando] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [wizardAberto, setWizardAberto] = useState(false);
  const [viewer, setViewer] = useState<FinFatura | null>(null);
  const [cobranca, setCobranca] = useState<FinFatura | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await listFaturas({
        empresaId: empresaFiltro || undefined,
        status: statusFiltro || undefined,
      });
      setFaturas(lista);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  }, [empresaFiltro, statusFiltro, t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithToken('/api/payroll/companies?limit=100');
        if (res.ok) {
          const body = await res.json();
          setEmpresas(((body?.data ?? []) as Array<{ id: string; name?: string }>).map((e) => ({ id: e.id, name: e.name || e.id })));
        }
      } catch {
        /* filtro de empresa fica vazio */
      }
      listClientes({ limit: 200 }).then(setClientes).catch(() => undefined);
      listContasBancarias().then(setContas).catch(() => undefined);
    })();
  }, []);

  function nomeCliente(fatura: FinFatura): string {
    if (fatura.cliente?.nome) return fatura.cliente.nome;
    const snap = fatura.cliente_snapshot as { nome?: string } | null | undefined;
    if (snap?.nome) return snap.nome;
    return clientes.find((c) => c.id === fatura.cliente_id)?.nome ?? '—';
  }

  const competenciaLabel = useMemo(
    () =>
      (f: FinFatura) =>
        f.competencia_mes && f.competencia_ano
          ? `${String(f.competencia_mes).padStart(2, '0')}/${f.competencia_ano}`
          : '—',
    [],
  );

  async function emitir(fatura: FinFatura) {
    if (!window.confirm(t('financeiro.emitirConfirmar'))) return;
    try {
      const emitida = await emitirFatura(fatura.id);
      toast.success(t('financeiro.faturaEmitida'));
      setFaturas((atual) => atual.map((f) => (f.id === emitida.id ? emitida : f)));
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    }
  }

  async function cancelar(fatura: FinFatura) {
    if (!window.confirm(t('financeiro.cancelarFaturaConfirmar'))) return;
    try {
      await cancelarFatura(fatura.id);
      toast.success(t('financeiro.faturaCancelada'));
      carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    }
  }

  function abrirNfse(fatura: FinFatura) {
    router.push(`${pathname}?tab=nfse&faturaId=${fatura.id}`, { scroll: false });
  }

  return (
    <div className={`${FIN_CARD_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4">
        <div className="min-w-44">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.empresa')}</label>
          <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)} className={FIN_INPUT_CLASS}>
            <option value="">{t('financeiro.todasEmpresas')}</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-36">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.status')}</label>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as FinFaturaStatus | '')}
            className={FIN_INPUT_CLASS}
          >
            {STATUS_FILTRO.map((s) => (
              <option key={s || 'todas'} value={s}>
                {s ? t(STATUS_FILTRO_LABEL_KEY[s]) : t('financeiro.todosStatus')}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={carregar} className={FIN_BTN_SECONDARY_CLASS} disabled={carregando}>
            <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            {t('financeiro.recarregar')}
          </button>
          <button type="button" onClick={() => setWizardAberto(true)} className={FIN_BTN_PRIMARY_CLASS}>
            <FiPlus className="h-4 w-4" /> {t('financeiro.novaFatura')}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.numero')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.cliente')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.competencia')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.moeda')}</th>
              <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.total')}</th>
              <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.status')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {faturas.map((fatura) => (
              <React.Fragment key={fatura.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {fatura.numero}/{fatura.ano}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{nomeCliente(fatura)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{competenciaLabel(fatura)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{fatura.moeda}</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatarMoeda(fatura.valor_total, fatura.moeda)}
                  </td>
                  <td className="px-4 py-2">
                    <FaturaStatusChip status={fatura.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setExpandida((atual) => (atual === fatura.id ? null : fatura.id))}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                      aria-label={t('financeiro.acoes')}
                    >
                      {expandida === fatura.id ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
                {expandida === fatura.id && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50/70 px-4 py-3 dark:bg-gray-800/70">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-2 text-xs font-bold uppercase text-gray-400">{labelOrigem(fatura.origem_tipo)}</span>
                        <button type="button" onClick={() => setViewer(fatura)} className={FIN_BTN_SECONDARY_CLASS}>
                          <FiEye className="h-4 w-4" /> {t('financeiro.visualizar')}
                        </button>
                        {fatura.status === 'rascunho' && (
                          <button type="button" onClick={() => emitir(fatura)} className={FIN_BTN_SECONDARY_CLASS}>
                            <FiSend className="h-4 w-4" /> {t('financeiro.emitir')}
                          </button>
                        )}
                        {(fatura.status === 'emitida' || fatura.status === 'nfse_emitida') && (
                          <>
                            <button type="button" onClick={() => abrirNfse(fatura)} className={FIN_BTN_SECONDARY_CLASS}>
                              <FiFilePlus className="h-4 w-4" /> {t('financeiro.nfseEmissaoNova')}
                            </button>
                            <button type="button" onClick={() => setCobranca(fatura)} className={FIN_BTN_SECONDARY_CLASS}>
                              <FiCreditCard className="h-4 w-4" /> {t('financeiro.cobrar')}
                            </button>
                          </>
                        )}
                        {(fatura.status === 'rascunho' || fatura.status === 'emitida') && (
                          <button
                            type="button"
                            onClick={() => cancelar(fatura)}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                          >
                            <FiXCircle className="h-4 w-4" /> {t('financeiro.cancelar')}
                          </button>
                        )}
                        <span className="ml-auto text-xs text-gray-400">
                          {t('financeiro.vencimento')}: {formatarData(fatura.data_vencimento)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!carregando && faturas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  {t('financeiro.nenhumaFatura')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {wizardAberto && (
        <FaturaWizard
          onClose={() => setWizardAberto(false)}
          onCriada={() => {
            setWizardAberto(false);
            carregar();
          }}
        />
      )}
      {viewer && (
        <FaturaViewer
          fatura={viewer}
          onClose={() => setViewer(null)}
          onEmitida={(emitida) => setFaturas((atual) => atual.map((f) => (f.id === emitida.id ? emitida : f)))}
        />
      )}
      {cobranca && <CobrancaModal fatura={cobranca} contas={contas} onClose={() => setCobranca(null)} />}
    </div>
  );
}
