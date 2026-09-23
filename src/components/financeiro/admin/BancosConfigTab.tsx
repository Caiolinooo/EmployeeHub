'use client';

/**
 * BancosConfigTab (§7.2): grid de integrações do BANK_CATALOG (via
 * /bancos/catalogo), CredenciaisForm dinâmico do credentialSchema (secret
 * mostra só preenchido:boolean), CertificadoUpload (.pfx + senha com
 * fingerprint/validade e aviso <30d), ContasBancariasForm e Testar conexão.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FiPlus, FiSave, FiTrash2, FiUpload, FiCheckCircle, FiXCircle, FiRefreshCw,
  FiChevronDown, FiChevronUp, FiAlertTriangle, FiLock, FiKey,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import {
  createContaBancaria, createIntegracao, deleteContaBancaria, deleteIntegracao,
  getBancoCatalogo, getIntegracao, listContasBancarias, listIntegracoes,
  salvarCredencialIntegracao, testarIntegracao, uploadCertificadoIntegracao,
} from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type {
  FinBancoCatalogoItem, FinContaBancaria, FinIntegracaoBanco,
  FinIntegracaoBancoComCredenciais,
} from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  IntegracaoStatusChip,
  formatarData,
  mensagemErro,
} from '@/components/financeiro/shared';

const AMBIENTES = ['sandbox', 'producao'] as const;

export default function BancosConfigTab() {
  const { t } = useI18n();
  const [catalogo, setCatalogo] = useState<FinBancoCatalogoItem[]>([]);
  const [integracoes, setIntegracoes] = useState<FinIntegracaoBanco[]>([]);
  const [contas, setContas] = useState<FinContaBancaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<FinIntegracaoBancoComCredenciais | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [cat, ints, cts] = await Promise.all([getBancoCatalogo(), listIntegracoes(), listContasBancarias()]);
      setCatalogo(cat);
      setIntegracoes(ints);
      setContas(cts);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const metaDe = useCallback(
    (adapterKey: string) => catalogo.find((c) => c.key === adapterKey),
    [catalogo],
  );

  async function abrirIntegracao(id: string) {
    const nova = expandida === id ? null : id;
    setExpandida(nova);
    setDetalhe(null);
    if (nova) {
      try {
        setDetalhe(await getIntegracao(id));
      } catch (e) {
        toast.error(mensagemErro(e, t('financeiro.erroGeral')));
      }
    }
  }

  async function testar(id: string) {
    try {
      const res = await testarIntegracao(id);
      if (res.ok) toast.success(`${t('admin.conexaoOk')}${res.detalhe ? ` — ${res.detalhe}` : ''}`);
      else toast.error(`${t('admin.conexaoErro')}${res.detalhe ? ` — ${res.detalhe}` : ''}`);
      carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('admin.conexaoErro')));
    }
  }

  return (
    <div className="space-y-4">
      {/* Nova integração */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('financeiro.cfgIntegracoes')}</h3>
        <button type="button" onClick={() => setNovaAberta((v) => !v)} className={`${FIN_BTN_PRIMARY_CLASS} ml-auto`}>
          <FiPlus className="h-4 w-4" /> {t('admin.novaIntegracao')}
        </button>
      </div>

      {novaAberta && (
        <NovaIntegracaoForm
          catalogo={catalogo}
          onCriada={() => {
            setNovaAberta(false);
            carregar();
          }}
        />
      )}

      {/* Grid de integrações */}
      {carregando && <p className="text-sm text-gray-400">{t('financeiro.carregando')}</p>}
      {!carregando && integracoes.length === 0 && (
        <p className={`${FIN_CARD_CLASS} p-6 text-center text-sm text-gray-400`}>{t('financeiro.cfgIntegracoes')}: —</p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {integracoes.map((integracao) => {
          const meta = metaDe(integracao.adapter_key);
          const ultima = integracao.ultima_testagem;
          const expirandoCert =
            integracao.certificado_validade &&
            new Date(integracao.certificado_validade).getTime() - Date.now() < 30 * 86400000;
          return (
            <div key={integracao.id} className={`${FIN_CARD_CLASS} overflow-hidden`}>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                    {integracao.apelido}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {meta?.nome ?? integracao.adapter_key} · FEBRABAN {meta?.codigoFebraban ?? '—'}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <IntegracaoStatusChip status={integracao.status} />
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
                      {integracao.ambiente === 'producao' ? t('admin.producao') : t('admin.sandbox')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t('financeiro.cfgUltimaTestagem')}:{' '}
                      {ultima ? (ultima.ok ? <FiCheckCircle className="inline h-3.5 w-3.5 text-emerald-500" /> : <FiXCircle className="inline h-3.5 w-3.5 text-rose-500" />) : t('financeiro.cfgNuncaTestada')}
                      {ultima ? ` ${formatarData(ultima.em)}` : ''}
                    </span>
                  </div>
                  {integracao.certificado_fingerprint && (
                    <p className="mt-1 truncate font-mono text-[11px] text-gray-400" title={integracao.certificado_fingerprint}>
                      {integracao.certificado_fingerprint}
                      {integracao.certificado_validade ? ` · ${t('admin.certificadoValidade')} ${formatarData(integracao.certificado_validade)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button type="button" onClick={() => abrirIntegracao(integracao.id)} className={FIN_BTN_SECONDARY_CLASS}>
                    {expandida === integracao.id ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                    {t('admin.credenciais')}
                  </button>
                  <button type="button" onClick={() => testar(integracao.id)} className={FIN_BTN_SECONDARY_CLASS}>
                    <FiRefreshCw className="h-4 w-4" /> {t('admin.testarConexao')}
                  </button>
                </div>
              </div>

              {expandida === integracao.id && (
                <div className="space-y-5 border-t border-gray-100 bg-gray-50/60 p-4">
                  {expirandoCert && (
                    <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                      <FiAlertTriangle className="h-4 w-4" /> {t('financeiro.cfgCertExpira30')}
                    </p>
                  )}
                  {meta && detalhe && detalhe.id === integracao.id && (
                    <CredenciaisForm integracao={detalhe} meta={meta} onSalvo={carregar} />
                  )}
                  <CertificadoUpload integracao={integracao} onSalvo={carregar} />
                  <ContasBancariasForm
                    contas={contas.filter((c) => c.integracao_id === integracao.id)}
                    integracaoId={integracao.id}
                    onMudou={carregar}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`${t('financeiro.excluir')}?`)) return;
                        try {
                          await deleteIntegracao(integracao.id);
                          setExpandida(null);
                          carregar();
                        } catch (e) {
                          toast.error(mensagemErro(e, t('financeiro.erroGeral')));
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <FiTrash2 className="h-4 w-4" /> {t('financeiro.excluir')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Criação: select do BANK_CATALOG + apelido + ambiente. */
function NovaIntegracaoForm({ catalogo, onCriada }: { catalogo: FinBancoCatalogoItem[]; onCriada: () => void }) {
  const { t } = useI18n();
  const [adapterKey, setAdapterKey] = useState('');
  const [apelido, setApelido] = useState('');
  const [ambiente, setAmbiente] = useState<(typeof AMBIENTES)[number]>('sandbox');
  const [salvando, setSalvando] = useState(false);
  const meta = catalogo.find((c) => c.key === adapterKey);

  async function criar() {
    if (!adapterKey || !apelido.trim()) return;
    setSalvando(true);
    try {
      await createIntegracao({ adapterKey, apelido: apelido.trim(), ambiente });
      toast.success(t('financeiro.sucessoSalvar'));
      onCriada();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={`${FIN_CARD_CLASS} grid grid-cols-1 gap-3 p-4 sm:grid-cols-4`}>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgIntegracao')}</label>
        <select value={adapterKey} onChange={(e) => setAdapterKey(e.target.value)} className={FIN_INPUT_CLASS}>
          <option value="">—</option>
          {catalogo.map((c) => (
            <option key={c.key} value={c.key}>
              {c.nome} ({c.codigoFebraban})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgNovaIntegracaoApelido')}</label>
        <input value={apelido} onChange={(e) => setApelido(e.target.value)} className={FIN_INPUT_CLASS} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('admin.ambiente')}</label>
        <select value={ambiente} onChange={(e) => setAmbiente(e.target.value as (typeof AMBIENTES)[number])} className={FIN_INPUT_CLASS}>
          {AMBIENTES.map((a) => (
            <option key={a} value={a}>
              {a === 'producao' ? t('admin.producao') : t('admin.sandbox')}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button type="button" onClick={criar} disabled={salvando || !adapterKey || !apelido.trim()} className={`${FIN_BTN_PRIMARY_CLASS} w-full justify-center`}>
          <FiSave className="h-4 w-4" /> {t('financeiro.salvar')}
        </button>
      </div>
      {meta && <p className="text-xs text-gray-400 sm:col-span-4">{t('financeiro.cfgDescricaoCredenciais')}: {meta.descricaoCredenciais}</p>}
    </div>
  );
}

/** CredenciaisForm dinâmico do credentialSchema (§7.2) — secret nunca retorna. */
function CredenciaisForm({
  integracao,
  meta,
  onSalvo,
}: {
  integracao: FinIntegracaoBancoComCredenciais;
  meta: FinBancoCatalogoItem;
  onSalvo: () => void;
}) {
  const { t } = useI18n();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvandoCampo, setSalvandoCampo] = useState<string | null>(null);

  async function salvar(campo: string) {
    const valor = valores[campo];
    if (!valor) return;
    setSalvandoCampo(campo);
    try {
      await salvarCredencialIntegracao(integracao.id, campo, valor);
      setValores((atual) => ({ ...atual, [campo]: '' }));
      toast.success(t('financeiro.sucessoSalvar'));
      onSalvo();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setSalvandoCampo(null);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-gray-400">{t('admin.credenciais')}</p>
      <div className="space-y-2">
        {meta.credentialSchema.map((campo) => {
          const preenchido = integracao.preenchidos?.[campo.key] === true;
          return (
            <div key={campo.key} className="flex flex-wrap items-center gap-2">
              <label className="min-w-40 text-xs font-semibold text-gray-600" title={campo.help ?? ''}>
                {campo.label}
                {campo.required && <span className="ml-1 text-rose-500">*</span>}
              </label>
              {campo.kind === 'secret' ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {preenchido ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                      <FiCheckCircle className="h-3.5 w-3.5" /> {t('admin.credencialPreenchida')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-500">
                      <FiXCircle className="h-3.5 w-3.5" /> {t('admin.credencialVazia')}
                    </span>
                  )}
                  <input
                    type="password"
                    placeholder={t('admin.credencialVazia')}
                    value={valores[campo.key] ?? ''}
                    onChange={(e) => setValores((atual) => ({ ...atual, [campo.key]: e.target.value }))}
                    className={`${FIN_INPUT_CLASS} max-w-56`}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => salvar(campo.key)} disabled={salvandoCampo === campo.key || !valores[campo.key]} className={FIN_BTN_SECONDARY_CLASS}>
                    <FiSave className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type={campo.kind === 'password' ? 'password' : 'text'}
                    value={valores[campo.key] ?? ''}
                    onChange={(e) => setValores((atual) => ({ ...atual, [campo.key]: e.target.value }))}
                    className={`${FIN_INPUT_CLASS} max-w-56`}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => salvar(campo.key)} disabled={salvandoCampo === campo.key || !valores[campo.key]} className={FIN_BTN_SECONDARY_CLASS}>
                    <FiSave className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** CertificadoUpload (.pfx + senha) — fingerprint/validade vindos da integração. */
function CertificadoUpload({
  integracao,
  onSalvo,
}: {
  integracao: FinIntegracaoBanco;
  onSalvo: () => void;
}) {
  const { t } = useI18n();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!arquivo || !senha) return;
    setEnviando(true);
    try {
      await uploadCertificadoIntegracao(integracao.id, arquivo, senha);
      toast.success(t('financeiro.sucessoSalvar'));
      setArquivo(null);
      setSenha('');
      onSalvo();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-gray-400">{t('admin.certificadoUpload')}</p>
      {integracao.certificado_fingerprint && (
        <p className="mb-2 text-xs text-gray-500">
          {integracao.certificado_fingerprint} · {t('admin.certificadoValidade')}: {formatarData(integracao.certificado_validade)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${FIN_BTN_SECONDARY_CLASS} cursor-pointer`}>
          <FiUpload className="h-4 w-4" /> {t('financeiro.cfgEnviarCertificado')}
          <input
            type="file"
            accept=".pfx,.p12"
            className="hidden"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </label>
        {arquivo && <span className="text-xs text-gray-500">{arquivo.name}</span>}
        <input
          type="password"
          placeholder={t('financeiro.cfgSenhaCertificado')}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={`${FIN_INPUT_CLASS} max-w-48`}
          autoComplete="new-password"
        />
        <button type="button" onClick={enviar} disabled={enviando || !arquivo || !senha} className={FIN_BTN_SECONDARY_CLASS}>
          <FiLock className="h-4 w-4" /> {t('financeiro.salvar')}
        </button>
      </div>
    </div>
  );
}

/** ContasBancariasForm — CRUD de contas vinculado à integração/empresa (§7.2). */
function ContasBancariasForm({
  contas,
  integracaoId,
  onMudou,
}: {
  contas: FinContaBancaria[];
  integracaoId: string;
  onMudou: () => void;
}) {
  const { t } = useI18n();
  const [empresas, setEmpresas] = useState<Array<{ id: string; name: string }>>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [form, setForm] = useState({
    banco_codigo: '',
    banco_nome: '',
    agencia: '',
    conta: '',
    digito: '',
    tipo: 'corrente',
    titular_nome: '',
    titular_documento: '',
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithToken('/api/payroll/companies?limit=100');
        const body = await res.json();
        setEmpresas(((body?.data ?? []) as Array<{ id: string; name?: string }>).map((e) => ({ id: e.id, name: e.name || e.id })));
      } catch {
        /* seletor fica vazio */
      }
    })();
  }, []);

  async function criar() {
    if (!empresaId || !form.banco_codigo || !form.titular_nome || !form.titular_documento) return;
    setSalvando(true);
    try {
      await createContaBancaria({
        empresa_id: empresaId,
        ...form,
        tipo: form.tipo as FinContaBancaria['tipo'],
        integracao_id: integracaoId,
      });
      toast.success(t('financeiro.sucessoSalvar'));
      setForm({ banco_codigo: '', banco_nome: '', agencia: '', conta: '', digito: '', tipo: 'corrente', titular_nome: '', titular_documento: '' });
      onMudou();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!window.confirm(`${t('financeiro.excluir')}?`)) return;
    try {
      await deleteContaBancaria(id);
      onMudou();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-gray-400">{t('admin.contasBancarias')}</p>
      <div className="mb-2 space-y-1">
        {contas.map((conta) => (
          <div key={conta.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-semibold text-gray-800">{conta.banco_nome || conta.banco_codigo}</span>{' '}
              <span className="text-gray-500">
                {conta.agencia}/{conta.conta}-{conta.digito} · {conta.titular_nome}
              </span>
            </span>
            <button type="button" onClick={() => excluir(conta.id)} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600">
              <FiTrash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={FIN_INPUT_CLASS}>
          <option value="">{t('financeiro.cfgSelecionarEmpresa')}</option>
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
        <input placeholder={t('financeiro.cfgBancoCodigo')} value={form.banco_codigo} onChange={(e) => setForm({ ...form, banco_codigo: e.target.value })} className={FIN_INPUT_CLASS} />
        <input placeholder={t('financeiro.cfgBancoNome')} value={form.banco_nome} onChange={(e) => setForm({ ...form, banco_nome: e.target.value })} className={FIN_INPUT_CLASS} />
        <input placeholder={t('financeiro.cfgAgencia')} value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} className={FIN_INPUT_CLASS} />
        <input placeholder={t('financeiro.cfgConta')} value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className={FIN_INPUT_CLASS} />
        <input placeholder={t('financeiro.cfgDigito')} value={form.digito} onChange={(e) => setForm({ ...form, digito: e.target.value })} className={FIN_INPUT_CLASS} />
        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={FIN_INPUT_CLASS}>
          <option value="corrente">{t('financeiro.cfgTipoCorrente')}</option>
          <option value="investimento">{t('financeiro.cfgTipoInvestimento')}</option>
          <option value="pagamento">{t('financeiro.cfgTipoPagamento')}</option>
        </select>
        <input placeholder={t('financeiro.cfgTitular')} value={form.titular_nome} onChange={(e) => setForm({ ...form, titular_nome: e.target.value })} className={FIN_INPUT_CLASS} />
        <div className="flex gap-2">
          <input placeholder={t('financeiro.cfgDocumentoTitular')} value={form.titular_documento} onChange={(e) => setForm({ ...form, titular_documento: e.target.value })} className={FIN_INPUT_CLASS} />
          <button type="button" onClick={criar} disabled={salvando} className={FIN_BTN_SECONDARY_CLASS}>
            <FiKey className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
