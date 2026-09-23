'use client';

/**
 * Aba Empresas (design §4) — CRUD de payroll_companies (empresa emissora)
 * via /api/payroll/companies (contrato {success,data,error}).
 * Modal com todos os campos fiscais da migration 20260923_000001:
 * razão social, IM/IE, endereço estruturado e CNAE.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FiBriefcase, FiEdit2, FiFolder, FiLoader, FiPlus, FiSearch, FiTrash2, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
} from '@/components/financeiro/shared';

/** Linha de payroll_companies (snake_case, como vem do banco). */
interface EmpresaRow {
  id: string;
  name: string;
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
  municipio_ibge?: string | null;
  cnae_principal?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
  is_active: boolean;
}

interface EmpresaFormState {
  name: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_municipal: string;
  inscricao_estadual: string;
  cnae_principal: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  municipio_ibge: string;
  phone: string;
  email: string;
  contact_person: string;
  is_active: boolean;
}

function empresaFormVazio(): EmpresaFormState {
  return {
    name: '',
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    inscricao_municipal: '',
    inscricao_estadual: '',
    cnae_principal: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    municipio: '',
    uf: '',
    municipio_ibge: '',
    phone: '',
    email: '',
    contact_person: '',
    is_active: true,
  };
}

function empresaParaForm(empresa: EmpresaRow): EmpresaFormState {
  const vazio = empresaFormVazio();
  const resultado = { ...vazio };
  for (const chave of Object.keys(vazio) as Array<keyof EmpresaFormState>) {
    if (chave === 'is_active') {
      resultado.is_active = empresa.is_active !== false;
    } else {
      const bruto = empresa[chave];
      (resultado[chave] as string) = typeof bruto === 'string' ? bruto : '';
    }
  }
  return resultado;
}

/** Mensagem de erro do contrato {success,error} das rotas payroll. */
function erroDaResposta(body: unknown, fallback: string): string {
  const erro = (body as { error?: string } | null)?.error;
  return typeof erro === 'string' && erro ? erro : fallback;
}

export default function EmpresasTab() {
  const { t } = useI18n();
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<EmpresaRow | null>(null);
  const [form, setForm] = useState<EmpresaFormState>(empresaFormVazio());
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (busca.trim()) params.set('name', busca.trim());
      const res = await fetchWithToken(`/api/payroll/companies?${params.toString()}`);
      const body = await res.json();
      if (!res.ok || body?.success === false) throw new Error(erroDaResposta(body, t('financeiro.erroGeral')));
      setEmpresas((body?.data ?? []) as EmpresaRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('financeiro.erroGeral'));
    } finally {
      setCarregando(false);
    }
  }, [busca, t]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function set(campo: keyof EmpresaFormState, conteudo: string | boolean) {
    setForm((atual) => ({ ...atual, [campo]: conteudo }));
  }

  function abrirNovo() {
    setEditando(null);
    setForm(empresaFormVazio());
    setModalAberto(true);
  }

  function abrirEdicao(empresa: EmpresaRow) {
    setEditando(empresa);
    setForm(empresaParaForm(empresa));
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.name.trim() || !form.cnpj.trim()) {
      toast.error(t('fin.erroNomeCnpj'));
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        name: form.name.trim(),
        cnpj: form.cnpj.trim(),
        // Legado camelCase do PayrollCompanyForm
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        contactPerson: form.contact_person.trim() || undefined,
        isActive: form.is_active,
        // Fiscais snake_case (migration 20260923_000001)
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia,
        inscricao_municipal: form.inscricao_municipal,
        inscricao_estadual: form.inscricao_estadual,
        cnae_principal: form.cnae_principal,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cep: form.cep,
        municipio: form.municipio,
        uf: form.uf,
        municipio_ibge: form.municipio_ibge,
      };
      const url = editando ? `/api/payroll/companies/${editando.id}` : '/api/payroll/companies';
      const res = await fetchWithToken(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || body?.success === false) throw new Error(erroDaResposta(body, t('financeiro.erroSalvar')));
      toast.success(t('financeiro.sucessoSalvar'));
      setModalAberto(false);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('financeiro.erroSalvar'));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(empresa: EmpresaRow) {
    if (!window.confirm(t('fin.confirmarExcluirEmpresa'))) return;
    try {
      const res = await fetchWithToken(`/api/payroll/companies/${empresa.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok || body?.success === false) throw new Error(erroDaResposta(body, t('financeiro.erroGeral')));
      toast.success(t('financeiro.sucessoSalvar'));
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('financeiro.erroGeral'));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Barra de filtros */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t('fin.buscarEmpresa')}
            className={`${FIN_INPUT_CLASS} pl-9`}
          />
        </div>
        <button type="button" onClick={abrirNovo} className={FIN_BTN_PRIMARY_CLASS}>
          <FiPlus className="h-4 w-4" /> {t('fin.novaEmpresa')}
        </button>
      </div>

      {/* Tabela */}
      <div className={`${FIN_CARD_CLASS} min-h-0 flex-1 overflow-auto`}>
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500 dark:text-gray-400">
            <FiLoader className="h-5 w-5 animate-spin text-abz-blue" /> {t('financeiro.carregando')}
          </div>
        ) : empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-sm text-gray-400 dark:text-gray-500">
            <FiFolder className="h-8 w-8" /> {t('fin.nenhumaEmpresa')}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.clienteNome')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.cnpj')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.razaoSocial')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                  {t('fin.municipio')}/{t('fin.uf')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.inscricaoMunicipal')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.status')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.acoes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {empresas.map((empresa) => (
                <tr key={empresa.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">{empresa.name}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{empresa.cnpj}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{empresa.razao_social || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {[empresa.municipio, empresa.uf].filter(Boolean).join('/') || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{empresa.inscricao_municipal || '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        empresa.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {empresa.is_active ? t('fin.ativo') : t('fin.inativo')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(empresa)}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-abz-blue dark:hover:bg-gray-700"
                      aria-label={t('financeiro.editar')}
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(empresa)}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                      aria-label={t('financeiro.excluir')}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de cadastro/edição */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editando ? t('fin.editarEmpresa') : t('fin.novaEmpresa')}
            className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border sm:border-gray-200 dark:sm:border-gray-700"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
                  <FiBriefcase className="h-5 w-5" />
                </div>
                <h2 className="truncate text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
                  {editando ? t('fin.editarEmpresa') : t('fin.novaEmpresa')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label={t('financeiro.fechar')}
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
              <div className="space-y-4">
                <fieldset className="space-y-3">
                  <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {t('fin.secaoIdentificacao')}
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.clienteNome')}</span>
                      <input value={form.name} onChange={(e) => set('name', e.target.value)} className={FIN_INPUT_CLASS} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.cnpj')}</span>
                      <input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} className={FIN_INPUT_CLASS} maxLength={18} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.razaoSocial')}</span>
                      <input value={form.razao_social} onChange={(e) => set('razao_social', e.target.value)} className={FIN_INPUT_CLASS} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.nomeFantasia')}</span>
                      <input value={form.nome_fantasia} onChange={(e) => set('nome_fantasia', e.target.value)} className={FIN_INPUT_CLASS} />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {t('fin.secaoFiscal')}
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.inscricaoMunicipal')}</span>
                      <input
                        value={form.inscricao_municipal}
                        onChange={(e) => set('inscricao_municipal', e.target.value)}
                        className={FIN_INPUT_CLASS}
                        maxLength={30}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.inscricaoEstadual')}</span>
                      <input
                        value={form.inscricao_estadual}
                        onChange={(e) => set('inscricao_estadual', e.target.value)}
                        className={FIN_INPUT_CLASS}
                        maxLength={30}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.cnaePrincipal')}</span>
                      <input
                        value={form.cnae_principal}
                        onChange={(e) => set('cnae_principal', e.target.value)}
                        className={FIN_INPUT_CLASS}
                        maxLength={10}
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {t('fin.secaoEndereco')}
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                    <label className="block sm:col-span-4">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.logradouro')}</span>
                      <input value={form.logradouro} onChange={(e) => set('logradouro', e.target.value)} className={FIN_INPUT_CLASS} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.numero')}</span>
                      <input value={form.numero} onChange={(e) => set('numero', e.target.value)} className={FIN_INPUT_CLASS} maxLength={20} />
                    </label>
                    <label className="block sm:col-span-3">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.complemento')}</span>
                      <input value={form.complemento} onChange={(e) => set('complemento', e.target.value)} className={FIN_INPUT_CLASS} />
                    </label>
                    <label className="block sm:col-span-3">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.bairro')}</span>
                      <input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} className={FIN_INPUT_CLASS} maxLength={120} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.municipio')}</span>
                      <input value={form.municipio} onChange={(e) => set('municipio', e.target.value)} className={FIN_INPUT_CLASS} maxLength={120} />
                    </label>
                    <label className="block sm:col-span-1">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.uf')}</span>
                      <input
                        value={form.uf}
                        onChange={(e) => set('uf', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                        className={FIN_INPUT_CLASS}
                        maxLength={2}
                      />
                    </label>
                    <label className="block sm:col-span-1">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.cep')}</span>
                      <input value={form.cep} onChange={(e) => set('cep', e.target.value)} className={FIN_INPUT_CLASS} maxLength={9} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.municipioIbge')}</span>
                      <input
                        value={form.municipio_ibge}
                        onChange={(e) => set('municipio_ibge', e.target.value.replace(/\D/g, '').slice(0, 7))}
                        className={FIN_INPUT_CLASS}
                        maxLength={7}
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {t('fin.secaoContato')}
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.clienteEmail')}</span>
                      <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={FIN_INPUT_CLASS} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.telefone')}</span>
                      <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={FIN_INPUT_CLASS} maxLength={20} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.contato')}</span>
                      <input
                        value={form.contact_person}
                        onChange={(e) => set('contact_person', e.target.value)}
                        className={FIN_INPUT_CLASS}
                      />
                    </label>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => set('is_active', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-abz-blue focus:ring-abz-blue dark:border-gray-600"
                    />
                    {t('fin.ativo')}
                  </label>
                </fieldset>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900 sm:px-6">
              <button type="button" onClick={() => setModalAberto(false)} className={FIN_BTN_SECONDARY_CLASS}>
                {t('financeiro.cancelar')}
              </button>
              <button type="button" onClick={salvar} disabled={salvando} className={FIN_BTN_PRIMARY_CLASS}>
                {salvando && <FiLoader className="h-4 w-4 animate-spin" />}
                {t('financeiro.salvar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
