'use client';

/**
 * Perfis de cálculo (payroll_calculation_profiles). O motor lê o rules JSONB
 * do perfil default da empresa (calculate + relatório operacional):
 * { inss/irrf/fgts: {enabled}, vale_transporte: {percentage, max_percentage_salary} }.
 * API: GET/PUT /api/payroll/profiles. Edição gated por folha.edit.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiEdit2, FiLoader, FiPlus, FiSettings, FiX } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  FinChip,
} from '@/components/financeiro/shared';

interface PerfilRow {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  rules: Record<string, unknown> | null;
  is_default: boolean;
  is_active: boolean;
}

interface EmpresaOption {
  id: string;
  name: string;
}

interface RegrasForm {
  inss: boolean;
  irrf: boolean;
  fgts: boolean;
  vtEnabled: boolean;
  vtPercentage: string;
  vtMaxPercentage: string;
}

interface PerfilForm {
  name: string;
  description: string;
  companyId: string;
  isDefault: boolean;
  isActive: boolean;
  regras: RegrasForm;
}

function regrasDeRules(rules: Record<string, unknown> | null): RegrasForm {
  const vt = (rules?.['vale_transporte'] ?? {}) as Record<string, unknown>;
  return {
    inss: (rules?.['inss'] as Record<string, unknown> | undefined)?.enabled !== false,
    irrf: (rules?.['irrf'] as Record<string, unknown> | undefined)?.enabled !== false,
    fgts: (rules?.['fgts'] as Record<string, unknown> | undefined)?.enabled !== false,
    vtEnabled: vt.enabled !== false,
    vtPercentage: String(vt.percentage ?? 6),
    vtMaxPercentage: String(vt.max_percentage_salary ?? 20),
  };
}

const FORM_VAZIO: PerfilForm = {
  name: '',
  description: '',
  companyId: '',
  isDefault: false,
  isActive: true,
  regras: { inss: true, irrf: true, fgts: true, vtEnabled: true, vtPercentage: '6', vtMaxPercentage: '20' },
};

export default function PerfisCalculoPage() {
  const { t } = useI18n();
  const { hasFeature } = useSupabaseAuth();
  const podeEditar = hasFeature('folha.edit');

  const [perfis, setPerfis] = useState<PerfilRow[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<PerfilRow | null>(null);
  const [form, setForm] = useState<PerfilForm>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const nomeEmpresa = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const emp of empresas) mapa[emp.id] = emp.name;
    return mapa;
  }, [empresas]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [resPerfis, resEmpresas] = await Promise.all([
        fetchWithToken('/api/payroll/profiles'),
        fetchWithToken('/api/payroll/companies?limit=100&isActive=true'),
      ]);
      const bodyPerfis = await resPerfis.json();
      const bodyEmpresas = await resEmpresas.json();
      if (!resPerfis.ok || bodyPerfis?.success === false) throw new Error(bodyPerfis?.error);
      setPerfis((bodyPerfis?.data ?? []) as PerfilRow[]);
      setEmpresas((bodyEmpresas?.data ?? []) as EmpresaOption[]);
    } catch {
      toast.error(t('payroll.perfisErroCarregar', 'Erro ao carregar perfis de cálculo'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirCriar = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  };

  const abrirEditar = (perfil: PerfilRow) => {
    setEditando(perfil);
    setForm({
      name: perfil.name,
      description: perfil.description || '',
      companyId: perfil.company_id,
      isDefault: perfil.is_default,
      isActive: perfil.is_active,
      regras: regrasDeRules(perfil.rules),
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.name.trim() || !form.companyId) {
      toast.error(t('payroll.perfisErroCampos', 'Nome e empresa são obrigatórios'));
      return;
    }
    setSalvando(true);
    try {
      const rules = {
        inss: { enabled: form.regras.inss, type: 'legal' },
        irrf: { enabled: form.regras.irrf, type: 'legal' },
        fgts: { enabled: form.regras.fgts, type: 'legal' },
        vale_transporte: {
          enabled: form.regras.vtEnabled,
          percentage: Number(form.regras.vtPercentage) || 0,
          max_percentage_salary: Number(form.regras.vtMaxPercentage) || 0,
        },
      };
      const res = await fetchWithToken('/api/payroll/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editando?.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          companyId: form.companyId,
          rules,
          isDefault: form.isDefault,
          isActive: form.isActive,
        }),
      });
      const body = await res.json();
      if (!res.ok || body?.success === false) throw new Error(body?.error);
      toast.success(t('financeiro.sucessoSalvar', 'Salvo com sucesso'));
      setModalAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : t('payroll.perfisErroSalvar', 'Erro ao salvar perfil'));
    } finally {
      setSalvando(false);
    }
  };

  const setRegra = (campo: keyof RegrasForm, valor: boolean | string) =>
    setForm((f) => ({ ...f, regras: { ...f.regras, [campo]: valor } }));

  const renderFlag = (ativo: boolean, rotulo: string) => (
    <FinChip tone={ativo ? 'green' : 'gray'}>{rotulo}</FinChip>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/folha-pagamento"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:text-abz-blue"
          title={t('common.back', 'Voltar')}
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <span className="rounded-xl bg-blue-50 p-1.5 text-abz-blue">
          <FiSettings className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900">
            {t('payroll.calculationProfiles', 'Perfis de Cálculo')}
          </h1>
          <p className="text-xs text-gray-500">
            {t('payroll.calculationProfilesDesc', 'Regras de tributos e vale transporte lidas pelo motor de cálculo por empresa')}
          </p>
        </div>
        {podeEditar && (
          <button type="button" onClick={abrirCriar} className={FIN_BTN_PRIMARY_CLASS}>
            <FiPlus className="h-4 w-4" />
            {t('payroll.perfisNovo', 'Novo perfil')}
          </button>
        )}
      </div>

      <div className={`${FIN_CARD_CLASS} overflow-x-auto`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-gray-500">
            <FiLoader className="h-5 w-5 animate-spin" />
          </div>
        ) : perfis.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">
            {t('payroll.perfisVazio', 'Nenhum perfil cadastrado.')}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('financeiro.clienteNome', 'Nome')}</th>
                <th className="px-4 py-2">{t('payroll.company', 'Empresa')}</th>
                <th className="px-4 py-2">{t('payroll.perfisRegras', 'Regras')}</th>
                <th className="px-4 py-2">{t('payroll.perfisStatus', 'Status')}</th>
                {podeEditar && <th className="px-4 py-2 text-right">{t('common.actions', 'Ações')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {perfis.map((perfil) => {
                const regras = regrasDeRules(perfil.rules);
                return (
                  <tr key={perfil.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <p className="font-semibold text-gray-900">{perfil.name}</p>
                      {perfil.description && <p className="text-xs text-gray-500">{perfil.description}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{nomeEmpresa[perfil.company_id] || perfil.company_id}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {renderFlag(regras.inss, 'INSS')}
                        {renderFlag(regras.irrf, 'IRRF')}
                        {renderFlag(regras.fgts, 'FGTS')}
                        {renderFlag(regras.vtEnabled, `VT ${regras.vtPercentage}%/${regras.vtMaxPercentage}%`)}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {perfil.is_default && <FinChip tone="blue">{t('payroll.perfisPadrao', 'Padrão')}</FinChip>}
                        <FinChip tone={perfil.is_active ? 'green' : 'gray'}>
                          {perfil.is_active ? t('fin.ativo', 'Ativo') : t('fin.inativo', 'Inativo')}
                        </FinChip>
                      </div>
                    </td>
                    {podeEditar && (
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => abrirEditar(perfil)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:text-abz-blue"
                          title={t('common.edit', 'Editar')}
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${FIN_CARD_CLASS} w-full max-w-lg p-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editando
                  ? t('payroll.perfisEditar', 'Editar perfil')
                  : t('payroll.perfisNovo', 'Novo perfil')}
              </h2>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-2 text-gray-400 hover:text-gray-600"
                title={t('common.close', 'Fechar')}
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  {t('financeiro.clienteNome', 'Nome')} *
                </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={FIN_INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  {t('payroll.descricao', 'Descrição')}
                </span>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={FIN_INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  {t('payroll.company', 'Empresa')} *
                </span>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                  disabled={!!editando}
                  className={FIN_INPUT_CLASS}
                >
                  <option value="">{t('payroll.relatorioSelecioneEmpresa', 'Selecione uma empresa')}</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </label>

              <fieldset className="rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-xs font-bold uppercase text-gray-500">
                  {t('payroll.perfisTributos', 'Tributos legais')}
                </legend>
                <div className="flex flex-wrap gap-4">
                  {(['inss', 'irrf', 'fgts'] as const).map((campo) => (
                    <label key={campo} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.regras[campo]}
                        onChange={(e) => setRegra(campo, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-abz-blue focus:ring-abz-blue"
                      />
                      {campo.toUpperCase()}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-xs font-bold uppercase text-gray-500">
                  {t('payroll.perfisVT', 'Vale transporte')}
                </legend>
                <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.regras.vtEnabled}
                    onChange={(e) => setRegra('vtEnabled', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-abz-blue focus:ring-abz-blue"
                  />
                  {t('payroll.perfisVTDescontar', 'Descontar vale transporte')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      {t('payroll.perfisVTPercentual', 'Desconto %')}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form.regras.vtPercentage}
                      onChange={(e) => setRegra('vtPercentage', e.target.value)}
                      className={FIN_INPUT_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      {t('payroll.perfisVTTeto', 'Teto % do bruto')}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={form.regras.vtMaxPercentage}
                      onChange={(e) => setRegra('vtMaxPercentage', e.target.value)}
                      className={FIN_INPUT_CLASS}
                    />
                  </label>
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-abz-blue focus:ring-abz-blue"
                  />
                  {t('payroll.perfisPadraoEmpresa', 'Perfil padrão da empresa')}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-abz-blue focus:ring-abz-blue"
                  />
                  {t('fin.ativo', 'Ativo')}
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalAberto(false)} className={FIN_BTN_SECONDARY_CLASS}>
                {t('common.cancel', 'Cancelar')}
              </button>
              <button type="button" onClick={salvar} disabled={salvando} className={FIN_BTN_PRIMARY_CLASS}>
                {salvando && <FiLoader className="h-4 w-4 animate-spin" />}
                {t('common.save', 'Salvar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
