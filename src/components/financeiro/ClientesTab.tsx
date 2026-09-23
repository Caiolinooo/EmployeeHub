'use client';

/**
 * Aba Clientes (design §4) — CRUD de fin_clientes via /api/financeiro/clientes.
 * Cadastro completo: fiscal BR (CPF/CNPJ, IM/IE, endereço estruturado) e
 * internacional (tax_id, street/city/state/postcode), país ISO, moeda,
 * condição de pagamento, categoria e template padrão.
 *
 * Exporta ClienteFormFields + helpers para o cadastro inline do FaturaWizard
 * (mesmo formulário, sem duplicar campo a campo).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FiEdit2, FiFolder, FiLoader, FiPlus, FiSearch, FiTrash2, FiUsers, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import {
  createCliente, deleteCliente, listClientes, listTemplates, updateCliente,
} from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinCliente, FinClienteForm, FinFaturaTemplate } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  mensagemErro,
} from '@/components/financeiro/shared';

/** Países ISO com opção dedicada; demais via "Outro país" (input de 2 letras). */
export const PAISES_ISO = ['BR', 'GB', 'US', 'NL', 'NO', 'FR', 'PT'] as const;

export const MOEDAS = ['BRL', 'USD', 'EUR', 'GBP', 'NOK'] as const;

const CATEGORIAS = ['offshore', 'maritime', 'onshore'] as const;

/** Estado plano do formulário de cliente (compartilhado wizard + aba). */
export interface ClienteFormState {
  nome: string;
  client_key: string;
  pais: string;
  documento: string;
  tax_id: string;
  email: string;
  inscricao_municipal: string;
  inscricao_estadual: string;
  // Endereço BR (JSONB: logradouro/numero/complemento/bairro/cidade/uf/cep/codigo_ibge_municipio)
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  codigo_ibge_municipio: string;
  // Endereço internacional (JSONB: street/city/state/postcode/country)
  street: string;
  city: string;
  state: string;
  postcode: string;
  // Comercial
  moeda: string;
  condicao_pagamento: string;
  categoria: string;
  default_template_id: string;
}

export function clienteFormVazio(parcial?: Partial<ClienteFormState>): ClienteFormState {
  return {
    nome: '',
    client_key: '',
    pais: 'BR',
    documento: '',
    tax_id: '',
    email: '',
    inscricao_municipal: '',
    inscricao_estadual: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    codigo_ibge_municipio: '',
    street: '',
    city: '',
    state: '',
    postcode: '',
    moeda: 'BRL',
    condicao_pagamento: '',
    categoria: '',
    default_template_id: '',
    ...parcial,
  };
}

function textoDo(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

export function clienteParaForm(cliente: FinCliente): ClienteFormState {
  const end = (cliente.endereco ?? {}) as Record<string, unknown>;
  return clienteFormVazio({
    nome: cliente.nome ?? '',
    client_key: cliente.client_key ?? '',
    pais: textoDo(cliente.pais) || 'BR',
    documento: textoDo(cliente.documento),
    tax_id: textoDo(cliente.tax_id),
    email: textoDo(cliente.email),
    inscricao_municipal: textoDo(cliente.inscricao_municipal),
    inscricao_estadual: textoDo(cliente.inscricao_estadual),
    logradouro: textoDo(end.logradouro),
    numero: textoDo(end.numero),
    complemento: textoDo(end.complemento),
    bairro: textoDo(end.bairro),
    cidade: textoDo(end.cidade),
    uf: textoDo(end.uf),
    cep: textoDo(end.cep),
    codigo_ibge_municipio: textoDo(end.codigo_ibge_municipio),
    street: textoDo(end.street),
    city: textoDo(end.city),
    state: textoDo(end.state),
    postcode: textoDo(end.postcode),
    moeda: cliente.moeda || 'BRL',
    condicao_pagamento: textoDo(cliente.condicao_pagamento),
    categoria: textoDo(cliente.categoria),
    default_template_id: textoDo(cliente.default_template_id),
  });
}

function objetoSemVazios(registro: Record<string, string>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(registro)) {
    const trimado = valor.trim();
    if (trimado) saida[chave] = trimado;
  }
  return saida;
}

/** Monta o payload FinClienteForm (POST/PUT) a partir do estado plano. */
export function clienteFormPayload(form: ClienteFormState, empresaId: string): FinClienteForm {
  const ehBr = !form.pais || form.pais === 'BR';
  const endereco = ehBr
    ? objetoSemVazios({
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf.toUpperCase(),
        cep: form.cep,
        codigo_ibge_municipio: form.codigo_ibge_municipio,
      })
    : objetoSemVazios({
        street: form.street,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
        country: form.pais,
      });
  return {
    empresa_id: empresaId,
    client_key: form.client_key.trim(),
    nome: form.nome.trim(),
    pais: (form.pais || 'BR').toUpperCase(),
    // Documento BR vs tax_id exterior são mutuamente exclusivos (design §5)
    documento: ehBr ? form.documento.trim() : '',
    tax_id: ehBr ? '' : form.tax_id.trim(),
    email: form.email.trim(),
    endereco,
    moeda: (form.moeda || 'BRL').toUpperCase(),
    condicao_pagamento: form.condicao_pagamento.trim(),
    categoria: form.categoria,
    inscricao_municipal: ehBr ? form.inscricao_municipal.trim() : '',
    inscricao_estadual: ehBr ? form.inscricao_estadual.trim() : '',
    default_template_id: form.default_template_id,
  };
}

interface CampoProps {
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}

function Campo({ rotulo, children, className }: CampoProps) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{rotulo}</span>
      {children}
    </label>
  );
}

function SecaoForm({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{titulo}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Sub-formulário de cliente compartilhado: alterna campos fiscais/endereço
 * conforme o país (BR estruturado vs internacional).
 */
export function ClienteFormFields({
  valor,
  onChange,
  templates,
}: {
  valor: ClienteFormState;
  onChange: (proximo: ClienteFormState) => void;
  templates?: FinFaturaTemplate[];
}) {
  const { t } = useI18n();
  const ehBr = !valor.pais || valor.pais === 'BR';
  const paisEhOutro = valor.pais !== '' && !PAISES_ISO.includes(valor.pais as (typeof PAISES_ISO)[number]);
  const [outroAberto, setOutroAberto] = useState(paisEhOutro);

  function set(campo: keyof ClienteFormState, conteudo: string) {
    onChange({ ...valor, [campo]: conteudo });
  }

  return (
    <div className="space-y-4">
      <SecaoForm titulo={t('fin.secaoIdentificacao')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo={t('financeiro.clienteNome')}>
            <input value={valor.nome} onChange={(e) => set('nome', e.target.value)} className={FIN_INPUT_CLASS} />
          </Campo>
          <Campo rotulo={t('financeiro.clienteKey')}>
            <input
              value={valor.client_key}
              onChange={(e) => set('client_key', e.target.value.toUpperCase().slice(0, 60))}
              className={FIN_INPUT_CLASS}
            />
          </Campo>
          <Campo rotulo={t('fin.pais')}>
            <select
              value={outroAberto || paisEhOutro ? '__outro' : valor.pais}
              onChange={(e) => {
                if (e.target.value === '__outro') {
                  setOutroAberto(true);
                  set('pais', '');
                } else {
                  setOutroAberto(false);
                  set('pais', e.target.value);
                }
              }}
              className={FIN_INPUT_CLASS}
            >
              {PAISES_ISO.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {codigo}
                </option>
              ))}
              <option value="__outro">{t('fin.paisOutro')}</option>
            </select>
          </Campo>
          {(outroAberto || paisEhOutro) && (
            <Campo rotulo={t('fin.paisCodigoIso')}>
              <input
                value={valor.pais}
                onChange={(e) => set('pais', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                className={FIN_INPUT_CLASS}
                maxLength={2}
              />
            </Campo>
          )}
          <Campo rotulo={ehBr ? t('fin.documentoBr') : t('fin.taxId')}>
            <input
              value={ehBr ? valor.documento : valor.tax_id}
              onChange={(e) => set(ehBr ? 'documento' : 'tax_id', e.target.value)}
              className={FIN_INPUT_CLASS}
            />
          </Campo>
          <Campo rotulo={t('financeiro.clienteEmail')}>
            <input type="email" value={valor.email} onChange={(e) => set('email', e.target.value)} className={FIN_INPUT_CLASS} />
          </Campo>
        </div>
      </SecaoForm>

      {ehBr && (
        <SecaoForm titulo={t('fin.secaoFiscal')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo={t('fin.inscricaoMunicipal')}>
              <input
                value={valor.inscricao_municipal}
                onChange={(e) => set('inscricao_municipal', e.target.value)}
                className={FIN_INPUT_CLASS}
              />
            </Campo>
            <Campo rotulo={t('fin.inscricaoEstadual')}>
              <input
                value={valor.inscricao_estadual}
                onChange={(e) => set('inscricao_estadual', e.target.value)}
                className={FIN_INPUT_CLASS}
              />
            </Campo>
          </div>
        </SecaoForm>
      )}

      <SecaoForm titulo={ehBr ? t('fin.enderecoBr') : t('fin.enderecoInternacional')}>
        {ehBr ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <Campo rotulo={t('fin.logradouro')} className="sm:col-span-4">
              <input value={valor.logradouro} onChange={(e) => set('logradouro', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('financeiro.numero')} className="sm:col-span-2">
              <input value={valor.numero} onChange={(e) => set('numero', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('fin.complemento')} className="sm:col-span-3">
              <input value={valor.complemento} onChange={(e) => set('complemento', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('fin.bairro')} className="sm:col-span-3">
              <input value={valor.bairro} onChange={(e) => set('bairro', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('fin.cidade')} className="sm:col-span-3">
              <input value={valor.cidade} onChange={(e) => set('cidade', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('fin.uf')} className="sm:col-span-1">
              <input
                value={valor.uf}
                onChange={(e) => set('uf', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                className={FIN_INPUT_CLASS}
                maxLength={2}
              />
            </Campo>
            <Campo rotulo={t('fin.cep')} className="sm:col-span-2">
              <input value={valor.cep} onChange={(e) => set('cep', e.target.value)} className={FIN_INPUT_CLASS} maxLength={9} />
            </Campo>
            <Campo rotulo={t('fin.municipioIbge')} className="sm:col-span-3">
              <input
                value={valor.codigo_ibge_municipio}
                onChange={(e) => set('codigo_ibge_municipio', e.target.value.replace(/\D/g, '').slice(0, 7))}
                className={FIN_INPUT_CLASS}
                maxLength={7}
              />
            </Campo>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo={t('fin.rua')} className="sm:col-span-2">
              <input value={valor.street} onChange={(e) => set('street', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('fin.cidade')}>
              <input value={valor.city} onChange={(e) => set('city', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('fin.estadoProvincia')}>
              <input value={valor.state} onChange={(e) => set('state', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
            <Campo rotulo={t('fin.codigoPostal')}>
              <input value={valor.postcode} onChange={(e) => set('postcode', e.target.value)} className={FIN_INPUT_CLASS} />
            </Campo>
          </div>
        )}
      </SecaoForm>

      <SecaoForm titulo={t('fin.secaoComercial')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo={t('financeiro.moeda')}>
            <select value={valor.moeda} onChange={(e) => set('moeda', e.target.value)} className={FIN_INPUT_CLASS}>
              {MOEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo={t('fin.condicaoPagamento')}>
            <input
              value={valor.condicao_pagamento}
              onChange={(e) => set('condicao_pagamento', e.target.value)}
              className={FIN_INPUT_CLASS}
            />
          </Campo>
          <Campo rotulo={t('fin.categoria')}>
            <select value={valor.categoria} onChange={(e) => set('categoria', e.target.value)} className={FIN_INPUT_CLASS}>
              <option value="">—</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {t(`fin.categoria${c[0].toUpperCase()}${c.slice(1)}`)}
                </option>
              ))}
            </select>
          </Campo>
          {templates && (
            <Campo rotulo={t('fin.templatePadrao')}>
              <select
                value={valor.default_template_id}
                onChange={(e) => set('default_template_id', e.target.value)}
                className={FIN_INPUT_CLASS}
              >
                <option value="">—</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nome} ({tpl.tipo})
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
      </SecaoForm>
    </div>
  );
}

interface EmpresaOpcao {
  id: string;
  name: string;
}

export default function ClientesTab() {
  const { t } = useI18n();
  const [clientes, setClientes] = useState<FinCliente[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [templates, setTemplates] = useState<FinFaturaTemplate[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<FinCliente | null>(null);
  const [form, setForm] = useState<ClienteFormState>(clienteFormVazio());
  const [formEmpresaId, setFormEmpresaId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setClientes(await listClientes({ empresaId: empresaFiltro || undefined, busca: busca || undefined, limit: 200 }));
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  }, [empresaFiltro, busca, t]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithToken('/api/payroll/companies?limit=100');
        const body = await res.json();
        const lista = (body?.data ?? []) as Array<{ id: string; name?: string }>;
        setEmpresas(lista.map((e) => ({ id: e.id, name: e.name || e.id })));
      } catch {
        /* seletor fica vazio */
      }
      try {
        setTemplates(await listTemplates());
      } catch {
        /* template padrão é opcional */
      }
    })();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setForm(clienteFormVazio());
    setFormEmpresaId(empresaFiltro || empresas[0]?.id || '');
    setModalAberto(true);
  }

  function abrirEdicao(cliente: FinCliente) {
    setEditando(cliente);
    setForm(clienteParaForm(cliente));
    setFormEmpresaId(cliente.empresa_id);
    setModalAberto(true);
  }

  async function salvar() {
    if (!formEmpresaId || !form.client_key.trim() || !form.nome.trim()) {
      toast.error(t('fin.erroClienteObrigatorios'));
      return;
    }
    setSalvando(true);
    try {
      const payload = clienteFormPayload(form, formEmpresaId);
      if (editando) {
        await updateCliente(editando.id, payload);
      } else {
        await createCliente(payload);
      }
      toast.success(t('financeiro.sucessoSalvar'));
      setModalAberto(false);
      await carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(cliente: FinCliente) {
    if (!window.confirm(t('fin.confirmarExcluirCliente'))) return;
    try {
      await deleteCliente(cliente.id);
      toast.success(t('financeiro.sucessoSalvar'));
      await carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
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
            placeholder={t('fin.buscarCliente')}
            className={`${FIN_INPUT_CLASS} pl-9`}
          />
        </div>
        <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)} className={`${FIN_INPUT_CLASS} w-auto`}>
          <option value="">{t('financeiro.todasEmpresas')}</option>
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={abrirNovo} className={FIN_BTN_PRIMARY_CLASS}>
          <FiPlus className="h-4 w-4" /> {t('financeiro.novoCliente')}
        </button>
      </div>

      {/* Tabela */}
      <div className={`${FIN_CARD_CLASS} min-h-0 flex-1 overflow-auto`}>
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500 dark:text-gray-400">
            <FiLoader className="h-5 w-5 animate-spin text-abz-blue" /> {t('financeiro.carregando')}
          </div>
        ) : clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-sm text-gray-400 dark:text-gray-500">
            <FiFolder className="h-8 w-8" /> {t('fin.nenhumCliente')}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.clienteNome')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.clienteKey')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.pais')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.documentoBr')}/{t('fin.taxId')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.moeda')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('fin.categoria')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.status')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{t('financeiro.acoes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">{cliente.nome}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{cliente.client_key}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{cliente.pais || 'BR'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {(cliente.pais && cliente.pais !== 'BR' ? cliente.tax_id : cliente.documento) || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{cliente.moeda}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{cliente.categoria || '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        cliente.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {cliente.is_active ? t('fin.ativo') : t('fin.inativo')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(cliente)}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-abz-blue dark:hover:bg-gray-700"
                      aria-label={t('financeiro.editar')}
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(cliente)}
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
            aria-label={editando ? t('fin.editarCliente') : t('financeiro.novoCliente')}
            className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border sm:border-gray-200 dark:sm:border-gray-700"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
                  <FiUsers className="h-5 w-5" />
                </div>
                <h2 className="truncate text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
                  {editando ? t('fin.editarCliente') : t('financeiro.novoCliente')}
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
              <div className="mb-4">
                <Campo rotulo={t('financeiro.empresa')}>
                  <select
                    value={formEmpresaId}
                    onChange={(e) => setFormEmpresaId(e.target.value)}
                    className={FIN_INPUT_CLASS}
                    disabled={Boolean(editando)}
                  >
                    <option value="">—</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <ClienteFormFields valor={form} onChange={setForm} templates={templates} />
              {form.pais && form.pais !== 'BR' && (
                <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                  {t('fin.exteriorSemNfse')}
                </p>
              )}
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
