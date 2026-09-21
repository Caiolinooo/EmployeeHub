'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Settings, Plus, Pencil, Power, Search, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { FORMULAS_FOLHA } from '@/lib/payroll/calculations';
import type { PayrollCode, PayrollCodeType, PayrollCalculationType, PayrollLegalType } from '@/types/payroll';

const CHAVES_FORMULA = Object.keys(FORMULAS_FOLHA); // 'dsr' | 'reflexo' | 'reflexo_he'

const TIPOS: Array<{ valor: PayrollCodeType; label: string; cor: string }> = [
  { valor: 'provento', label: 'Provento', cor: 'bg-green-100 text-green-800' },
  { valor: 'desconto', label: 'Desconto', cor: 'bg-red-100 text-red-800' },
  { valor: 'outros', label: 'Outros', cor: 'bg-blue-100 text-blue-800' }
];

const TIPOS_CALCULO: Array<{ valor: PayrollCalculationType; label: string }> = [
  { valor: 'fixed', label: 'Valor fixo' },
  { valor: 'percentage', label: 'Percentual (%)' },
  { valor: 'formula', label: `Fórmula (${CHAVES_FORMULA.join(', ')})` },
  { valor: 'legal', label: 'Legal (INSS/IRRF/FGTS)' }
];

const TIPOS_LEGAL: Array<{ valor: PayrollLegalType; label: string }> = [
  { valor: 'inss', label: 'INSS' },
  { valor: 'irrf', label: 'IRRF' },
  { valor: 'fgts', label: 'FGTS' }
];

interface Formulario {
  code: string;
  type: PayrollCodeType;
  name: string;
  description: string;
  calculationType: PayrollCalculationType;
  value: string;
  formula: string;
  legalType: PayrollLegalType | '';
  codigoWk: string;
  isActive: boolean;
}

const FORMULARIO_VAZIO: Formulario = {
  code: '',
  type: 'provento',
  name: '',
  description: '',
  calculationType: 'fixed',
  value: '0',
  formula: '',
  legalType: '',
  codigoWk: '',
  isActive: true
};

export default function CodigosFolhaPage() {
  const { t } = useI18n();
  const { hasFeature } = useSupabaseAuth();
  const podeEditar = hasFeature('folha.edit');

  const [codes, setCodes] = useState<PayrollCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | PayrollCodeType>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('todos');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<PayrollCode | null>(null);
  const [form, setForm] = useState<Formulario>(FORMULARIO_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithToken('/api/payroll/codes?limit=500');
      const json = await response.json();
      if (json.success) {
        setCodes(json.data || []);
      } else {
        toast.error(json.error || 'Erro ao carregar rubricas');
      }
    } catch {
      toast.error('Erro ao carregar rubricas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return codes.filter((c) => {
      if (filtroTipo !== 'todos' && c.type !== filtroTipo) return false;
      if (filtroAtivo === 'ativos' && !c.isActive) return false;
      if (filtroAtivo === 'inativos' && c.isActive) return false;
      if (!termo) return true;
      return [c.code, c.name, c.description, c.formula, c.codigoWk]
        .some((campo) => String(campo || '').toLowerCase().includes(termo));
    });
  }, [codes, busca, filtroTipo, filtroAtivo]);

  const abrirCriar = () => {
    setEditando(null);
    setForm(FORMULARIO_VAZIO);
    setModalAberto(true);
  };

  const abrirEditar = (code: PayrollCode) => {
    setEditando(code);
    setForm({
      code: code.code,
      type: code.type,
      name: code.name,
      description: code.description || '',
      calculationType: code.calculationType,
      value: String(code.value ?? 0),
      formula: code.formula || '',
      legalType: code.legalType || '',
      codigoWk: code.codigoWk || '',
      isActive: code.isActive
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Código e nome são obrigatórios');
      return;
    }
    if (form.calculationType === 'formula' && form.formula && !CHAVES_FORMULA.includes(form.formula)) {
      toast.error(`Fórmula inválida. Use: ${CHAVES_FORMULA.join(', ')}`);
      return;
    }
    setSalvando(true);
    try {
      const corpo = {
        code: form.code.trim(),
        type: form.type,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        calculationType: form.calculationType,
        value: parseFloat(form.value) || 0,
        formula: form.calculationType === 'formula' && form.formula ? form.formula : undefined,
        legalType: form.calculationType === 'legal' && form.legalType ? form.legalType : undefined,
        codigoWk: form.codigoWk.trim() || null,
        isActive: form.isActive
      };
      const response = editando
        ? await fetchWithToken(`/api/payroll/codes/${editando.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo)
          })
        : await fetchWithToken('/api/payroll/codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo)
          });
      const json = await response.json();
      if (json.success) {
        toast.success(editando ? 'Rubrica atualizada com sucesso' : 'Rubrica criada com sucesso');
        setModalAberto(false);
        carregar();
      } else {
        toast.error(json.error || 'Erro ao salvar rubrica');
      }
    } catch {
      toast.error('Erro ao salvar rubrica');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (code: PayrollCode) => {
    try {
      const response = code.isActive
        ? await fetchWithToken(`/api/payroll/codes/${code.id}`, { method: 'DELETE' })
        : await fetchWithToken(`/api/payroll/codes/${code.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true })
          });
      const json = await response.json();
      if (json.success) {
        toast.success(json.message || (code.isActive ? 'Rubrica desativada' : 'Rubrica ativada'));
        carregar();
      } else {
        toast.error(json.error || 'Erro ao alterar rubrica');
      }
    } catch {
      toast.error('Erro ao alterar rubrica');
    }
  };

  const labelValor = (c: PayrollCode) => {
    if (c.calculationType === 'percentage') return `${c.value}%`;
    if (c.calculationType === 'legal') return c.legalType?.toUpperCase() || '—';
    if (c.calculationType === 'formula') return c.formula || '—';
    return c.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                href="/folha-pagamento"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title={t('common.back', 'Voltar')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="p-2 bg-abz-blue/10 rounded-lg">
                <Settings className="h-6 w-6 text-abz-blue" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-abz-text-dark">
                  {t('payroll.payrollCodes', 'Códigos de Folha')}
                </h1>
                <p className="text-gray-600">
                  Configure as rubricas de proventos, descontos e eventos da folha
                </p>
              </div>
            </div>
            <button
              onClick={abrirCriar}
              disabled={!podeEditar}
              title={podeEditar ? undefined : 'Sem permissão folha.edit'}
              className="flex items-center gap-2 bg-abz-blue text-white px-4 py-2 rounded-md hover:bg-abz-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Nova Rubrica
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por código, nome, descrição, fórmula ou código WK..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
              />
            </div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
            >
              <option value="todos">Todos os tipos</option>
              {TIPOS.map((t2) => (
                <option key={t2.valor} value={t2.valor}>{t2.label}</option>
              ))}
            </select>
            <select
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value as typeof filtroAtivo)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
            >
              <option value="todos">Ativos e inativos</option>
              <option value="ativos">Somente ativos</option>
              <option value="inativos">Somente inativos</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando rubricas...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma rubrica encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cálculo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cód. WK</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Situação</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtrados.map((c) => (
                    <tr key={c.id} className={`hover:bg-gray-50 ${!c.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{c.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{c.name}</div>
                        {c.description && (
                          <div className="text-xs text-gray-500">{c.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPOS.find((t2) => t2.valor === c.type)?.cor || 'bg-gray-100 text-gray-800'}`}>
                          {TIPOS.find((t2) => t2.valor === c.type)?.label || c.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{labelValor(c)}</td>
                      <td className="px-4 py-3 text-sm">
                        {c.codigoWk ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-xs">{c.codigoWk}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {c.isActive ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirEditar(c)}
                            disabled={!podeEditar}
                            title={podeEditar ? 'Editar' : 'Sem permissão folha.edit'}
                            className="p-1.5 text-gray-400 hover:text-abz-blue hover:bg-abz-blue/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => alternarAtivo(c)}
                            disabled={!podeEditar}
                            title={podeEditar ? (c.isActive ? 'Desativar' : 'Reativar') : 'Sem permissão folha.edit'}
                            className={`p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${c.isActive ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
                {filtrados.length} de {codes.length} rubrica(s)
              </div>
            </div>
          )}
        </div>
        {!podeEditar && (
          <p className="mt-3 text-xs text-gray-500">
            Você possui apenas permissão de visualização (folha.view). Edição requer folha.edit.
          </p>
        )}
      </div>

      {/* Modal de formulário */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-abz-text-dark">
                {editando ? `Editar rubrica ${editando.code}` : 'Nova rubrica'}
              </h2>
              <button
                onClick={() => setModalAberto(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  maxLength={10}
                  disabled={!!editando}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                />
                {editando && (
                  <p className="mt-1 text-xs text-gray-500">Código/tipo imutáveis quando há itens lançados na folha.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as PayrollCodeType })}
                  disabled={!!editando}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {TIPOS.map((t2) => (
                    <option key={t2.valor} value={t2.valor}>{t2.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de cálculo</label>
                <select
                  value={form.calculationType}
                  onChange={(e) => setForm({ ...form, calculationType: e.target.value as PayrollCalculationType })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                >
                  {TIPOS_CALCULO.map((t2) => (
                    <option key={t2.valor} value={t2.valor}>{t2.label}</option>
                  ))}
                </select>
              </div>
              {form.calculationType === 'legal' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rubrica legal</label>
                  <select
                    value={form.legalType}
                    onChange={(e) => setForm({ ...form, legalType: e.target.value as PayrollLegalType | '' })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                  >
                    <option value="">—</option>
                    {TIPOS_LEGAL.map((t2) => (
                      <option key={t2.valor} value={t2.valor}>{t2.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {form.calculationType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    disabled={form.calculationType === 'formula'}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-abz-blue focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              )}
              {form.calculationType === 'formula' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fórmula</label>
                  <input
                    type="text"
                    list="chaves-formula-folha"
                    value={form.formula}
                    onChange={(e) => setForm({ ...form, formula: e.target.value })}
                    placeholder={`Ex.: ${CHAVES_FORMULA[0]}`}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                  />
                  <datalist id="chaves-formula-folha">
                    {CHAVES_FORMULA.map((chave) => (
                      <option key={chave} value={chave} />
                    ))}
                  </datalist>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Código WK Radar</label>
                <input
                  type="text"
                  value={form.codigoWk}
                  onChange={(e) => setForm({ ...form, codigoWk: e.target.value })}
                  placeholder="Código equivalente no WK Radar (mapeamento do sync)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Usado pelo sync WK: lançamentos com este código caem nesta rubrica. Único entre rubricas.
                </p>
              </div>
              <div className="sm:col-span-2 flex items-center">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
                  />
                  Rubrica ativa
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="px-4 py-2 text-sm text-white bg-abz-blue rounded-md hover:bg-abz-blue-dark transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
