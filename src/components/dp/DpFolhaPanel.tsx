'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  FiAlertTriangle, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight,
  FiDollarSign, FiRefreshCw, FiSend, FiUpload, FiXCircle,
} from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { mesAnoAtualBRT } from '@/components/gestao-tripulantes/fechamento/fechamentoV2';
import AprovacaoFolhaModal from '@/components/payroll/AprovacaoFolhaModal';

// ─── Tipos (wire snake_case, conforme rotas reais) ───────────────────────────

interface EmpresaItem {
  id: string;
  name: string;
  cnpj?: string | null;
  is_active?: boolean;
}


interface CentroCustoItem {
  id: string;
  code: string;
  name: string;
}
type FolhaStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'cancelled';

interface FolhaSheet {
  id: string;
  reference_month: number;
  reference_year: number;
  status: FolhaStatus;
  total_employees?: number | null;
  total_gross?: number | null;
  total_deductions?: number | null;
  total_net?: number | null;
  total_inss?: number | null;
  total_irrf?: number | null;
  total_fgts?: number | null;
  approved_by?: string | null;
  approved_at?: string | null;
  department_id?: string | null;
}

interface CalculoItem {
  codeId: string;
  code: string;
  type: string;
  name: string;
  quantity: number;
  referenceValue: number;
  calculatedValue: number;
  origem?: string;
}

interface CalculoResult {
  employeeId: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  grossSalary: number;
  netSalary: number;
  items: CalculoItem[];
}

interface CalculoFolhaData {
  sheetId: string;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalInss: number;
  totalIrrf: number;
  totalFgts: number;
  results: CalculoResult[];
}

interface ItemRelatorio {
  code: string;
  name: string;
  type: string;
  quantity: number;
  valor: number;
}

interface LinhaRelatorio {
  employeeId: string;
  nome: string;
  cpf: string;
  centroCusto: string;
  diasEmbarcado: number;
  diasDobra: number;
  diasFolga: number;
  diasFolgaIndenizada: number;
  diasFerias: number;
  bruto: number;
  descontos: number;
  liquido: number;
  inss: number;
  irrf: number;
  fgts: number;
  itens: ItemRelatorio[];
}

interface BlocoCentro {
  centroCusto: string;
  colaboradores: number;
  diasEmbarcado: number;
  diasDobra: number;
  diasFolga: number;
  diasFolgaIndenizada: number;
  diasFerias: number;
  bruto: number;
  descontos: number;
  liquido: number;
}

interface RelatorioOperacional {
  sheetId: string;
  inseridos: number;
  descartadosPrecedencia: number;
  pendencias: PendenciaCpf[];
  colaboradores: LinhaRelatorio[];
  centros: BlocoCentro[];
  totais: BlocoCentro;
}

interface PendenciaCpf {
  cpf: string;
  nome: string;
  motivo: string;
}

interface SyncModulosResultado {
  inseridos: number;
  descartadosPrecedencia: number;
  pendencias: PendenciaCpf[];
}

interface EstadoAprovacao {
  aprovado: boolean;
  assinados: number;
  obrigatorios: number;
  todosAssinaram: boolean;
  rejeicao?: { por?: string; motivo?: string; em?: string } | null;
  iniciada: boolean;
}

interface ColaboradorWk {
  id: string;
  registration_number: string | null;
  name: string;
  cpf: string | null;
  position: string | null;
  base_salary: number | null;
  admission_date: string | null;
  termination_date: string | null;
  status: string;
}

interface EmployeeFolha {
  id: string;
  name: string;
  cpf: string | null;
  registration_number: string | null;
}

interface StatusUltimoEvento {
  em: string;
  fonte: 'api' | 'arquivo';
  competencia: { mes: number; ano: number };
  employeesUpsertados: number;
  itensCriados: number;
  avisos: string[];
  por?: string;
}

interface StatusCompetencia {
  sheetId: string;
  companyId: string;
  mes: number;
  ano: number;
  status: string;
  itensWk: number;
  itensGt: number;
  itensManual: number;
  atualizadoEm?: string;
}

interface StatusWkData {
  ultimoEvento: StatusUltimoEvento | null;
  competencias: StatusCompetencia[];
}

const COLAB_WK_LIMIT = 20;

const STATUS_LABEL_KEY: Record<FolhaStatus, string> = {
  draft: 'dp.folha.statusDraft',
  calculated: 'dp.folha.statusCalculated',
  approved: 'dp.folha.statusApproved',
  paid: 'dp.folha.statusPaid',
  cancelled: 'dp.folha.statusCancelled',
};

const STATUS_CLASS: Record<FolhaStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  calculated: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const ORIGEM_CLASS: Record<string, string> = {
  wk: 'bg-blue-100 text-blue-800',
  gt: 'bg-emerald-100 text-emerald-800',
  manual: 'bg-gray-100 text-gray-700',
};

function formatBRL(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

/** Painel "Rubricas & Folha" da aba DP — sincroniza WK/módulos internos, calcula e envia para aprovação. */
export default function DpFolhaPanel() {
  const { user, hasFeature } = useSupabaseAuth();
  const { t } = useI18n();

  const podeEditar = hasFeature('folha.edit');

  // Competência (mês civil BRT, padrão do portal).
  const [mesAnoInput, setMesAnoInput] = useState(() => mesAnoAtualBRT());
  const competencia = useMemo(() => {
    const [ano, mes] = mesAnoInput.split('-');
    return { mes: parseInt(mes, 10), ano: parseInt(ano, 10) };
  }, [mesAnoInput]);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoItem[]>([]);
  const [centroCustoId, setCentroCustoId] = useState('');

  const [sheet, setSheet] = useState<FolhaSheet | null>(null);
  const [calculo, setCalculo] = useState<CalculoFolhaData | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioOperacional | null>(null);
  const [funcionarios, setFuncionarios] = useState<EmployeeFolha[]>([]);
  const [estadoAprovacao, setEstadoAprovacao] = useState<EstadoAprovacao | null>(null);

  const [statusWk, setStatusWk] = useState<StatusWkData | null>(null);
  const [syncModulos, setSyncModulos] = useState<SyncModulosResultado | null>(null);
  const [codigosNaoMapeados, setCodigosNaoMapeados] = useState<string[]>([]);
  const [avisosSync, setAvisosSync] = useState<string[]>([]);

  const [colabWk, setColabWk] = useState<ColaboradorWk[]>([]);
  const [colabWkTotal, setColabWkTotal] = useState(0);
  const [colabWkPage, setColabWkPage] = useState(1);
  const [colabWkCarregando, setColabWkCarregando] = useState(false);

  const [sincronizando, setSincronizando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [modalAprovacaoAberto, setModalAprovacaoAberto] = useState(false);

  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  const tf = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => t(key, params, fallback),
    [t]
  );

  // ─── Cargas de dados ────────────────────────────────────────────────────────

  const carregarEmpresas = useCallback(async () => {
    try {
      const res = await fetchWithToken('/api/payroll/companies?limit=100&isActive=true');
      const json = await res.json();
      if (res.ok && json.success) {
        setEmpresas(json.data || []);
      } else {
        toast.error(json.error || tf('dp.folha.erroCarregarEmpresas', 'Erro ao carregar empresas'));
      }
    } catch {
      toast.error(tf('dp.folha.erroCarregarEmpresas', 'Erro ao carregar empresas'));
    }
  }, [tf]);

  const carregarStatusWk = useCallback(async (empresaId: string) => {
    try {
      const qs = empresaId ? `?companyId=${encodeURIComponent(empresaId)}` : '';
      const res = await fetchWithToken(`/api/dp/wk/status${qs}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setStatusWk({ ultimoEvento: json.data?.ultimoEvento ?? null, competencias: json.data?.competencias ?? [] });
      } else {
        setStatusWk(null);
      }
    } catch {
      setStatusWk(null);
    }
  }, []);

  const carregarCentrosCusto = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setCentrosCusto([]);
      return;
    }
    try {
      const res = await fetchWithToken(`/api/payroll/departments?companyId=${encodeURIComponent(empresaId)}&isActive=true`);
      const json = await res.json();
      if (res.ok && json.success) {
        setCentrosCusto(json.data || []);
      } else {
        setCentrosCusto([]);
      }
    } catch {
      setCentrosCusto([]);
    }
  }, []);

  const carregarFolhaDaCompetencia = useCallback(async (empresaId: string, comp: { mes: number; ano: number }, deptId: string) => {
    if (!empresaId) {
      setSheet(null);
      setCalculo(null);
      setEstadoAprovacao(null);
      return;
    }
    try {
      const deptQs = deptId ? `&departmentId=${encodeURIComponent(deptId)}` : '';
      const qs = `companyId=${encodeURIComponent(empresaId)}&referenceMonth=${comp.mes}&referenceYear=${comp.ano}&limit=5${deptQs}`;
      const res = await fetchWithToken(`/api/payroll/sheets?${qs}`);
      const json = await res.json();
      const lista: FolhaSheet[] = res.ok && json.success ? (json.data || []) : [];
      // Sem centro selecionado: prefere a sheet geral (department_id null).
      const encontrada: FolhaSheet | null = deptId
        ? (lista[0] ?? null)
        : (lista.find((s) => !s.department_id) ?? lista[0] ?? null);
      setSheet(encontrada);
      setCalculo(null);
      setExpandidos(new Set());
      if (!encontrada) setEstadoAprovacao(null);
    } catch {
      setSheet(null);
      setEstadoAprovacao(null);
    }
  }, []);

  const carregarFuncionarios = useCallback(async (empresaId: string, deptId: string) => {
    if (!empresaId) {
      setFuncionarios([]);
      return;
    }
    try {
      const deptQs = deptId ? `&departmentId=${encodeURIComponent(deptId)}` : '';
      const res = await fetchWithToken(`/api/payroll/employees?companyId=${encodeURIComponent(empresaId)}&limit=1000${deptQs}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setFuncionarios(json.data || []);
      } else {
        setFuncionarios([]);
      }
    } catch {
      setFuncionarios([]);
    }
  }, []);

  const carregarEstadoAprovacao = useCallback(async (sheetId: string) => {
    try {
      const res = await fetchWithToken(`/api/payroll/sheets/${sheetId}/aprovacao`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setEstadoAprovacao({
          aprovado: Boolean(json.data.aprovado),
          assinados: Number(json.data.assinados ?? 0),
          obrigatorios: Number(json.data.obrigatorios ?? 0),
          todosAssinaram: Boolean(json.data.todosAssinaram),
          rejeicao: json.data.aprovacao?.rejeicao ?? null,
          iniciada: Boolean(json.data.aprovacao),
        });
      } else {
        // 409-like para draft/paid/cancelled — aprovação indisponível nesses estados.
        setEstadoAprovacao(null);
      }
    } catch {
      setEstadoAprovacao(null);
    }
  }, []);

  const carregarColaboradoresWk = useCallback(async (page: number, empresaId: string, deptId: string) => {
    setColabWkCarregando(true);
    try {
      const filtros = `${empresaId ? `&companyId=${encodeURIComponent(empresaId)}` : ''}${deptId ? `&departmentId=${encodeURIComponent(deptId)}` : ''}`;
      const res = await fetchWithToken(`/api/dp/wk/colaboradores?page=${page}&limit=${COLAB_WK_LIMIT}${filtros}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setColabWk(json.data?.colaboradores || []);
        setColabWkTotal(Number(json.total ?? 0));
        setColabWkPage(Number(json.page ?? page));
      } else {
        setColabWk([]);
        setColabWkTotal(0);
        toast.error(json.error || tf('dp.folha.erroCarregarColaboradores', 'Erro ao carregar colaboradores WK'));
      }
    } catch {
      setColabWk([]);
      setColabWkTotal(0);
      toast.error(tf('dp.folha.erroCarregarColaboradores', 'Erro ao carregar colaboradores WK'));
    } finally {
      setColabWkCarregando(false);
    }
  }, [tf]);

  // Recarrega tudo que depende de empresa + centro de custo + competência. O
  // estado de aprovação é revalidado pelo efeito de [sheet] quando a folha é
  // recarregada.
  const recarregarTudo = useCallback(async (empresaId: string, comp: { mes: number; ano: number }, deptId: string) => {
    await Promise.all([
      carregarFolhaDaCompetencia(empresaId, comp, deptId),
      carregarStatusWk(empresaId),
      carregarFuncionarios(empresaId, deptId),
    ]);
  }, [carregarFolhaDaCompetencia, carregarStatusWk, carregarFuncionarios]);

  useEffect(() => {
    if (user) carregarEmpresas();
  }, [user, carregarEmpresas]);

  useEffect(() => {
    if (!user) return;
    setRelatorio(null);
    carregarCentrosCusto(companyId);
    carregarStatusWk(companyId);
    carregarColaboradoresWk(1, companyId, centroCustoId);
    if (companyId) {
      carregarFolhaDaCompetencia(companyId, competencia, centroCustoId);
      carregarFuncionarios(companyId, centroCustoId);
    } else {
      setSheet(null);
      setCalculo(null);
      setEstadoAprovacao(null);
      setFuncionarios([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId, centroCustoId, mesAnoInput]);

  // Estado de aprovação quando a sheet muda (só faz sentido em calculated/approved).
  useEffect(() => {
    if (sheet && (sheet.status === 'calculated' || sheet.status === 'approved')) {
      carregarEstadoAprovacao(sheet.id);
    } else {
      setEstadoAprovacao(null);
    }
  }, [sheet, carregarEstadoAprovacao]);

  // ─── Ações ──────────────────────────────────────────────────────────────────

  const exigirEmpresa = (): string | null => {
    if (!companyId) {
      toast.error(tf('dp.folha.selecioneEmpresa', 'Selecione uma empresa'));
      return null;
    }
    return companyId;
  };

  /** Trata erro das rotas de sincronização: 422 lista códigos não mapeados. */
  const tratarErroSync = useCallback(
    (res: Response, json: { success?: boolean; error?: string; data?: { codigosNaoMapeados?: string[] } }): boolean => {
      if (res.ok && json.success) return false;
      if (res.status === 422 && json.data?.codigosNaoMapeados?.length) {
        setCodigosNaoMapeados(json.data.codigosNaoMapeados);
      }
      toast.error(json.error || tf('dp.folha.erroGeral', 'Erro na operação de folha'));
      return true;
    },
    [tf]
  );

  const sincronizarWk = async () => {
    const empresaId = exigirEmpresa();
    if (!empresaId || sincronizando) return;
    setSincronizando(true);
    setCodigosNaoMapeados([]);
    setAvisosSync([]);
    setSyncModulos(null);
    try {
      const res = await fetchWithToken('/api/dp/wk/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fonte: 'api', competencia, companyId: empresaId, departmentId: centroCustoId || undefined }),
      });
      const json = await res.json();
      if (await tratarErroSync(res, json)) return;
      const wkItens = Number(json.data?.wk?.itensCriados ?? 0);
      setAvisosSync(json.data?.wk?.avisos || []);
      setSyncModulos(json.data?.modulos || null);
      toast.success(`${tf('dp.folha.sucessoSync', 'Sincronização concluída')} — ${wkItens} itens WK`);
      await recarregarTudo(empresaId, competencia, centroCustoId);
    } catch {
      toast.error(tf('dp.folha.erroGeral', 'Erro na operação de folha'));
    } finally {
      setSincronizando(false);
    }
  };

  const importarArquivo = async (file: File) => {
    const empresaId = exigirEmpresa();
    if (!empresaId || importando) return;
    setImportando(true);
    setCodigosNaoMapeados([]);
    setAvisosSync([]);
    setSyncModulos(null);
    try {
      const form = new FormData();
      form.append('fonte', 'arquivo');
      form.append('arquivo', file);
      form.append('competencia', JSON.stringify(competencia));
      form.append('mes', String(competencia.mes));
      form.append('ano', String(competencia.ano));
      form.append('companyId', empresaId);
      if (centroCustoId) form.append('departmentId', centroCustoId);

      const res = await fetchWithToken('/api/dp/wk/sync', { method: 'POST', body: form });
      const json = await res.json();
      if (await tratarErroSync(res, json)) return;
      const wkItens = Number(json.data?.wk?.itensCriados ?? 0);
      setAvisosSync(json.data?.wk?.avisos || []);
      setSyncModulos(json.data?.modulos || null);
      toast.success(`${tf('dp.folha.sucessoSync', 'Sincronização concluída')} — ${wkItens} itens WK`);
      if (inputArquivoRef.current) inputArquivoRef.current.value = '';
      await recarregarTudo(empresaId, competencia, centroCustoId);
    } catch {
      toast.error(tf('dp.folha.erroGeral', 'Erro na operação de folha'));
    } finally {
      setImportando(false);
    }
  };

  const calcularFolha = async () => {
    if (!companyId || calculando) return;
    setCalculando(true);
    try {
      const res = await fetchWithToken('/api/dp/folha/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          competencia,
          departmentId: centroCustoId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || tf('dp.folha.erroGeral', 'Erro na operação de folha'));
        return;
      }
      const data = json.data as RelatorioOperacional;
      setRelatorio(data);
      setSyncModulos({
        inseridos: data.inseridos,
        descartadosPrecedencia: data.descartadosPrecedencia,
        pendencias: data.pendencias || [],
      });
      toast.success(tf('dp.folha.sucessoCalculo', 'Folha calculada com sucesso'));
      await recarregarTudo(companyId, competencia, centroCustoId);
    } catch {
      toast.error(tf('dp.folha.erroGeral', 'Erro na operação de folha'));
    } finally {
      setCalculando(false);
    }
  };

  const aoResultadoAprovacao = async (resultado: 'aprovado' | 'rejeitado' | 'cancelado') => {
    if (resultado === 'cancelado') return;
    toast.success(
      resultado === 'aprovado'
        ? tf('dp.folha.statusApproved', 'Aprovada')
        : tf('dp.folha.rejeitada', 'Rejeitada')
    );
    await recarregarTudo(companyId, competencia, centroCustoId);
  };

  const toggleExpandido = (employeeId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  // ─── Derivados ──────────────────────────────────────────────────────────────

  const funcionariosPorId = useMemo(() => {
    const mapa = new Map<string, EmployeeFolha>();
    funcionarios.forEach((f) => mapa.set(f.id, f));
    return mapa;
  }, [funcionarios]);

  const competenciaAtualStatus = useMemo(() => {
    if (!statusWk || !companyId) return null;
    return (
      statusWk.competencias.find(
        (c) => c.companyId === companyId && c.mes === competencia.mes && c.ano === competencia.ano
      ) || null
    );
  }, [statusWk, companyId, competencia]);

  const colabWkTotalPages = Math.max(1, Math.ceil(colabWkTotal / COLAB_WK_LIMIT));

  const desabilitadoEdicao = !podeEditar;
  const tituloEdicao = desabilitadoEdicao ? tf('dp.folha.requerEdicao', 'Requer permissão folha.edit') : undefined;

  if (!user) return null;

  return (
    <div className="flex flex-col gap-2 min-h-0">
      {/* Cabeçalho: competência + empresa + ações */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex flex-col gap-2 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FiDollarSign className="w-4 h-4 text-emerald-600" />
              {tf('dp.folha.titulo', 'Rubricas & Folha')}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">
              {tf('dp.folha.descricao', 'O sistema calcula a folha com os embarques, dobras, folgas e férias já registrados e gera o relatório por colaborador e centro de custo')}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase">
              {tf('dp.folha.competencia', 'Competência')}
              <input
                type="month"
                value={mesAnoInput}
                onChange={(e) => setMesAnoInput(e.target.value)}
                className="block mt-0.5 px-2.5 py-1 text-xs border border-gray-300 rounded-lg font-bold text-gray-900 bg-white"
              />
            </label>
            <label className="text-[11px] font-bold text-gray-500 uppercase">
              {tf('dp.folha.empresa', 'Empresa')}
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="block mt-0.5 w-44 px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white font-medium text-gray-700"
              >
                <option value="">{tf('dp.folha.selecioneEmpresa', 'Selecione uma empresa')}</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-gray-500 uppercase">
              {tf('dp.folha.centroCusto', 'Centro de custo')}
              <select
                value={centroCustoId}
                onChange={(e) => setCentroCustoId(e.target.value)}
                disabled={!companyId}
                className="block mt-0.5 w-44 px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white font-medium text-gray-700 disabled:opacity-50"
              >
                <option value="">{tf('dp.folha.todosCentrosCusto', 'Todos os centros')}</option>
                {centrosCusto.map((cc) => (
                  <option key={cc.id} value={cc.id}>{cc.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => recarregarTudo(companyId, competencia, centroCustoId)}
              disabled={!companyId}
              className="p-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
              title={tf('dp.folha.atualizar', 'Atualizar')}
            >
              <FiRefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={sincronizarWk}
            disabled={desabilitadoEdicao || !companyId || sincronizando}
            title={tituloEdicao}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-abz-blue hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{sincronizando ? tf('dp.folha.sincronizandoWk', 'Sincronizando WK...') : tf('dp.folha.sincronizarWk', 'Sincronizar WK')}</span>
          </button>

          <button
            type="button"
            onClick={() => inputArquivoRef.current?.click()}
            disabled={desabilitadoEdicao || !companyId || importando}
            title={tituloEdicao || tf('dp.folha.importarArquivo', 'Importar arquivo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-blue-900 bg-blue-100 hover:bg-blue-200 rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <FiUpload className={`w-3.5 h-3.5 ${importando ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{importando ? tf('dp.folha.importandoArquivo', 'Importando arquivo...') : tf('dp.folha.importarArquivo', 'Importar arquivo')}</span>
          </button>
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importarArquivo(file);
            }}
          />

          <button
            type="button"
            onClick={calcularFolha}
            disabled={desabilitadoEdicao || !companyId || sincronizando || calculando
              || sheet?.status === 'approved' || sheet?.status === 'paid' || sheet?.status === 'cancelled'}
            title={tituloEdicao}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-900 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <FiDollarSign className={`w-3.5 h-3.5 ${calculando ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{calculando ? tf('dp.folha.calculandoFolha', 'Calculando embarques, dobras, folgas e férias...') : tf('dp.folha.calcularFolha', 'Calcular pelos dados')}</span>
          </button>

          <button
            type="button"
            onClick={() => setModalAprovacaoAberto(true)}
            disabled={!sheet || sheet.status !== 'calculated'}
            title={sheet?.status === 'draft'
              ? tf('dp.folha.nenhumaFolha', 'Nenhuma folha nesta competência. Use Calcular pelos dados — o sistema lê embarques, dobras, folgas e férias.')
              : tituloEdicao}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <FiSend className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tf('dp.folha.enviarAprovacao', 'Enviar para aprovação')}</span>
          </button>

          <span className="text-[10px] text-gray-400 ml-auto hidden md:inline">
            {statusWk?.ultimoEvento
              ? `${tf('dp.folha.ultimaSync', 'Última sync')}: ${formatDataBR(statusWk.ultimoEvento.em)}`
              : tf('dp.folha.nuncaSincronizado', 'Nunca sincronizado')}
          </span>
        </div>
      </div>

      {/* 422 — códigos WK sem mapeamento */}
      {codigosNaoMapeados.length > 0 && (
        <div className="p-4 rounded-xl border border-red-300 bg-red-50 space-y-2 shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-red-900">
            <FiXCircle className="w-4 h-4" />
            {tf('dp.folha.codigosNaoMapeadosTitulo', 'Códigos WK sem rubrica mapeada')}
          </div>
          <p className="text-xs text-red-800">
            {tf('dp.folha.codigosNaoMapeadosDescricao', 'A sincronização foi abortada. Mapeie os códigos abaixo na tela de rubricas (campo Código WK) e reexecute.')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {codigosNaoMapeados.map((codigo) => (
              <span key={codigo} className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-white border border-red-300 text-red-900 font-mono">
                {codigo}
              </span>
            ))}
          </div>
          <Link
            href="/folha-pagamento"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            {tf('dp.folha.mapearRubricas', 'Mapear rubricas')}
          </Link>
        </div>
      )}

      {/* Pendências de CPF (GT sem vínculo na folha) */}
      {syncModulos && (
        <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-2 shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <FiAlertTriangle className="w-4 h-4 text-amber-500" />
            {tf('dp.folha.pendenciasTitulo', 'Pendências de CPF (colaboradores GT sem vínculo na folha)')}
          </div>
          {(syncModulos.pendencias?.length ?? 0) === 0 ? (
            <p className="text-xs text-gray-500">{tf('dp.folha.pendenciasVazio', 'Nenhuma pendência de casamento por CPF.')}</p>
          ) : (
            <ul className="text-xs text-gray-700 space-y-1">
              {syncModulos.pendencias.map((p) => (
                <li key={p.cpf} className="flex flex-wrap gap-2">
                  <span className="font-mono font-bold">{p.cpf}</span>
                  <span className="font-semibold">{p.nome}</span>
                  <span className="text-gray-500">— {p.motivo}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold">
            <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">
              {tf('dp.folha.origemLancamentos', 'Lançamentos na folha')}: {competenciaAtualStatus?.itensWk ?? 0} WK · {competenciaAtualStatus?.itensGt ?? 0} {tf('dp.folha.origemGt', 'Interno')} · {competenciaAtualStatus?.itensManual ?? 0} {tf('dp.folha.origemManual', 'Manual')}
            </span>
            {syncModulos.descartadosPrecedencia > 0 && (
              <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                {syncModulos.descartadosPrecedencia} {tf('dp.folha.descartadosPrecedencia', 'descartados por precedência WK')}
              </span>
            )}
          </div>
          {avisosSync.length > 0 && (
            <div className="pt-1 text-[11px] text-gray-600">
              <span className="font-bold">{tf('dp.folha.avisosTitulo', 'Avisos da sincronização')}:</span>
              <ul className="list-disc list-inside">
                {avisosSync.map((aviso, i) => <li key={i}>{aviso}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sheet da competência */}
      {!sheet ? (
        <div className="p-6 rounded-xl border border-dashed border-gray-300 bg-white text-xs text-gray-500 text-center shrink-0">
          {tf('dp.folha.nenhumaFolha', 'Nenhuma folha nesta competência. Use Calcular pelos dados — o sistema lê embarques, dobras, folgas e férias.')}
        </div>
      ) : (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                {tf('dp.folha.statusFolha', 'Status da folha')} · {String(sheet.reference_month).padStart(2, '0')}/{sheet.reference_year}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_CLASS[sheet.status] || 'bg-gray-100 text-gray-700'}`}>
                {t(STATUS_LABEL_KEY[sheet.status] || 'dp.folha.statusDraft', 'Rascunho')}
              </span>
            </div>
            {estadoAprovacao && (
              <div className="flex items-center gap-2 text-xs">
                {estadoAprovacao.rejeicao ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                    <FiXCircle className="w-3.5 h-3.5" />
                    {tf('dp.folha.rejeitada', 'Rejeitada')}
                    {estadoAprovacao.rejeicao.motivo ? ` — ${estadoAprovacao.rejeicao.motivo}` : ''}
                  </span>
                ) : estadoAprovacao.aprovado ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    <FiCheckCircle className="w-3.5 h-3.5" />
                    {tf('dp.folha.statusApproved', 'Aprovada')}
                  </span>
                ) : (
                  <span className="text-gray-600 font-semibold">
                    {tf('dp.folha.aprovacaoTitulo', 'Aprovação')}: {estadoAprovacao.assinados}/{estadoAprovacao.obrigatorios} {tf('dp.folha.assinaturasProgresso', 'assinaturas')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setModalAprovacaoAberto(true)}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                >
                  {tf('dp.folha.abrirPainelAprovacao', 'Abrir painel de aprovação')}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
            <div className="p-2 rounded-lg border border-gray-200 bg-slate-50">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">{tf('dp.folha.totalColaboradores', 'Colaboradores')}</span>
              <span className="text-base font-black text-gray-900">{sheet.total_employees ?? '—'}</span>
            </div>
            <div className="p-2 rounded-lg border border-blue-100 bg-blue-50">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">{tf('dp.folha.brutos', 'Bruto')}</span>
              <span className="text-base font-black text-blue-900">{formatBRL(sheet.total_gross)}</span>
            </div>
            <div className="p-2 rounded-lg border border-red-100 bg-red-50">
              <span className="text-[10px] font-bold text-red-700 uppercase block">{tf('dp.folha.descontos', 'Descontos')}</span>
              <span className="text-base font-black text-red-900">{formatBRL(sheet.total_deductions)}</span>
            </div>
            <div className="p-2 rounded-lg border border-emerald-100 bg-emerald-50">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">{tf('dp.folha.liquidos', 'Líquido')}</span>
              <span className="text-base font-black text-emerald-900">{formatBRL(sheet.total_net)}</span>
            </div>
            <div className="p-2 rounded-lg border border-gray-200 bg-gray-50">
              <span className="text-[10px] font-bold text-gray-600 uppercase block">INSS / IRRF</span>
              <span className="text-sm font-black text-gray-900">{formatBRL(sheet.total_inss)} / {formatBRL(sheet.total_irrf)}</span>
            </div>
            <div className="p-2 rounded-lg border border-yellow-100 bg-yellow-50">
              <span className="text-[10px] font-bold text-yellow-800 uppercase block">FGTS</span>
              <span className="text-base font-black text-yellow-900">{formatBRL(sheet.total_fgts)}</span>
            </div>
          </div>
        </div>
      )}


      {relatorio && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">{tf('dp.folha.relatorioTitulo', 'Relatório da competência')}</h3>
            <span className="text-[11px] font-semibold text-gray-600">
              {relatorio.totais.colaboradores} {tf('dp.folha.totalColaboradores', 'Colaboradores')}
              {' · '}{tf('dp.folha.brutos', 'Bruto')} {formatBRL(relatorio.totais.bruto)}
              {' · '}{tf('dp.folha.liquidos', 'Líquido')} {formatBRL(relatorio.totais.liquido)}
            </span>
          </div>
          {relatorio.colaboradores.length === 0 ? (
            <p className="p-6 text-xs text-gray-500 text-center">
              {tf('dp.folha.relatorioVazio', 'Nenhum embarque, dobra, folga ou férias nesta competência.')}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {relatorio.centros.map((centro) => (
                <section key={centro.centroCusto}>
                  <div className="px-4 py-2 bg-slate-50 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="font-black text-gray-900 uppercase">{centro.centroCusto}</span>
                    <span className="text-gray-600">{centro.colaboradores} {tf('dp.folha.totalColaboradores', 'Colaboradores')}</span>
                    <span className="text-gray-600">{tf('dp.folha.diasEmbarque', 'Embarque')} {centro.diasEmbarcado}</span>
                    <span className="text-gray-600">{tf('dp.folha.diasDobra', 'Dobra')} {centro.diasDobra}</span>
                    <span className="text-gray-600">{tf('dp.folha.diasFolga', 'Folga')} {centro.diasFolga}</span>
                    <span className="text-gray-600">{tf('dp.folha.diasFi', 'FI')} {centro.diasFolgaIndenizada}</span>
                    <span className="text-gray-600">{tf('dp.folha.diasFerias', 'Férias')} {centro.diasFerias}</span>
                    <span className="ml-auto font-bold text-blue-900">{formatBRL(centro.bruto)}</span>
                    <span className="font-black text-emerald-800">{formatBRL(centro.liquido)}</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {relatorio.colaboradores.filter((c) => c.centroCusto === centro.centroCusto).map((c) => {
                      const aberto = expandidos.has(c.employeeId);
                      return (
                        <li key={c.employeeId}>
                          <button
                            type="button"
                            onClick={() => toggleExpandido(c.employeeId)}
                            className="w-full flex flex-wrap items-center gap-2 px-4 py-2 hover:bg-blue-50/40 transition text-left"
                          >
                            <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${aberto ? '' : '-rotate-90'}`} />
                            <span className="text-xs font-bold text-gray-900 min-w-[140px]">{c.nome}</span>
                            <span className="text-[10px] text-gray-500 tabular-nums">
                              {tf('dp.folha.diasEmbarque', 'Embarque')} {c.diasEmbarcado}
                              {' · '}{tf('dp.folha.diasDobra', 'Dobra')} {c.diasDobra}
                              {' · '}{tf('dp.folha.diasFolga', 'Folga')} {c.diasFolga}
                              {' · '}{tf('dp.folha.diasFi', 'FI')} {c.diasFolgaIndenizada}
                              {' · '}{tf('dp.folha.diasFerias', 'Férias')} {c.diasFerias}
                            </span>
                            <span className="ml-auto text-xs font-black text-emerald-700">{formatBRL(c.liquido)}</span>
                          </button>
                          {aberto && (
                            <div className="px-4 pb-3 text-[11px] text-gray-600">
                              <p className="mb-1">
                                {tf('dp.folha.brutos', 'Bruto')} {formatBRL(c.bruto)}
                                {' · '}INSS {formatBRL(c.inss)}
                                {' · '}IRRF {formatBRL(c.irrf)}
                                {' · '}FGTS {formatBRL(c.fgts)}
                                {' · '}{tf('dp.folha.liquidos', 'Líquido')} {formatBRL(c.liquido)}
                              </p>
                              {c.itens.length > 0 && (
                                <table className="w-full text-left">
                                  <tbody className="divide-y divide-gray-50">
                                    {c.itens.map((item) => (
                                      <tr key={`${c.employeeId}-${item.code}-${item.name}`}>
                                        <td className="py-1 pr-2 font-mono font-bold text-gray-800">{item.code}</td>
                                        <td className="py-1 pr-2 text-gray-700">{item.name}</td>
                                        <td className="py-1 pr-2 text-right tabular-nums">{item.quantity}</td>
                                        <td className="py-1 text-right tabular-nums font-bold text-gray-900">{formatBRL(item.valor)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview por colaborador (resultado do cálculo) */}
      {calculo && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">{tf('dp.folha.previewTitulo', 'Preview por colaborador')}</h3>
          </div>
          <div className={calculo.results.length === 0 ? 'p-6 text-xs text-gray-500 text-center' : ''}>
            {calculo.results.length === 0 ? (
              tf('dp.folha.previewVazio', 'Calcule a folha para ver o preview por colaborador.')
            ) : (
              <ul className="divide-y divide-gray-100">
                {calculo.results.map((r) => {
                  const f = funcionariosPorId.get(r.employeeId);
                  const aberto = expandidos.has(r.employeeId);
                  return (
                    <li key={r.employeeId}>
                      <button
                        type="button"
                        onClick={() => toggleExpandido(r.employeeId)}
                        className="w-full flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-blue-50/40 transition text-left"
                      >
                        <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${aberto ? '' : '-rotate-90'}`} />
                        <span className="text-xs font-bold text-gray-900 min-w-[160px]">{f?.name || r.employeeId.slice(0, 8)}</span>
                        <span className="text-[11px] font-mono text-gray-500">{f?.cpf || '—'}</span>
                        <span className="ml-auto text-[11px] text-gray-600 font-semibold">
                          {r.items.length} {tf('dp.folha.rubricas', 'rubricas')}
                        </span>
                        <span className="text-xs font-black text-emerald-700">{formatBRL(r.netSalary)}</span>
                      </button>
                      {aberto && (
                        <div className="px-4 pb-3">
                          <table className="w-full text-left text-[11px]">
                            <thead className="text-gray-500 uppercase font-bold">
                              <tr>
                                <th className="py-1 pr-2">Cód.</th>
                                <th className="py-1 pr-2">{tf('dp.folha.nome', 'Nome')}</th>
                                <th className="py-1 pr-2">Tipo</th>
                                <th className="py-1 pr-2 text-right">{tf('dp.folha.quantidade', 'Qtd')}</th>
                                <th className="py-1 pr-2 text-right">{tf('dp.folha.valorReferencia', 'Ref.')}</th>
                                <th className="py-1 pr-2 text-right">{tf('dp.folha.valorCalculado', 'Valor')}</th>
                                <th className="py-1">{tf('dp.folha.origemLancamentos', 'Lançamentos na folha')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {r.items.map((item) => (
                                <tr key={`${r.employeeId}-${item.codeId}-${item.code}`}>
                                  <td className="py-1 pr-2 font-mono font-bold text-gray-800">{item.code}</td>
                                  <td className="py-1 pr-2 text-gray-700">{item.name}</td>
                                  <td className="py-1 pr-2">
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      item.type === 'provento' ? 'bg-emerald-50 text-emerald-700'
                                        : item.type === 'desconto' ? 'bg-red-50 text-red-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {item.type}
                                    </span>
                                  </td>
                                  <td className="py-1 pr-2 text-right tabular-nums text-gray-700">{item.quantity}</td>
                                  <td className="py-1 pr-2 text-right tabular-nums text-gray-500">{formatBRL(item.referenceValue)}</td>
                                  <td className="py-1 pr-2 text-right tabular-nums font-bold text-gray-900">{formatBRL(item.calculatedValue)}</td>
                                  <td className="py-1">
                                    {item.origem && (
                                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${ORIGEM_CLASS[item.origem] || 'bg-gray-100 text-gray-700'}`}>
                                        {item.origem === 'wk' ? tf('dp.folha.origemWk', 'WK')
                                          : item.origem === 'gt' ? tf('dp.folha.origemGt', 'Interno')
                                            : tf('dp.folha.origemManual', 'Manual')}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Colaboradores WK (paginado) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs shrink-0">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">{tf('dp.folha.colaboradoresWkTitulo', 'Colaboradores WK Radar')}</h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => carregarColaboradoresWk(colabWkPage - 1, companyId, centroCustoId)}
              disabled={colabWkPage <= 1 || colabWkCarregando}
              className="p-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              title={tf('dp.folha.anterior', 'Anterior')}
            >
              <FiChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
              {t('dp.folha.paginaDe', { page: colabWkPage, totalPages: colabWkTotalPages, total: colabWkTotal }, `Página ${colabWkPage} de ${colabWkTotalPages} · ${colabWkTotal} colaboradores`)}
            </span>
            <button
              type="button"
              onClick={() => carregarColaboradoresWk(colabWkPage + 1, companyId, centroCustoId)}
              disabled={colabWkPage >= colabWkTotalPages || colabWkCarregando}
              className="p-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              title={tf('dp.folha.proxima', 'Próxima')}
            >
              <FiChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">{tf('dp.folha.matricula', 'Matrícula')}</th>
                <th className="px-4 py-2.5">{tf('dp.folha.nome', 'Nome')}</th>
                <th className="px-4 py-2.5">CPF</th>
                <th className="px-4 py-2.5">{tf('dp.folha.cargo', 'Cargo')}</th>
                <th className="px-4 py-2.5 text-right">{tf('dp.folha.salarioBase', 'Salário base')}</th>
                <th className="px-4 py-2.5">{tf('dp.folha.situacao', 'Situação')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {colabWk.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    {colabWkCarregando ? '…' : tf('dp.folha.colaboradoresWkVazio', 'Nenhum colaborador sincronizado do WK ainda.')}
                  </td>
                </tr>
              ) : (
                colabWk.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/40 transition">
                    <td className="px-4 py-2 font-mono font-bold text-gray-900">
                      <span className="inline-flex items-center gap-1.5">
                        {c.registration_number || '—'}
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">WK</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{c.name}</td>
                    <td className="px-4 py-2 font-mono text-gray-500">{c.cpf || '—'}</td>
                    <td className="px-4 py-2 text-gray-700">{c.position || '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-900 font-semibold">{formatBRL(c.base_salary)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        c.status === 'active' ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'terminated' ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de aprovação (contrato: props exatas) */}
      <AprovacaoFolhaModal
        open={modalAprovacaoAberto}
        onClose={() => setModalAprovacaoAberto(false)}
        sheetId={sheet?.id || ''}
        sheetLabel={sheet ? `${String(sheet.reference_month).padStart(2, '0')}/${sheet.reference_year}` : undefined}
        onResultado={aoResultadoAprovacao}
      />
    </div>
  );
}
