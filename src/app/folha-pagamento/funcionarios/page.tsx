'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiUsers } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import EmployeeList from '@/components/payroll/EmployeeList';

interface EmpresaOption {
  id: string;
  name: string;
}

/**
 * Funcionários da folha (`payroll_employees`). Sem redirect para o hub.
 */
export default function PayrollEmployeesPage() {
  const { t } = useI18n();
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        setCarregando(true);
        const res = await fetchWithToken('/api/payroll/companies?limit=100');
        const json = await res.json();
        if (cancelado) return;
        if (json.success && Array.isArray(json.data)) {
          const lista: EmpresaOption[] = json.data.map((row: { id: string; name: string }) => ({
            id: row.id,
            name: row.name,
          }));
          setEmpresas(lista);
          if (lista.length > 0) setEmpresaId(lista[0].id);
        } else {
          setEmpresas([]);
        }
      } catch {
        if (!cancelado) setEmpresas([]);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/folha-pagamento?tab=folhas"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:text-abz-blue"
          title={t('common.back', 'Voltar')}
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <span className="rounded-xl bg-blue-50 p-1.5 text-abz-blue">
          <FiUsers className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-black text-gray-900">
            {t('payroll.manageEmployees', 'Funcionários')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('financeiro.folhasDescricao', 'Competências, cálculo e aprovação da folha')}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('payroll.company', 'Empresa')}
        </label>
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          disabled={carregando || empresas.length === 0}
          className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-abz-blue focus:outline-none focus:ring-2 focus:ring-abz-blue"
        >
          {empresas.length === 0 && (
            <option value="">{carregando ? 'Carregando…' : 'Nenhuma empresa'}</option>
          )}
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.name}
            </option>
          ))}
        </select>
      </div>

      {empresas.length === 0 && !carregando ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">Nenhuma empresa cadastrada.</p>
          <Link
            href="/folha-pagamento/empresas"
            className="mt-3 inline-flex text-sm font-semibold text-abz-blue hover:underline"
          >
            {t('payroll.manageCompanies', 'Cadastrar empresa')}
          </Link>
        </div>
      ) : (
        <EmployeeList companyId={empresaId || undefined} />
      )}
    </div>
  );
}
