'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiFileText,
  FiInfo,
  FiLoader,
  FiTrendingUp,
} from 'react-icons/fi';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';
import { formatarNumeroBR, type IndicadorEnvelope } from '@/components/indicadores/types';
import {
  META_ENVIO_DIAS,
  type KpiAvaliacao,
  type KpiNivelAvaliacao,
  type KpiResultadoAba,
  type KpiRetencao,
  type KpiVagas,
} from '@/lib/indicadores/kpi';

/** GET /api/indicadores/kpi → data (planilha/avaliacao viram nulos quando não há planilhas). */
interface KpiDashboardData {
  planilhas: Array<{ id: string; nome: string }>;
  planilha: { id: string; nome: string } | null;
  geradoEm: string;
  abas: KpiResultadoAba[];
  consolidado: KpiVagas | null;
  avaliacao: KpiAvaliacao | null;
}

// Cores dos gráficos — azul ABZ + semântica verde/âmbar/vermelho
const COR_AZUL = '#005dff';
const COR_VERDE = '#16a34a';
const COR_AMBAR = '#d97706';
const COR_VERMELHO = '#dc2626';
const COR_CINZA = '#9ca3af';

/** Estilo do painel de avaliação por nível do processo. */
const ESTILO_NIVEL: Record<KpiNivelAvaliacao, { fundo: string; texto: string }> = {
  excelente: { fundo: 'border-green-200 bg-green-50', texto: 'text-green-700' },
  bom: { fundo: 'border-blue-200 bg-blue-50', texto: 'text-blue-700' },
  atencao: { fundo: 'border-amber-200 bg-amber-50', texto: 'text-amber-700' },
  critico: { fundo: 'border-red-200 bg-red-50', texto: 'text-red-700' },
};

const ROTULO_NIVEL: Record<KpiNivelAvaliacao, string> = {
  excelente: 'Excelente',
  bom: 'Bom',
  atencao: 'Atenção',
  critico: 'Crítico',
};

/** Corte textual do critério de eficácia por nível (≥90%, ≥75%, ≥55%). */
const CORTE_NIVEL: Record<KpiNivelAvaliacao, string> = {
  excelente: '≥ 90%',
  bom: '≥ 75%',
  atencao: '≥ 55%',
  critico: '< 55%',
};

/** Classe de cor de uma taxa de eficácia conforme os cortes do nível. */
function classeTaxa(taxa: number | null): string {
  if (taxa === null) return 'text-gray-400';
  if (taxa >= 0.9) return 'text-green-600';
  if (taxa >= 0.75) return 'text-blue-600';
  if (taxa >= 0.55) return 'text-amber-600';
  return 'text-red-600';
}

/** Número com 1 casa decimal (pt-BR); traço quando sem medição. */
function formatarCasas(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Fração [0..1] → percentual pt-BR com 1 casa; traço quando sem medição. */
function formatarTaxa(frac: number | null): string {
  if (frac === null) return '—';
  return `${(frac * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** 'YYYY-MM' → 'mm/aaaa' para eixos e rótulos. */
function formatarMes(mes: string): string {
  const partes = mes.split('-');
  return partes.length === 2 ? `${partes[1]}/${partes[0]}` : mes;
}

/** Formatador padrão dos tooltips numéricos dos gráficos. */
const formatarNumeroTooltip = (valor: unknown): string => formatarNumeroBR(valor);

/** Cartão de número grande da faixa de KPIs. */
function CartaoKpi({
  titulo,
  valor,
  corValor = 'text-gray-900',
  selo,
  classeSelo = 'bg-gray-100 text-gray-600',
}: {
  titulo: string;
  valor: string;
  corValor?: string;
  selo?: string;
  classeSelo?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`text-2xl font-bold leading-tight ${corValor}`}>{valor}</p>
      {selo && (
        <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${classeSelo}`}>{selo}</span>
      )}
    </div>
  );
}

/** Moldura branca padrão dos gráficos. */
function PainelGrafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-bold text-gray-800">{titulo}</h3>
      {children}
    </section>
  );
}

/** Página /department/indicadores/kpi — dashboard de KPIs & Avaliação do R&S. */
export default function KpiIndicadoresPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const { t } = useI18n();

  const [data, setData] = useState<KpiDashboardData | null>(null);
  const [planilhaId, setPlanilhaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const carregarKpis = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const consulta = planilhaId ? `?planilha=${encodeURIComponent(planilhaId)}` : '';
      const res = await fetchWithToken(`/api/indicadores/kpi${consulta}`);
      const json = (await res.json()) as IndicadorEnvelope<KpiDashboardData>;
      if (res.ok && json.success && json.data) {
        setData(json.data);
      } else {
        setData(null);
        setErro(json.error || t('indicadores.kpi.erroCarregar', 'Erro ao carregar KPIs'));
      }
    } catch {
      setData(null);
      setErro(t('indicadores.kpi.erroCarregar', 'Erro ao carregar KPIs'));
    } finally {
      setLoading(false);
    }
  }, [planilhaId, t]);

  useEffect(() => {
    if (user) carregarKpis();
  }, [user, carregarKpis]);

  const consolidado = data?.consolidado ?? null;
  const avaliacao = data?.avaliacao ?? null;
  const abasDados = data?.abas.filter((aba) => aba.tipo === 'dados') ?? [];
  const abaRetencao: KpiResultadoAba | undefined = data?.abas.find((aba) => aba.tipo === 'retencao');
  const retencao: KpiRetencao | null = abaRetencao?.retencao ?? null;
  const planilhaSelecionada = planilhaId ?? data?.planilha?.id ?? '';

  // Séries dos gráficos (meses em 'mm/aaaa', atrasadas derivadas do total)
  const porMes = (consolidado?.porMes ?? []).map((m) => ({
    mes: formatarMes(m.mes),
    total: m.total,
    noPrazo: m.noPrazo,
    atrasadas: Math.max(0, m.total - m.noPrazo),
    tempoMedio: m.tempoMedio,
  }));
  const porCliente = (consolidado?.porCliente ?? []).map((c) => ({ nome: c.nome, total: c.total }));
  const porFuncao = (consolidado?.porFuncao ?? []).map((f) => ({ nome: f.nome, total: f.total }));
  const fatiasStatus = consolidado
    ? [
        { nome: t('indicadores.kpi.abertas', 'Abertas'), valor: consolidado.porStatus.aberta, cor: COR_AZUL },
        { nome: t('indicadores.kpi.fechadas', 'Fechadas'), valor: consolidado.porStatus.fechada, cor: COR_VERDE },
        { nome: t('indicadores.kpi.canceladas', 'Canceladas'), valor: consolidado.porStatus.cancelada, cor: COR_VERMELHO },
        { nome: t('indicadores.kpi.outros', 'Outros status'), valor: consolidado.porStatus.outros, cor: COR_CINZA },
      ].filter((fatia) => fatia.valor > 0)
    : [];
  const retencaoPorCliente = (retencao?.porCliente ?? []).map((r) => ({
    nome: r.cliente,
    retencao: r.retencao === null ? 0 : r.retencao * 100,
  }));

  const tempoEnvio = consolidado?.tempoMedioEnvio ?? null;
  const dentroDaMeta = tempoEnvio !== null && tempoEnvio <= META_ENVIO_DIAS;

  return (
    <GtPageShell className="gap-3 p-1">
      {/* Cabeçalho */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
            <FiTrendingUp className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
              {t('indicadores.kpi.titulo', 'KPIs & Avaliação R&S')}
            </h1>
            <p className="hidden truncate text-xs text-gray-500 sm:block">
              {t(
                'indicadores.kpi.subtitulo',
                'Painel de indicadores de eficácia do Recrutamento & Seleção',
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="kpi-select-planilha">
            {t('indicadores.kpi.planilha', 'Planilha')}
          </label>
          <select
            id="kpi-select-planilha"
            value={planilhaSelecionada}
            onChange={(evento) => setPlanilhaId(evento.target.value)}
            disabled={loading || (data?.planilhas.length ?? 0) === 0}
            className="max-w-[220px] min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-abz-blue disabled:opacity-50"
          >
            {(data?.planilhas ?? []).map((planilha) => (
              <option key={planilha.id} value={planilha.id}>
                {planilha.nome}
              </option>
            ))}
          </select>
          <Link
            href="/department/indicadores"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            title={t('indicadores.kpi.voltar', 'Voltar')}
          >
            <FiArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('indicadores.kpi.voltar', 'Voltar')}</span>
          </Link>
        </div>
      </div>

      {/* Conteúdo */}
      <div className={GT_PAGE_SCROLLPORT_CLASS}>
        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-sm text-gray-500">
            <FiLoader className="h-6 w-6 animate-spin text-gray-400" />
            {t('indicadores.kpi.carregando', 'Carregando KPIs...')}
          </div>
        ) : erro ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{erro}</span>
            </div>
            <button
              type="button"
              onClick={carregarKpis}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              <FiLoader className="h-4 w-4" />
              {t('indicadores.kpi.tentarNovamente', 'Tentar novamente')}
            </button>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-3 pb-4">
            {consolidado ? (
              <>
                {/* Faixa de cartões */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  <CartaoKpi
                    titulo={t('indicadores.kpi.totalVagas', 'Total de vagas')}
                    valor={formatarNumeroBR(consolidado.total)}
                  />
                  <CartaoKpi
                    titulo={t('indicadores.kpi.abertas', 'Abertas')}
                    valor={formatarNumeroBR(consolidado.porStatus.aberta)}
                    corValor="text-blue-600"
                  />
                  <CartaoKpi
                    titulo={t('indicadores.kpi.fechadas', 'Fechadas')}
                    valor={formatarNumeroBR(consolidado.porStatus.fechada)}
                    corValor="text-green-600"
                  />
                  <CartaoKpi
                    titulo={t('indicadores.kpi.canceladas', 'Canceladas')}
                    valor={formatarNumeroBR(consolidado.porStatus.cancelada)}
                    corValor="text-red-600"
                  />
                  <CartaoKpi
                    titulo={t('indicadores.kpi.tempoMedio', 'Tempo médio de envio (dias)')}
                    valor={formatarCasas(tempoEnvio)}
                    corValor={tempoEnvio === null ? 'text-gray-400' : dentroDaMeta ? 'text-green-600' : 'text-amber-600'}
                    selo={t('indicadores.kpi.metaDias', { dias: META_ENVIO_DIAS }, 'Meta: {dias} dias')}
                    classeSelo={
                      tempoEnvio === null
                        ? 'bg-gray-100 text-gray-600'
                        : dentroDaMeta
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                    }
                  />
                  <CartaoKpi
                    titulo={t('indicadores.kpi.taxaEficacia', 'Taxa de eficácia')}
                    valor={formatarTaxa(consolidado.taxaEficacia)}
                    corValor={classeTaxa(consolidado.taxaEficacia)}
                  />
                  <CartaoKpi
                    titulo={t('indicadores.kpi.antecipacaoMedia', 'Antecipação média (dias)')}
                    valor={formatarCasas(consolidado.antecipacaoMedia)}
                  />
                </div>

                {/* Painel de avaliação do processo */}
                {avaliacao && (
                  <section className={`rounded-xl border p-4 shadow-sm ${ESTILO_NIVEL[avaliacao.nivel].fundo}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('indicadores.kpi.avaliacao', 'Avaliação do processo')}
                        </p>
                        <p className={`mt-0.5 text-xl font-bold ${ESTILO_NIVEL[avaliacao.nivel].texto}`}>
                          {t(`indicadores.kpi.nivel.${avaliacao.nivel}`, ROTULO_NIVEL[avaliacao.nivel])}
                        </p>
                        {avaliacao.taxaEficacia !== null && (
                          <p className="text-xs text-gray-500">
                            {t('indicadores.kpi.criterio', { corte: CORTE_NIVEL[avaliacao.nivel] }, 'Eficácia: {corte} das vagas no prazo')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <p className="text-xs font-semibold text-gray-500">
                            {t('indicadores.kpi.taxaEficacia', 'Taxa de eficácia')}
                          </p>
                          <p className={`text-lg font-bold ${classeTaxa(avaliacao.taxaEficacia)}`}>
                            {formatarTaxa(avaliacao.taxaEficacia)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">
                            {t('indicadores.kpi.tempoMedio', 'Tempo médio de envio (dias)')}
                          </p>
                          <p className="text-lg font-bold text-gray-900">{formatarCasas(avaliacao.tempoMedioEnvio)}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Gráficos */}
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="xl:col-span-2">
                    <PainelGrafico titulo={t('indicadores.kpi.evolucaoMensal', 'Evolução mensal de vagas')}>
                      <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={porMes} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} />
                          <YAxis yAxisId="esq" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="dir" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={formatarNumeroTooltip} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar
                            yAxisId="esq"
                            dataKey="total"
                            name={t('indicadores.kpi.totalVagas', 'Total de vagas')}
                            fill={COR_AZUL}
                            radius={[4, 4, 0, 0]}
                          />
                          <Line
                            yAxisId="dir"
                            type="monotone"
                            dataKey="tempoMedio"
                            name={t('indicadores.kpi.tempoMedio', 'Tempo médio de envio (dias)')}
                            stroke={COR_AMBAR}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </PainelGrafico>
                  </div>

                  <PainelGrafico titulo={t('indicadores.kpi.eficaciaMensal', 'Eficácia mensal (envios no prazo)')}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={porMes} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={formatarNumeroTooltip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="noPrazo"
                          stackId="eficacia"
                          name={t('indicadores.kpi.noPrazo', 'No prazo')}
                          fill={COR_VERDE}
                        />
                        <Bar
                          dataKey="atrasadas"
                          stackId="eficacia"
                          name={t('indicadores.kpi.atrasadas', 'Atrasadas')}
                          fill={COR_AMBAR}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </PainelGrafico>

                  <PainelGrafico titulo={t('indicadores.kpi.porCliente', 'Vagas por cliente')}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart layout="vertical" data={porCliente} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 10 }} tickLine={false} />
                        <Tooltip formatter={formatarNumeroTooltip} />
                        <Bar
                          dataKey="total"
                          name={t('indicadores.kpi.totalVagas', 'Total de vagas')}
                          fill={COR_AZUL}
                          radius={[0, 4, 4, 0]}
                          barSize={14}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </PainelGrafico>

                  <PainelGrafico titulo={t('indicadores.kpi.porFuncao', 'Vagas por função')}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={porFuncao} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="nome"
                          tick={{ fontSize: 9 }}
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={formatarNumeroTooltip} />
                        <Bar
                          dataKey="total"
                          name={t('indicadores.kpi.totalVagas', 'Total de vagas')}
                          fill={COR_AZUL}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </PainelGrafico>

                  <PainelGrafico titulo={t('indicadores.kpi.porStatus', 'Vagas por status')}>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Tooltip formatter={formatarNumeroTooltip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Pie
                          data={fatiasStatus}
                          dataKey="valor"
                          nameKey="nome"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={2}
                        >
                          {fatiasStatus.map((fatia) => (
                            <Cell key={fatia.nome} fill={fatia.cor} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </PainelGrafico>
                </div>
              </>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                  <FiInfo className="h-7 w-7" />
                </div>
                <p className="text-sm text-gray-500">
                  {t('indicadores.kpi.semVagas', 'Sem abas de vagas nesta planilha')}
                </p>
              </div>
            )}

            {/* Retenção — aba "KPI Eficácia", independe das abas de vagas */}
            {retencao && (retencao.porCliente.length > 0 || retencao.taxaRetencao !== null) && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="flex flex-col justify-center gap-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('indicadores.kpi.retencaoGeral', 'Retenção geral')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{formatarTaxa(retencao.taxaRetencao)}</p>
                  <p className="text-xs text-gray-500">
                    {formatarNumeroBR(retencao.totalPermaneceram)} / {formatarNumeroBR(retencao.totalColaboradores)}
                  </p>
                </div>
                <div className="lg:col-span-2">
                  <PainelGrafico titulo={t('indicadores.kpi.retencao', 'Retenção por cliente')}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={retencaoPorCliente} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="nome"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                          height={64}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(valor: number) => `${valor}%`}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip formatter={(valor) => `${formatarCasas(Number(valor))}%`} />
                        <Bar
                          dataKey="retencao"
                          name={t('indicadores.kpi.retencao', 'Retenção por cliente')}
                          fill={COR_VERDE}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </PainelGrafico>
                </div>
              </div>
            )}

            {/* Abas do tipo "dados" — sem KPIs calculáveis */}
            {abasDados.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                {abasDados.map((aba) => (
                  <p key={aba.id} className="flex items-center gap-1.5">
                    <FiFileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-semibold text-gray-600">{aba.nome}:</span>
                    {t('indicadores.kpi.semKpi', 'Sem KPIs calculáveis (colunas não reconhecidas)')}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </GtPageShell>
  );
}
