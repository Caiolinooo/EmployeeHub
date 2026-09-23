'use client';

/**
 * NfseConfigTab (§7.2): config NFS-e por empresa — município com busca no
 * registry, provider auto-sugerido (editável), IM, regime, simples, alíquota
 * ISS, ISS retido, URLs do webservice proprietário, upload de cert A1 quando
 * o padrão exige, contador RPS somente leitura.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FiSave, FiPlus, FiSearch, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import {
  createNfseConfig, getCertificadoA1, listMunicipios, listNfseConfig, salvarNfseCredencial,
  updateNfseConfig,
} from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinCertificadoA1Meta, FinMunicipio, FinNfseConfig, FinNfseProviderKey } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  mensagemErro,
} from '@/components/financeiro/shared';

const PROVIDERS: FinNfseProviderKey[] = ['abrasf202', 'abrasf204', 'nacional', 'proprietario'];

/** §5.1: ABRASF 2.02/2.04 e Padrão Nacional exigem cert A1; proprietário depende do município. */
const PROVIDER_EXIGE_A1: Record<FinNfseProviderKey, boolean> = {
  abrasf202: true,
  abrasf204: true,
  nacional: true,
  proprietario: false,
};

const REGIMES = ['1', '2', '3', '4', '5', '6'];

interface EmpresaOpcao {
  id: string;
  name: string;
}

export default function NfseConfigTab() {
  const { t } = useI18n();
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [configs, setConfigs] = useState<FinNfseConfig[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novaConfigAberta, setNovaConfigAberta] = useState(false);

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

  const carregar = async (emp: string) => {
    setCarregando(true);
    try {
      setConfigs(emp ? await listNfseConfig({ empresaId: emp }) : []);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar(empresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.empresa')}</label>
          <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={FIN_INPUT_CLASS}>
            <option value="">{t('financeiro.cfgSelecionarEmpresa')}</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!empresaId && <p className={`${FIN_CARD_CLASS} p-6 text-center text-sm text-gray-400`}>{t('financeiro.cfgSelecionarEmpresa')}</p>}
      {empresaId && carregando && <p className="text-sm text-gray-400">{t('financeiro.carregando')}</p>}
      {empresaId && !carregando && configs.length === 0 && (
        <ConfigForm empresaId={empresaId} onSalvo={() => carregar(empresaId)} />
      )}
      {empresaId &&
        configs.map((config) => (
          <ConfigForm key={config.id} empresaId={empresaId} config={config} onSalvo={() => carregar(empresaId)} />
        ))}
      {/* Segunda (ou n-ésima) config: um município por config (UNIQUE empresa+município — §2.2) */}
      {empresaId && configs.length > 0 && (
        <div>
          <button type="button" onClick={() => setNovaConfigAberta((v) => !v)} className={FIN_BTN_SECONDARY_CLASS}>
            <FiPlus className="h-4 w-4" /> {t('financeiro.cfgCriarConfig')}
          </button>
          {novaConfigAberta && (
            <div className="mt-3">
              <ConfigForm
                empresaId={empresaId}
                onSalvo={() => {
                  setNovaConfigAberta(false);
                  carregar(empresaId);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Formulário de uma config (criação quando `config` ausente). */
function ConfigForm({
  empresaId,
  config,
  onSalvo,
}: {
  empresaId: string;
  config?: FinNfseConfig;
  onSalvo: () => void;
}) {
  const { t } = useI18n();
  const [municipioBusca, setMunicipioBusca] = useState('');
  const [municipios, setMunicipios] = useState<FinMunicipio[]>([]);
  const [municipioId, setMunicipioId] = useState(config?.municipio_id ?? '');
  const [providerKey, setProviderKey] = useState<FinNfseProviderKey>(config?.provider_key ?? 'abrasf204');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(config?.inscricao_municipal ?? '');
  const [regimeEspecial, setRegimeEspecial] = useState(config?.regime_especial ?? '');
  const [optanteSimples, setOptanteSimples] = useState(config?.optante_simples ?? false);
  const [incentivoFiscal, setIncentivoFiscal] = useState(config?.incentivo_fiscal ?? false);
  const [aliquotaIss, setAliquotaIss] = useState(config?.aliquota_iss != null ? String(config.aliquota_iss) : '');
  const [issRetido, setIssRetido] = useState(config?.iss_retido_padrao ?? false);
  const cfgWsdl = (config?.config?.wsdl_url as string) ?? '';
  const cfgUrls = (config?.config?.ambiente_urls as { producao?: string; homologacao?: string }) ?? {};
  const cfgLc116 = (config?.config?.codigo_lc116_padrao as string) ?? '';
  const [codigoLc116, setCodigoLc116] = useState(cfgLc116);
  const [wsdlUrl, setWsdlUrl] = useState(cfgWsdl || config?.municipio?.wsdl_url || '');
  const [urlProducao, setUrlProducao] = useState(cfgUrls.producao ?? '');
  const [urlHomologacao, setUrlHomologacao] = useState(cfgUrls.homologacao ?? '');
  const [salvando, setSalvando] = useState(false);

  // Credenciais proprietário (usuario/token) e cert A1
  const [credUsuario, setCredUsuario] = useState('');
  const [credToken, setCredToken] = useState('');
  const [certUnico, setCertUnico] = useState<FinCertificadoA1Meta | null>(null);
  const [certUnicoErro, setCertUnicoErro] = useState('');

  useEffect(() => {
    if (municipioBusca.trim().length < 2) {
      setMunicipios([]);
      return;
    }
    const timer = setTimeout(() => {
      listMunicipios({ busca: municipioBusca.trim(), limit: 20 })
        .then((res) => setMunicipios(res.itens))
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [municipioBusca]);

  useEffect(() => {
    getCertificadoA1()
      .then((meta) => { setCertUnico(meta); setCertUnicoErro(''); })
      .catch((e) => { setCertUnico(null); setCertUnicoErro(mensagemErro(e, t('financeiro.certificadoUnicoAusente'))); });
  }, [t]);


  const municipioSelecionado = useMemo(() => municipios.find((m) => m.codigo_ibge === municipioId), [municipios, municipioId]);

  function escolherMunicipio(m: FinMunicipio) {
    setMunicipioId(m.codigo_ibge);
    setMunicipioBusca(`${m.nome}/${m.uf}`);
    setMunicipios([]);
    // provider auto-sugerido do registry (editável — §7.2)
    if (m.provider_sugerido) setProviderKey(m.provider_sugerido);
    // URLs herdadas do registry substituem as do município anterior (P2.e)
    setWsdlUrl(m.wsdl_url ?? '');
    setUrlProducao(m.ambiente_urls?.producao ?? '');
    setUrlHomologacao(m.ambiente_urls?.homologacao ?? '');
  }

  async function salvar() {
    if (!municipioId) return;
    setSalvando(true);
    try {
      const form = {
        empresa_id: empresaId,
        municipio_id: municipioId,
        provider_key: providerKey,
        inscricao_municipal: inscricaoMunicipal || undefined,
        regime_especial: regimeEspecial || undefined,
        optante_simples: optanteSimples,
        incentivo_fiscal: incentivoFiscal,
        aliquota_iss: aliquotaIss ? Number(aliquotaIss) : undefined,
        iss_retido_padrao: issRetido,
        config: {
          ...(codigoLc116.trim() ? { codigo_lc116_padrao: codigoLc116.trim() } : {}),
          ...(wsdlUrl ? { wsdl_url: wsdlUrl } : {}),
          ...(urlProducao || urlHomologacao
            ? { ambiente_urls: { producao: urlProducao || undefined, homologacao: urlHomologacao || undefined } }
            : {}),
        },
      };
      if (config) await updateNfseConfig(config.id, form);
      else await createNfseConfig(form);
      toast.success(t('financeiro.sucessoSalvar'));
      onSalvo();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setSalvando(false);
    }
  }

  async function salvarCredencial(campo: string, valor: string) {
    if (!config || !valor) return;
    try {
      await salvarNfseCredencial(config.id, { campo, valor });
      toast.success(t('financeiro.sucessoSalvar'));
      if (campo === 'usuario') setCredUsuario('');
      if (campo === 'token') setCredToken('');
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    }
  }


  const exigeA1 = PROVIDER_EXIGE_A1[providerKey];

  return (
    <div className={`${FIN_CARD_CLASS} space-y-4 p-4`}>
      {config && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-bold text-gray-600">
            {t('financeiro.cfgContadorRPS')}: {config.proximo_numero_rps} ({config.rps_serie})
          </span>
          {config.certificado_fingerprint && (
            <span className="truncate font-mono" title={config.certificado_fingerprint}>
              {config.certificado_fingerprint}
            </span>
          )}
        </div>
      )}

      {/* Município com busca */}
      <div className="relative">
        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('admin.municipioBusca')}</label>
        <div className="flex items-center gap-2">
          <FiSearch className="h-4 w-4 text-gray-400" />
          <input
            value={municipioBusca}
            onChange={(e) => setMunicipioBusca(e.target.value)}
            placeholder={t('admin.municipioBusca')}
            className={FIN_INPUT_CLASS}
          />
        </div>
        {municipios.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {municipios.map((m) => (
              <button
                key={m.codigo_ibge}
                type="button"
                onClick={() => escolherMunicipio(m)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span>
                  {m.nome}/{m.uf}
                </span>
                <span className="text-xs text-gray-400">
                  {m.codigo_ibge}
                  {m.provider_sugerido ? ` · ${m.provider_sugerido}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Provider + tributos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('admin.provider')}</label>
          <select value={providerKey} onChange={(e) => setProviderKey(e.target.value as FinNfseProviderKey)} className={FIN_INPUT_CLASS}>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
                {municipioSelecionado?.provider_sugerido === p ? ` (${t('financeiro.cfgProviderSugerido')})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('admin.inscricaoMunicipal')}</label>
          <input value={inscricaoMunicipal} onChange={(e) => setInscricaoMunicipal(e.target.value)} className={FIN_INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgRegimeEspecial')}</label>
          <select value={regimeEspecial} onChange={(e) => setRegimeEspecial(e.target.value)} className={FIN_INPUT_CLASS}>
            <option value="">—</option>
            {REGIMES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500" title={t('financeiro.cfgCodigoLc116Hint')}>
            {t('financeiro.cfgCodigoLc116')}
          </label>
          <input value={codigoLc116} onChange={(e) => setCodigoLc116(e.target.value)} className={FIN_INPUT_CLASS} placeholder="140501" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('admin.aliquotaIss')}</label>
          <input type="number" min={0} step="0.01" value={aliquotaIss} onChange={(e) => setAliquotaIss(e.target.value)} className={FIN_INPUT_CLASS} />
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-gray-700">
          <input type="checkbox" checked={optanteSimples} onChange={(e) => setOptanteSimples(e.target.checked)} className="h-4 w-4" />
          {t('financeiro.cfgOptanteSimples')}
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-gray-700">
          <input type="checkbox" checked={issRetido} onChange={(e) => setIssRetido(e.target.checked)} className="h-4 w-4" />
          {t('financeiro.cfgIssRetidoPadrao')}
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-gray-700">
          <input type="checkbox" checked={incentivoFiscal} onChange={(e) => setIncentivoFiscal(e.target.checked)} className="h-4 w-4" />
          {t('financeiro.cfgIncentivoFiscal')}
        </label>
      </div>

      {/* URLs proprietário */}
      {providerKey === 'proprietario' && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgWsdlUrl')}</label>
            <input value={wsdlUrl} onChange={(e) => setWsdlUrl(e.target.value)} className={FIN_INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgUrlProducao')}</label>
            <input value={urlProducao} onChange={(e) => setUrlProducao(e.target.value)} className={FIN_INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgUrlHomologacao')}</label>
            <input value={urlHomologacao} onChange={(e) => setUrlHomologacao(e.target.value)} className={FIN_INPUT_CLASS} />
          </div>
        </div>
      )}

      {/* A1 unico da empresa (e-Social) — sem upload paralelo */}
      {(exigeA1 || providerKey === "proprietario") && (
        <div className={`rounded-xl border p-3 ${certUnico ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-amber-200 bg-amber-50/50'}`}>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-300">
            {certUnico ? <FiCheckCircle className="h-4 w-4 text-emerald-600" /> : <FiAlertTriangle className="h-4 w-4 text-amber-700" />}
            {t('financeiro.certificadoUnicoTitulo')}
          </p>
          {certUnico ? (
            <div className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
              <p className="font-semibold">{certUnico.nome}{certUnico.subjectCn ? ` · ${certUnico.subjectCn}` : ''}</p>
              <p className="text-xs text-gray-500">{t('financeiro.certificadoUnicoValidade')}: {certUnico.validoAte || '—'}</p>
              <p className="truncate font-mono text-xs text-gray-400" title={certUnico.fingerprint}>{certUnico.fingerprint}</p>
              <p className="text-xs text-gray-500">{t('financeiro.certificadoUnicoHint')}</p>
            </div>
          ) : (
            <p className="text-sm text-amber-800 dark:text-amber-200">{certUnicoErro || t('financeiro.certificadoUnicoAusente')}</p>
          )}
          <a href="/department/e-social" className={`${FIN_BTN_SECONDARY_CLASS} mt-3 inline-flex`}>
            {t('financeiro.certificadoUnicoGerenciar')}
          </a>
        </div>
      )}

      {/* Credenciais webservice proprietário (usuario/token → app_secrets) */}
      {providerKey === 'proprietario' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <input
              placeholder={t('financeiro.nfseCredUsuario')}
              value={credUsuario}
              onChange={(e) => setCredUsuario(e.target.value)}
              className={FIN_INPUT_CLASS}
              autoComplete="off"
            />
            <button type="button" onClick={() => salvarCredencial('usuario', credUsuario)} disabled={!config || !credUsuario} className={FIN_BTN_SECONDARY_CLASS}>
              <FiSave className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder={t('financeiro.nfseCredToken')}
              type="password"
              value={credToken}
              onChange={(e) => setCredToken(e.target.value)}
              className={FIN_INPUT_CLASS}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => salvarCredencial('token', credToken)} disabled={!config || !credToken} className={FIN_BTN_SECONDARY_CLASS}>
              <FiSave className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={salvar} disabled={salvando || !municipioId} className={FIN_BTN_PRIMARY_CLASS}>
          <FiPlus className="h-4 w-4" /> {config ? t('financeiro.salvar') : t('financeiro.cfgCriarConfig')}
        </button>
      </div>
    </div>
  );
}
