'use client';

/**
 * FaturaWizard (§7.1) — modal fullscreen padrão GT com 4 passos:
 * 1 origem (folha → gerar-da-folha | medição upload XLSX | manual),
 * 2 cliente (select + criação inline), 3 revisão de itens editáveis,
 * 4 conferência → salvar rascunho. Contratos: POST /faturas e
 * POST /faturas/gerar-da-folha (§6).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FiX, FiCheck, FiChevronLeft, FiChevronRight, FiPlus, FiTrash2, FiUpload, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useI18n } from '@/contexts/I18nContext';
import {
  listClientes, createCliente, createFatura, gerarFaturaDaFolha, listTemplates,
} from '@/lib/financeiro/api-client';
import { fetchWithToken } from '@/lib/tokenStorage';
import type { FinCliente, FinClienteForm, FinFatura, FinFaturaItemInput, FinFaturaTemplate } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_CARD_CLASS,
  FIN_INPUT_CLASS,
  formatarMoeda,
  mensagemErro,
  useFolhaStatusLabel,
  useOrigemLabel,
} from '@/components/financeiro/shared';

type Origem = 'folha' | 'medicao' | 'manual';

interface ItemEditavel extends FinFaturaItemInput {
  _id: string;
}

interface FolhaOpcao {
  id: string;
  companyId: string;
  referenceMonth: number;
  referenceYear: number;
  status: string;
  totalNet: number;
  totalEmployees: number;
}

interface EmpresaOpcao {
  id: string;
  name: string;
}

let sequenciaItem = 0;
function novoItem(parcial?: Partial<FinFaturaItemInput>): ItemEditavel {
  sequenciaItem += 1;
  return {
    _id: `item-${Date.now()}-${sequenciaItem}`,
    descricao: '',
    quantidade: 1,
    valor_unitario: 0,
    origem: 'manual',
    ...parcial,
  };
}

/** Normaliza cabeçalhos (sem acento, minúsculo) para casar descrição/referência/valor. */
function chaveColuna(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function itensDePlanilha(buffer: ArrayBuffer): ItemEditavel[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const itens: ItemEditavel[] = [];
  for (const linha of linhas) {
    const entradas = Object.entries(linha);
    let descricao = '';
    let referencia = '';
    let valor = 0;
    for (const [coluna, bruto] of entradas) {
      const chave = chaveColuna(String(coluna));
      if (!descricao && (chave === 'descricao' || chave === 'description')) descricao = String(bruto ?? '');
      else if (!referencia && (chave === 'referencia' || chave === 'reference')) referencia = String(bruto ?? '');
      else if (chave === 'valor' || chave === 'value' || chave === 'amount') valor = Number(bruto) || 0;
    }
    if (!descricao && !valor) continue;
    itens.push(novoItem({ descricao: descricao || referencia, referencia, valor_unitario: valor, origem: 'medicao' }));
  }
  return itens;
}

export default function FaturaWizard({ onClose, onCriada }: { onClose: () => void; onCriada?: (fatura: FinFatura) => void }) {
  const { t } = useI18n();
  const labelFolha = useFolhaStatusLabel();
  const labelOrigem = useOrigemLabel();

  const [passo, setPasso] = useState(1);
  const [origem, setOrigem] = useState<Origem>('manual');
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [folhas, setFolhas] = useState<FolhaOpcao[]>([]);
  const [sheetId, setSheetId] = useState('');
  const [clientes, setClientes] = useState<FinCliente[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [nc, setNc] = useState({ nome: '', documento: '', email: '', moeda: 'BRL' });
  const [itens, setItens] = useState<ItemEditavel[]>([novoItem()]);
  const [templates, setTemplates] = useState<FinFaturaTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [moeda, setMoeda] = useState('BRL');
  const [dataVencimento, setDataVencimento] = useState('');
  const [callOff, setCallOff] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

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
        /* template é opcional */
      }
    })();
  }, []);

  // Clientes do emissor selecionado (fin_clientes é multi-empresa — §2.1)
  useEffect(() => {
    let vivo = true;
    listClientes({ empresaId: empresaId || undefined, limit: 200 })
      .then((lista) => {
        if (vivo) {
          setClientes(lista);
          // cliente de outra empresa não permanece selecionado
          setClienteId((atual) => (atual && !lista.some((c) => c.id === atual) ? '' : atual));
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  // Folhas approved|paid para a origem "folha" (§6: gerar-da-folha exige aprovadas)
  useEffect(() => {
    if (origem !== 'folha') return;
    (async () => {
      try {
        const [aprovadas, pagas] = await Promise.all([
          fetchWithToken('/api/payroll/sheets?status=approved&limit=100').then((r) => r.json()),
          fetchWithToken('/api/payroll/sheets?status=paid&limit=100').then((r) => r.json()),
        ]);
        const combinadas = [
          ...((aprovadas?.data ?? []) as FolhaOpcao[]),
          ...((pagas?.data ?? []) as FolhaOpcao[]),
        ];
        setFolhas(combinadas);
      } catch {
        setFolhas([]);
      }
    })();
  }, [origem]);

  const totalItens = useMemo(
    () => itens.reduce((soma, it) => soma + (it.quantidade ?? 1) * (it.valor_unitario ?? 0), 0),
    [itens],
  );

  const podeAvancar =
    (passo === 1 && (origem === 'manual' || (origem === 'folha' && sheetId) || (origem === 'medicao' && itens.length > 0))) ||
    (passo === 2 && Boolean(clienteId)) ||
    passo === 3 ||
    passo === 4;

  async function criarClienteInline() {
    if (!nc.nome.trim() || !empresaId) {
      toast.error(t('financeiro.erroSalvar'));
      return;
    }
    try {
      const form: FinClienteForm = {
        empresa_id: empresaId,
        client_key: nc.nome.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 60) || `CLI_${Date.now()}`,
        nome: nc.nome.trim(),
        documento: nc.documento.trim() || undefined,
        email: nc.email.trim() || undefined,
        moeda: nc.moeda || 'BRL',
      };
      const cliente = await createCliente(form);
      setClientes((atual) => [...atual, cliente]);
      setClienteId(cliente.id);
      setNovoClienteAberto(false);
      setNc({ nome: '', documento: '', email: '', moeda: 'BRL' });
      toast.success(t('financeiro.sucessoSalvar'));
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroSalvar')));
    }
  }

  async function receberPlanilha(arquivo: File) {
    try {
      const buffer = await arquivo.arrayBuffer();
      const parsed = itensDePlanilha(buffer);
      if (parsed.length === 0) {
        toast.error(t('financeiro.medicaoHint'));
        return;
      }
      setItens(parsed);
      toast.success(`${t('financeiro.arquivoSelecionado')}: ${arquivo.name} (${parsed.length})`);
    } catch {
      toast.error(t('financeiro.medicaoHint'));
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      let criada: FinFatura;
      if (origem === 'folha') {
        criada = await gerarFaturaDaFolha({ sheetId, clienteId, templateId: templateId || undefined });
      } else {
        criada = await createFatura({
          empresaId,
          clienteId,
          origemTipo: origem,
          templateId: templateId || undefined,
          moeda,
          dataVencimento: dataVencimento || undefined,
          callOff: callOff || undefined,
          observacoes: observacoes || undefined,
          itens: itens
            .filter((it) => it.descricao.trim())
            .map(({ descricao, referencia, quantidade, valor_unitario, valor_total, origem: origemItem }) => ({
              descricao: descricao.trim(),
              referencia: referencia || undefined,
              quantidade: quantidade ?? 1,
              valor_unitario: valor_unitario ?? 0,
              valor_total,
              origem: origemItem,
            })),
        });
      }
      toast.success(t('financeiro.faturaCriada'));
      onCriada?.(criada);
      onClose();
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setSalvando(false);
    }
  }

  const passosLabels = [t('financeiro.passoOrigem'), t('financeiro.passoCliente'), t('financeiro.passoItens'), t('financeiro.passoConferencia')];
  const origens: Origem[] = ['folha', 'medicao', 'manual'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-2">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('financeiro.novaFatura')}
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-[min(98dvh,calc(100dvh-1rem))] sm:rounded-2xl sm:border sm:border-gray-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-blue text-white shadow-sm">
              <FiFileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">{t('financeiro.novaFatura')}</h2>
              <p className="text-xs text-gray-500">
                {t('financeiro.passo')} {passo}/4 — {passosLabels[passo - 1]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
            aria-label={t('financeiro.fechar')}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          {passo === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {origens.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setOrigem(o);
                      setItens(o === 'manual' ? [novoItem()] : itens);
                    }}
                    className={`rounded-xl border p-4 text-left text-sm font-semibold transition ${
                      origem === o
                        ? 'border-abz-blue bg-abz-light-blue/40 text-abz-blue-dark'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {labelOrigem(o)}
                  </button>
                ))}
              </div>

              {origem === 'folha' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.selecionarFolha')}</label>
                  <select
                    value={sheetId}
                    onChange={(e) => {
                      setSheetId(e.target.value);
                      const folha = folhas.find((f) => f.id === e.target.value);
                      if (folha?.companyId) setEmpresaId(folha.companyId);
                    }}
                    className={FIN_INPUT_CLASS}
                  >
                    <option value="">{folhas.length === 0 ? t('financeiro.nenhumaFolhaAprovada') : '—'}</option>
                    {folhas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {String(f.referenceMonth).padStart(2, '0')}/{f.referenceYear} · {labelFolha(f.status)} · {f.totalEmployees} ·{' '}
                        {formatarMoeda(f.totalNet)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">{t('financeiro.erroFaturaNaoAprovada')}</p>
                </div>
              )}

              {origem === 'medicao' && (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center transition hover:border-abz-blue hover:bg-abz-light-blue/20">
                  <FiUpload className="h-8 w-8 text-abz-blue" />
                  <span className="text-sm font-semibold text-gray-700">{t('financeiro.uploadMedicao')}</span>
                  <span className="text-xs text-gray-400">{t('financeiro.medicaoHint')}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0];
                      if (arquivo) receberPlanilha(arquivo);
                    }}
                  />
                </label>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.empresa')}</label>
                <select
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  className={FIN_INPUT_CLASS}
                  disabled={origem === 'folha' && Boolean(sheetId)}
                >
                  <option value="">{t('financeiro.todasEmpresas')}</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {passo === 2 && (
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.cliente')}</label>
                  <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={FIN_INPUT_CLASS}>
                    <option value="">—</option>
                    {clientes.map((cli) => (
                      <option key={cli.id} value={cli.id}>
                        {cli.nome} ({cli.client_key}) · {cli.moeda}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => setNovoClienteAberto((v) => !v)} className={FIN_BTN_SECONDARY_CLASS}>
                  <FiPlus className="h-4 w-4" /> {t('financeiro.novoCliente')}
                </button>
              </div>
              {novoClienteAberto && (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                  <input
                    placeholder={t('financeiro.clienteNome')}
                    value={nc.nome}
                    onChange={(e) => setNc({ ...nc, nome: e.target.value })}
                    className={FIN_INPUT_CLASS}
                  />
                  <input
                    placeholder={t('financeiro.clienteDocumento')}
                    value={nc.documento}
                    onChange={(e) => setNc({ ...nc, documento: e.target.value })}
                    className={FIN_INPUT_CLASS}
                  />
                  <input
                    placeholder={t('financeiro.clienteEmail')}
                    value={nc.email}
                    onChange={(e) => setNc({ ...nc, email: e.target.value })}
                    className={FIN_INPUT_CLASS}
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder={t('financeiro.moeda')}
                      value={nc.moeda}
                      onChange={(e) => setNc({ ...nc, moeda: e.target.value.toUpperCase().slice(0, 3) })}
                      className={FIN_INPUT_CLASS}
                    />
                    <button type="button" onClick={criarClienteInline} className={FIN_BTN_PRIMARY_CLASS}>
                      <FiCheck className="h-4 w-4" /> {t('financeiro.salvar')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {passo === 3 && (
            <div className="space-y-3">
              {origem === 'folha' ? (
                <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  {labelOrigem('folha')}: {t('financeiro.passoItens')} — {t('financeiro.totalItens')}: {formatarMoeda(totalItens, moeda)}
                </p>
              ) : (
                <>
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.descricao')}</th>
                        <th className="px-2 py-1 text-left text-xs font-bold uppercase text-gray-500">{t('financeiro.referencia')}</th>
                        <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.quantidade')}</th>
                        <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.valorUnitario')}</th>
                        <th className="px-2 py-1 text-right text-xs font-bold uppercase text-gray-500">{t('financeiro.total')}</th>
                        <th className="px-2 py-1" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {itens.map((item, indice) => (
                        <tr key={item._id}>
                          <td className="px-2 py-1">
                            <input
                              value={item.descricao}
                              onChange={(e) =>
                                setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, descricao: e.target.value } : it)))
                              }
                              className={FIN_INPUT_CLASS}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              value={item.referencia ?? ''}
                              onChange={(e) =>
                                setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, referencia: e.target.value } : it)))
                              }
                              className={FIN_INPUT_CLASS}
                            />
                          </td>
                          <td className="px-2 py-1 w-24">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.quantidade ?? 1}
                              onChange={(e) =>
                                setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, quantidade: Number(e.target.value) } : it)))
                              }
                              className={`${FIN_INPUT_CLASS} text-right`}
                            />
                          </td>
                          <td className="px-2 py-1 w-32">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.valor_unitario ?? 0}
                              onChange={(e) =>
                                setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, valor_unitario: Number(e.target.value) } : it)))
                              }
                              className={`${FIN_INPUT_CLASS} text-right`}
                            />
                          </td>
                          <td className="px-2 py-1 text-right font-semibold text-gray-700">
                            {formatarMoeda((item.quantidade ?? 1) * (item.valor_unitario ?? 0), moeda)}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <button
                              type="button"
                              onClick={() => setItens((atual) => atual.filter((_, i) => i !== indice))}
                              className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label={t('financeiro.removerItem')}
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {itens.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-2 py-6 text-center text-sm text-gray-400">
                            {t('financeiro.semItens')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <button type="button" onClick={() => setItens((atual) => [...atual, novoItem({ origem })])} className={FIN_BTN_SECONDARY_CLASS}>
                    <FiPlus className="h-4 w-4" /> {t('financeiro.adicionarItem')}
                  </button>
                </>
              )}
            </div>
          )}

          {passo === 4 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.template')}</label>
                  <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={FIN_INPUT_CLASS}>
                    <option value="">—</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.nome} ({tpl.tipo}){tpl.is_default ? ` · ${t('financeiro.cfgPadrao')}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.moeda')}</label>
                    <input value={moeda} onChange={(e) => setMoeda(e.target.value.toUpperCase().slice(0, 3))} className={FIN_INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.dataVencimento')}</label>
                    <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className={FIN_INPUT_CLASS} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.callOff')}</label>
                  <input value={callOff} onChange={(e) => setCallOff(e.target.value)} className={FIN_INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.observacoes')}</label>
                  <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className={FIN_INPUT_CLASS} />
                </div>
              </div>
              <div className={`${FIN_CARD_CLASS} space-y-2 p-4`}>
                <p className="text-xs font-bold uppercase text-gray-400">{t('financeiro.passoConferencia')}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('financeiro.origem')}</span>
                  <span className="font-semibold text-gray-900">{labelOrigem(origem)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('financeiro.cliente')}</span>
                  <span className="font-semibold text-gray-900">
                    {clientes.find((c) => c.id === clienteId)?.nome ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('financeiro.itens')}</span>
                  <span className="font-semibold text-gray-900">
                    {origem === 'folha' ? t('financeiro.origemFolha') : itens.filter((it) => it.descricao.trim()).length}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 text-base">
                  <span className="font-bold text-gray-700">{t('financeiro.totalItens')}</span>
                  <span className="font-bold text-abz-blue">{formatarMoeda(totalItens, moeda)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer de navegação */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => setPasso((p) => Math.max(1, p - 1))} disabled={passo === 1} className={FIN_BTN_SECONDARY_CLASS}>
            <FiChevronLeft className="h-4 w-4" /> {t('financeiro.anterior')}
          </button>
          {passo < 4 ? (
            <button type="button" onClick={() => setPasso((p) => p + 1)} disabled={!podeAvancar} className={FIN_BTN_PRIMARY_CLASS}>
              {t('financeiro.proximo')} <FiChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={salvar} disabled={salvando} className={FIN_BTN_PRIMARY_CLASS}>
              <FiCheck className="h-4 w-4" /> {t('financeiro.salvarRascunho')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
