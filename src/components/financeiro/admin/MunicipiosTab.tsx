'use client';

/**
 * MunicipiosTab (§7.2): registry de municípios (IBGE) paginado com busca por
 * nome/UF; edição de provider_sugerido / wsdl_url / ambiente_urls (gate admin).
 */
import React, { useEffect, useState } from 'react';
import { FiSearch, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { listMunicipios, updateMunicipio } from '@/lib/financeiro/api-client';
import type { FinMunicipio, FinNfseProviderKey } from '@/types/financeiro';
import {
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  mensagemErro,
} from '@/components/financeiro/shared';

const PROVIDERS: Array<FinNfseProviderKey | ''> = ['', 'abrasf202', 'abrasf204', 'nacional', 'proprietario'];
const PAGE_SIZE = 30;

export default function MunicipiosTab() {
  const { t } = useI18n();
  const [busca, setBusca] = useState('');
  const [uf, setUf] = useState('');
  const [page, setPage] = useState(1);
  const [itens, setItens] = useState<FinMunicipio[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCarregando(true);
      listMunicipios({ busca: busca.trim() || undefined, uf: uf.trim().toUpperCase() || undefined, page, limit: PAGE_SIZE })
        .then((res) => {
          setItens(res.itens);
          setTotal(res.total);
        })
        .catch((e) => toast.error(mensagemErro(e, t('financeiro.erroGeral'))))
        .finally(() => setCarregando(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, uf, page, t]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className={`${FIN_CARD_CLASS} flex flex-wrap items-end gap-3 p-4`}>
        <div className="min-w-56">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('admin.municipioBusca')}</label>
          <div className="flex items-center gap-2">
            <FiSearch className="h-4 w-4 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPage(1);
              }}
              placeholder={t('admin.municipioBusca')}
              className={FIN_INPUT_CLASS}
            />
          </div>
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgUf')}</label>
          <input
            value={uf}
            onChange={(e) => {
              setUf(e.target.value.toUpperCase().slice(0, 2));
              setPage(1);
            }}
            placeholder="RJ"
            className={`${FIN_INPUT_CLASS} text-center font-mono`}
          />
        </div>
        <span className="ml-auto text-xs text-gray-400">
          {total} · {t('financeiro.cfgCodigoIbge')}
        </span>
      </div>

      {/* Tabela */}
      <div className={`${FIN_CARD_CLASS} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgCodigoIbge')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgMunicipio')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgUf')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('admin.provider')}</th>
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgWsdlUrl')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {itens.map((municipio) => (
                <LinhaMunicipio
                  key={municipio.codigo_ibge}
                  municipio={municipio}
                  editando={editando === municipio.codigo_ibge}
                  onEditar={(v) => setEditando(v ? municipio.codigo_ibge : null)}
                  onSalvo={() => {
                    setEditando(null);
                  }}
                />
              ))}
              {!carregando && itens.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={FIN_BTN_SECONDARY_CLASS}>
          ‹
        </button>
        <span className="text-xs text-gray-500">
          {page} / {totalPaginas}
        </span>
        <button type="button" onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={page >= totalPaginas} className={FIN_BTN_SECONDARY_CLASS}>
          ›
        </button>
      </div>
    </div>
  );
}

const PROVIDER_LABEL_KEY: Record<FinNfseProviderKey, string> = {
  abrasf202: 'abrasf202',
  abrasf204: 'abrasf204',
  nacional: 'nacional',
  proprietario: 'proprietario',
};

/** Linha com edição inline (provider/wsdl/ambiente_urls). */
function LinhaMunicipio({
  municipio,
  editando,
  onEditar,
  onSalvo,
}: {
  municipio: FinMunicipio;
  editando: boolean;
  onEditar: (v: boolean) => void;
  onSalvo: () => void;
}) {
  const { t } = useI18n();
  const [provider, setProvider] = useState<FinNfseProviderKey | ''>(municipio.provider_sugerido ?? '');
  const [wsdl, setWsdl] = useState(municipio.wsdl_url ?? '');
  const [urlProd, setUrlProd] = useState(municipio.ambiente_urls?.producao ?? '');
  const [urlHom, setUrlHom] = useState(municipio.ambiente_urls?.homologacao ?? '');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await updateMunicipio(municipio.codigo_ibge, {
        provider_sugerido: provider || undefined,
        wsdl_url: wsdl || null,
        ambiente_urls: urlProd || urlHom ? { producao: urlProd || undefined, homologacao: urlHom || undefined } : null,
      });
      toast.success(t('financeiro.sucessoSalvar'));
      onSalvo();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-2 font-mono text-xs text-gray-500">{municipio.codigo_ibge}</td>
      <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{municipio.nome}</td>
      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{municipio.uf}</td>
      {editando ? (
        <>
          <td className="px-4 py-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value as FinNfseProviderKey | '')} className={`${FIN_INPUT_CLASS} w-auto`}>
              {PROVIDERS.map((p) => (
                <option key={p || 'vazio'} value={p}>
                  {p || '—'}
                </option>
              ))}
            </select>
          </td>
          <td className="px-4 py-2">
            <input value={wsdl} onChange={(e) => setWsdl(e.target.value)} className={`${FIN_INPUT_CLASS} min-w-56 font-mono text-xs`} />
          </td>
          <td className="px-4 py-2">
            <div className="flex items-center gap-1">
              <input value={urlProd} onChange={(e) => setUrlProd(e.target.value)} placeholder={t('financeiro.cfgUrlProducao')} className={`${FIN_INPUT_CLASS} min-w-40 text-xs`} />
              <input value={urlHom} onChange={(e) => setUrlHom(e.target.value)} placeholder={t('financeiro.cfgUrlHomologacao')} className={`${FIN_INPUT_CLASS} min-w-40 text-xs`} />
              <button type="button" onClick={salvar} disabled={salvando} className={FIN_BTN_SECONDARY_CLASS}>
                <FiSave className="h-4 w-4" />
              </button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
            {municipio.provider_sugerido ? PROVIDER_LABEL_KEY[municipio.provider_sugerido] : '—'}
          </td>
          <td className="max-w-48 truncate px-4 py-2 font-mono text-xs text-gray-500" title={municipio.wsdl_url ?? ''}>
            {municipio.wsdl_url ?? '—'}
          </td>
          <td className="px-4 py-2 text-right">
            <button type="button" onClick={() => onEditar(true)} className={FIN_BTN_SECONDARY_CLASS}>
              {t('financeiro.editar')}
            </button>
          </td>
        </>
      )}
    </tr>
  );
}
