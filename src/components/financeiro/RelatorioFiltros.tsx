'use client';

/**
 * Filtros compartilhados dos relatórios da folha (mensal/custos/guias):
 * empresa (GET /api/payroll/companies), competência mês/ano e departamento
 * opcional (GET /api/payroll/departments?companyId=). Nenhuma empresa é
 * hardcoded — tudo vem da API.
 */
import React, { useEffect, useState } from 'react';
import { FiLoader, FiPlay } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { FIN_BTN_PRIMARY_CLASS, FIN_CARD_CLASS, FIN_INPUT_CLASS } from './shared';

export interface FiltroRelatorio {
  companyId: string;
  mes: number;
  ano: number;
  departmentId: string;
}

interface EmpresaOption {
  id: string;
  name: string;
}

interface DepartamentoOption {
  id: string;
  name: string;
}

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function RelatorioFiltros({
  aoGerar,
  carregando,
}: {
  aoGerar: (filtro: FiltroRelatorio) => void;
  carregando: boolean;
}) {
  const { t } = useI18n();
  const agora = new Date();
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithToken('/api/payroll/companies?limit=100&isActive=true');
        const body = await res.json();
        if (!res.ok || body?.success === false) throw new Error(body?.error);
        setEmpresas((body?.data ?? []) as EmpresaOption[]);
      } catch {
        toast.error(t('payroll.relatorioErroEmpresas', 'Erro ao carregar empresas'));
      }
    })();
  }, [t]);

  useEffect(() => {
    setDepartmentId('');
    setDepartamentos([]);
    if (!companyId) return;
    (async () => {
      try {
        const res = await fetchWithToken(`/api/payroll/departments?companyId=${companyId}&isActive=true`);
        const body = await res.json();
        if (!res.ok || body?.success === false) throw new Error(body?.error);
        setDepartamentos((body?.data ?? []) as DepartamentoOption[]);
      } catch {
        toast.error(t('payroll.relatorioErroDepartamentos', 'Erro ao carregar departamentos'));
      }
    })();
  }, [companyId, t]);

  const gerar = () => {
    if (!companyId) {
      toast.error(t('payroll.relatorioSelecioneEmpresa', 'Selecione uma empresa'));
      return;
    }
    aoGerar({ companyId, mes, ano, departmentId });
  };

  return (
    <div className={`${FIN_CARD_CLASS} p-4`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
            {t('payroll.company', 'Empresa')} *
          </span>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={FIN_INPUT_CLASS}>
            <option value="">{t('payroll.relatorioSelecioneEmpresa', 'Selecione uma empresa')}</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
            {t('payroll.department', 'Departamento')}
          </span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            disabled={!companyId}
            className={FIN_INPUT_CLASS}
          >
            <option value="">{t('payroll.todosDepartamentos', 'Todos')}</option>
            {departamentos.map((dep) => (
              <option key={dep.id} value={dep.id}>{dep.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
            {t('payroll.month', 'Mês')}
          </span>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={FIN_INPUT_CLASS}>
            {MESES.map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
            {t('payroll.year', 'Ano')}
          </span>
          <input
            type="number"
            min={2024}
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className={FIN_INPUT_CLASS}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={gerar} disabled={carregando} className={FIN_BTN_PRIMARY_CLASS}>
          {carregando ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlay className="h-4 w-4" />}
          {t('payroll.gerarRelatorio', 'Gerar relatório')}
        </button>
      </div>
    </div>
  );
}
