'use client';

/**
 * Painel da competência: 4 cards, barras de movimento e rosca de status.
 * Paleta do portal (abz-blue / abz-blue-dark). Dados de GET /api/financeiro/visao-geral.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiFilePlus, FiFileText, FiList, FiRefreshCw, FiDollarSign } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getVisaoGeral } from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinVisaoGeral } from '@/types/financeiro';
import {
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  formatarMoeda,
  useFolhaStatusLabel,
} from '@/components/financeiro/shared';
import {
  barrasCompetencia,
  fatiasStatus,
  variacaoContraMesAnterior,
  type StatusFaturaPainel,
} from '@/components/financeiro/financeiro-dashboard';

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

const COR_STATUS: Record<StatusFaturaPainel, string> = {
  rascunho: '#94a3b8',
  emitida: '#005dff',
  nfse_emitida: '#6339F5',
  paga: '#10B981',
  cancelada: '#EF4444',
};

const CHAVE_STATUS: Record<StatusFaturaPainel, string> = {
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

function VariacaoBadge({ valor, claro }: { valor: number | null; claro?: boolean }) {
  if (valor == null || !Number.isFinite(valor)) return null;
  const positivo = valor >= 0;
  const texto = `${positivo ? '+' : ''}${valor.toFixed(1)}%`;
  const classe = claro
    ? 'bg-white/15 text-white'
    : positivo
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-rose-100 text-rose-700';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${classe}`}>{texto}</span>;
}

export default function CompetenciaOverview({ onDrill }: { onDrill: (destino: 'faturas' | 'nfse' | 'bancos' | 'folhas') => void }) {
  const { t, locale } = useI18n();
  const labelFolha = useFolhaStatusLabel();

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [dados, setDados] = useState<FinVisaoGeral | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarEmpresas()
      .then((lista) => {
        if (vivo) setEmpresas(lista);
      })
      .catch(() => {
        /* sem empresas visíveis — filtro fica vazio */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const competencia = useMemo(() => `${ano}-${String(mes).padStart(2, '0')}`, [mes, ano]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resultado = await getVisaoGeral({ competencia, empresaId: empresaId || undefined });
      setDados(resultado);
    } catch (erro) {
      console.error('visao-geral:', erro);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [competencia, empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const folhasKpi = dados?.kpis?.folhasPorStatus ?? {};
  const totalFolhas = Object.values(folhasKpi).reduce((soma, qtd) => soma + qtd, 0);
  const faturasPendentes = (dados?.kpis?.faturasPorStatus?.rascunho ?? 0) + (dados?.kpis?.faturasPorStatus?.emitida ?? 0);
  const nfsePendentes =
    (dados?.kpis?.nfsePorStatus?.rps_gerado ?? 0) +
    (dados?.kpis?.nfsePorStatus?.enviado ?? 0) +
    (dados?.kpis?.nfsePorStatus?.rejeitado ?? 0);
  const barras = barrasCompetencia(dados?.competencias ?? []);
  const fatias = fatiasStatus(dados?.kpis?.faturasPorStatus ?? {});
  const totalFatias = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
  const variacao = variacaoContraMesAnterior(dados?.competencias ?? [], competencia);
  const dataLonga = new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(hoje);

  const raio = 42;
  const circunferencia = 2 * Math.PI * raio;
  let cursorArco = 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abz-blue-dark">{t('financeiro.titulo')}</h1>
          <p className="text-sm capitalize text-gray-500">{dataLonga}</p>
        </div>
        <div className={`${FIN_CARD_CLASS} flex flex-wrap items-end gap-3 p-3`}>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">{t('financeiro.mes')}</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={FIN_INPUT_CLASS}>
              {MESES.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">{t('financeiro.ano')}</label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={ano}
              onChange={(e) => setAno(Number(e.target.value) || hoje.getFullYear())}
              className={`${FIN_INPUT_CLASS} w-24`}
            />
          </div>
          <div className="min-w-44">
            <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">{t('financeiro.empresa')}</label>
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={FIN_INPUT_CLASS}>
              <option value="">{t('financeiro.todasEmpresas')}</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={carregar} className={FIN_BTN_SECONDARY_CLASS} disabled={carregando}>
            <FiRefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            {t('financeiro.recarregar')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onDrill('bancos')}
          className="rounded-2xl bg-abz-blue-dark p-4 text-left text-white shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <FiDollarSign className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/70">{t('financeiro.kpiRecebidoMes')}</p>
          <p className="mt-1 text-2xl font-bold">{carregando && !dados ? '—' : formatarMoeda(dados?.kpis?.recebidoMes ?? 0)}</p>
          <p className="mt-1 text-xs text-white/70">
            {t('financeiro.cobrancas')}: {dados?.kpis?.cobrancasAbertas ?? 0}
          </p>
        </button>

        <button type="button" onClick={() => onDrill('faturas')} className={`${FIN_CARD_CLASS} p-4 text-left transition hover:shadow-md`}>
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-abz-light-blue text-abz-blue">
              <FiFileText className="h-5 w-5" />
            </span>
            <VariacaoBadge valor={variacao} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('financeiro.kpiFaturas')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{dados?.kpis?.totalFaturas ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">
            {t('financeiro.emAberto')}: {faturasPendentes}
          </p>
        </button>

        <button type="button" onClick={() => onDrill('folhas')} className={`${FIN_CARD_CLASS} p-4 text-left transition hover:shadow-md`}>
          <div className="flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-abz-light-blue text-abz-blue">
              <FiList className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('financeiro.folhasNoMes')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalFolhas}</p>
          <p className="mt-1 truncate text-xs text-gray-500">
            {Object.entries(folhasKpi).length === 0
              ? '—'
              : Object.entries(folhasKpi)
                  .map(([status, qtd]) => `${labelFolha(status)} ${qtd}`)
                  .join(' · ')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrill('nfse')}
          className="rounded-2xl bg-abz-blue p-4 text-left text-white shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <FiFilePlus className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/80">{t('financeiro.kpiNfsePendentes')}</p>
          <p className="mt-1 text-2xl font-bold">{nfsePendentes}</p>
          <p className="mt-1 text-xs text-white/80">
            {t('financeiro.nfseAutorizado')}: {dados?.kpis?.nfsePorStatus?.autorizado ?? 0}
          </p>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className={`${FIN_CARD_CLASS} p-4 xl:col-span-3`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">{t('financeiro.movimentoCompetencia')}</h2>
              <p className="text-xs text-gray-500">{t('financeiro.competencias')}</p>
            </div>
          </div>
          {barras.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{t('financeiro.semCompetencias')}</p>
          ) : (
            <div className="flex h-44 items-end gap-2">
              {barras.map((barra) => {
                const ativa = barra.competencia === competencia;
                const altura = Math.max(8, Math.round(barra.fracao * 100));
                return (
                  <button
                    key={barra.competencia}
                    type="button"
                    onClick={() => {
                      const [cAno, cMes] = barra.competencia.split('-');
                      if (cMes) setMes(Number(cMes));
                      if (cAno) setAno(Number(cAno));
                    }}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    title={`${barra.competencia} · ${formatarMoeda(barra.total)}`}
                  >
                    <span className="text-[10px] font-semibold text-gray-500">{barra.faturas}</span>
                    <span
                      className={`w-full max-w-8 rounded-t-lg ${ativa ? 'bg-abz-blue-dark' : 'bg-abz-blue/80'}`}
                      style={{ height: `${altura}%` }}
                    />
                    <span className={`text-[10px] font-bold ${ativa ? 'text-abz-blue' : 'text-gray-400'}`}>
                      {String(barra.mes).padStart(2, '0')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={`${FIN_CARD_CLASS} p-4 xl:col-span-2`}>
          <h2 className="text-sm font-bold text-gray-900">{t('financeiro.faturasPorStatus')}</h2>
          <p className="mb-3 text-xs text-gray-500">{competencia}</p>
          {totalFatias === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{t('financeiro.semMovimento')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" aria-hidden>
                <circle cx="60" cy="60" r={raio} fill="none" stroke="#E5E7EB" strokeWidth="14" />
                {fatias.map((fatia) => {
                  const trecho = (fatia.valor / totalFatias) * circunferencia;
                  const arco = (
                    <circle
                      key={fatia.status}
                      cx="60"
                      cy="60"
                      r={raio}
                      fill="none"
                      stroke={COR_STATUS[fatia.status]}
                      strokeWidth="14"
                      strokeDasharray={`${trecho} ${circunferencia - trecho}`}
                      strokeDashoffset={-cursorArco}
                      strokeLinecap="butt"
                      transform="rotate(-90 60 60)"
                    />
                  );
                  cursorArco += trecho;
                  return arco;
                })}
                <circle cx="60" cy="60" r="28" className="fill-white" />
                <text x="60" y="58" textAnchor="middle" className="fill-gray-900 text-[16px] font-bold">
                  {dados?.kpis?.totalFaturas ?? totalFatias}
                </text>
                <text x="60" y="72" textAnchor="middle" className="fill-gray-400 text-[8px]">
                  {t('financeiro.total')}
                </text>
              </svg>
              <ul className="min-w-0 flex-1 space-y-2">
                {fatias.map((fatia) => (
                  <li key={fatia.status} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-gray-600">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COR_STATUS[fatia.status] }} />
                      <span className="truncate">{t(CHAVE_STATUS[fatia.status])}</span>
                    </span>
                    <span className="font-bold text-gray-900">{fatia.valor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className={`${FIN_CARD_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">{t('financeiro.competencias')}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.competencia')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.tabFaturas')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.total')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(dados?.competencias ?? []).map((linha) => (
                <tr key={linha.competencia} className="hover:bg-abz-light-blue/40">
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900">{linha.competencia}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-600">{linha.faturas}</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-600">{formatarMoeda(linha.total)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const [cAno, cMes] = linha.competencia.split('-');
                        if (cMes) setMes(Number(cMes));
                        if (cAno) setAno(Number(cAno));
                        onDrill('faturas');
                      }}
                      className="text-xs font-bold text-abz-blue hover:underline"
                    >
                      {t('financeiro.visualizar')}
                    </button>
                  </td>
                </tr>
              ))}
              {dados && (dados.competencias ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('financeiro.semCompetencias')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function carregarEmpresas(): Promise<EmpresaOpcao[]> {
  const res = await fetchWithToken('/api/payroll/companies?limit=100');
  const body = await res.json();
  const items = (body?.data ?? []) as Array<{ id: string; name?: string; razao_social?: string }>;
  return items.map((e) => ({ id: e.id, name: e.name || e.razao_social || e.id }));
}
