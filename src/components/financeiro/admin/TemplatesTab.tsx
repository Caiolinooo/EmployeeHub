'use client';

/**
 * TemplatesTab (§7.2): lista de templates de fatura (nome, tipo, default),
 * upload de xlsx/html, editor de mapping (campo→célula, linhas de serviço,
 * totais) e marcar default.
 */
import React, { useEffect, useState } from 'react';
import { FiUpload, FiTrash2, FiStar, FiSave, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from '@/lib/financeiro/api-client';
import type { FinFaturaTemplate } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  mensagemErro,
} from '@/components/financeiro/shared';

interface MappingEdit {
  celulas: Array<{ campo: string; celula: string }>;
  linhaInicial: number;
  linhaFinal: number;
  colDescricao: string;
  colReferencia: string;
  colValor: string;
  totaisCelula: string;
}

function mappingParaEdicao(mapping: FinFaturaTemplate['mapping']): MappingEdit {
  return {
    celulas: Object.entries(mapping.celulas ?? {}).map(([campo, celula]) => ({ campo, celula })),
    linhaInicial: mapping.servicos?.linhaInicial ?? 18,
    linhaFinal: mapping.servicos?.linhaFinal ?? 29,
    colDescricao: mapping.servicos?.colunas?.descricao ?? 'B',
    colReferencia: mapping.servicos?.colunas?.referencia ?? 'E',
    colValor: mapping.servicos?.colunas?.valor ?? 'H',
    totaisCelula: mapping.totais?.celula ?? '',
  };
}

function edicaoParaMapping(ed: MappingEdit): FinFaturaTemplate['mapping'] {
  return {
    ...(ed.celulas.length > 0 ? { celulas: Object.fromEntries(ed.celulas.filter((c) => c.campo).map((c) => [c.campo, c.celula])) } : {}),
    servicos: {
      linhaInicial: ed.linhaInicial,
      linhaFinal: ed.linhaFinal,
      colunas: { descricao: ed.colDescricao, referencia: ed.colReferencia, valor: ed.colValor },
    },
    ...(ed.totaisCelula ? { totais: { celula: ed.totaisCelula } } : {}),
  };
}

export default function TemplatesTab() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<FinFaturaTemplate[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  // Upload
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'xlsx' | 'html'>('xlsx');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setTemplates(await listTemplates());
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar() {
    if (!nome.trim() || !arquivo) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('nome', nome.trim());
      fd.append('tipo', tipo);
      fd.append('arquivo', arquivo);
      await createTemplate(fd);
      toast.success(t('financeiro.sucessoSalvar'));
      setNome('');
      setArquivo(null);
      carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setEnviando(false);
    }
  }

  async function marcarDefault(template: FinFaturaTemplate) {
    try {
      await updateTemplate(template.id, { is_default: true });
      toast.success(t('financeiro.sucessoSalvar'));
      carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    }
  }

  async function excluir(id: string) {
    if (!window.confirm(`${t('financeiro.excluir')}?`)) return;
    try {
      await deleteTemplate(id);
      carregar();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className={`${FIN_CARD_CLASS} flex flex-wrap items-end gap-3 p-4`}>
        <div className="min-w-48">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgNomeTemplate')}</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={FIN_INPUT_CLASS} />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cfgTipoTemplate')}</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as 'xlsx' | 'html')} className={FIN_INPUT_CLASS}>
            <option value="xlsx">xlsx</option>
            <option value="html">html</option>
          </select>
        </div>
        <label className={`${FIN_BTN_SECONDARY_CLASS} cursor-pointer`}>
          <FiUpload className="h-4 w-4" /> {t('financeiro.cfgUploadTemplate')}
          <input type="file" accept=".xlsx,.xls,.html,.htm" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </label>
        {arquivo && <span className="max-w-48 truncate text-xs text-gray-500">{arquivo.name}</span>}
        <button type="button" onClick={enviar} disabled={enviando || !nome.trim() || !arquivo} className={`${FIN_BTN_PRIMARY_CLASS} ml-auto`}>
          <FiUpload className="h-4 w-4" /> {t('financeiro.salvar')}
        </button>
      </div>

      {/* Lista */}
      {carregando && <p className="text-sm text-gray-400">{t('financeiro.carregando')}</p>}
      {!carregando && templates.length === 0 && <p className={`${FIN_CARD_CLASS} p-6 text-center text-sm text-gray-400`}>—</p>}
      <div className="space-y-3">
        {templates.map((tpl) => (
          <div key={tpl.id} className={`${FIN_CARD_CLASS} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                  {tpl.nome}
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">{tpl.tipo}</span>
                  {tpl.is_default && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      <FiStar className="h-3 w-3" /> {t('financeiro.cfgPadrao')}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-400">{tpl.storage_path}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!tpl.is_default && (
                  <button type="button" onClick={() => marcarDefault(tpl)} className={FIN_BTN_SECONDARY_CLASS}>
                    <FiStar className="h-4 w-4" /> {t('financeiro.cfgMarcarDefault')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpandido((atual) => (atual === tpl.id ? null : tpl.id))}
                  className={FIN_BTN_SECONDARY_CLASS}
                >
                  {t('financeiro.cfgMapping')}
                </button>
                <button type="button" onClick={() => excluir(tpl.id)} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600">
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {expandido === tpl.id && (
              <MappingEditor
                template={tpl}
                onSalvo={() => {
                  setExpandido(null);
                  carregar();
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Editor de mapping (§7.2): campo→célula, linhas de serviços, totais. */
function MappingEditor({ template, onSalvo }: { template: FinFaturaTemplate; onSalvo: () => void }) {
  const { t } = useI18n();
  const [ed, setEd] = useState<MappingEdit>(mappingParaEdicao(template.mapping));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await updateTemplate(template.id, { mapping: edicaoParaMapping(ed) });
      toast.success(t('financeiro.sucessoSalvar'));
      onSalvo();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 p-4">
      {/* campo → célula */}
      <div className="space-y-1">
        {ed.celulas.map((linha, indice) => (
          <div key={indice} className="flex items-center gap-2">
            <input
              placeholder={t('financeiro.cfgCampo')}
              value={linha.campo}
              onChange={(e) =>
                setEd({ ...ed, celulas: ed.celulas.map((c, i) => (i === indice ? { ...c, campo: e.target.value } : c)) })
              }
              className={`${FIN_INPUT_CLASS} max-w-48`}
            />
            <input
              placeholder={t('financeiro.cfgCelula')}
              value={linha.celula}
              onChange={(e) =>
                setEd({ ...ed, celulas: ed.celulas.map((c, i) => (i === indice ? { ...c, celula: e.target.value.toUpperCase() } : c)) })
              }
              className={`${FIN_INPUT_CLASS} w-24 text-center font-mono`}
            />
            <button
              type="button"
              onClick={() => setEd({ ...ed, celulas: ed.celulas.filter((_, i) => i !== indice) })}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setEd({ ...ed, celulas: [...ed.celulas, { campo: '', celula: '' }] })} className={FIN_BTN_SECONDARY_CLASS}>
          <FiPlus className="h-4 w-4" /> {t('financeiro.cfgCampo')} → {t('financeiro.cfgCelula')}
        </button>
      </div>

      {/* serviços */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-gray-400">{t('financeiro.cfgLinhaInicial')}</label>
          <input
            type="number"
            value={ed.linhaInicial}
            onChange={(e) => setEd({ ...ed, linhaInicial: Number(e.target.value) || 0 })}
            className={`${FIN_INPUT_CLASS} text-center`}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-gray-400">{t('financeiro.cfgLinhaFinal')}</label>
          <input
            type="number"
            value={ed.linhaFinal}
            onChange={(e) => setEd({ ...ed, linhaFinal: Number(e.target.value) || 0 })}
            className={`${FIN_INPUT_CLASS} text-center`}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-gray-400">{t('financeiro.descricao')}</label>
          <input value={ed.colDescricao} onChange={(e) => setEd({ ...ed, colDescricao: e.target.value.toUpperCase() })} className={`${FIN_INPUT_CLASS} text-center font-mono`} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-gray-400">{t('financeiro.referencia')}</label>
          <input value={ed.colReferencia} onChange={(e) => setEd({ ...ed, colReferencia: e.target.value.toUpperCase() })} className={`${FIN_INPUT_CLASS} text-center font-mono`} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase text-gray-400">{t('financeiro.valor')}</label>
          <input value={ed.colValor} onChange={(e) => setEd({ ...ed, colValor: e.target.value.toUpperCase() })} className={`${FIN_INPUT_CLASS} text-center font-mono`} />
        </div>
      </div>

      <div className="max-w-48">
        <label className="mb-1 block text-[11px] font-bold uppercase text-gray-400">
          {t('financeiro.total')} ({t('financeiro.cfgCelula')})
        </label>
        <input value={ed.totaisCelula} onChange={(e) => setEd({ ...ed, totaisCelula: e.target.value.toUpperCase() })} className={`${FIN_INPUT_CLASS} text-center font-mono`} />
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={salvar} disabled={salvando} className={FIN_BTN_PRIMARY_CLASS}>
          <FiSave className="h-4 w-4" /> {t('financeiro.salvar')}
        </button>
      </div>
    </div>
  );
}
