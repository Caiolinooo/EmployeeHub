'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertTriangle, FiCheckCircle, FiMinusCircle } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';
import {
  LABEL_AVISO_PREVIO,
  LABEL_TIPO_RESCISAO,
  TIPOS_RESCISAO,
  AVISO_PREVIO_TIPOS,
  avisoDefaultParaTipo,
  seguroDesempregoElegivel,
  sugerirAvisoPrevioDias,
  verbasParaRescisao,
  type AvisoPrevioTipo,
  type TipoRescisao,
} from '@/lib/gestao-tripulantes/desligamento';
import type {
  GTDesligamento,
  GTDesligamentoEtapas,
} from '@/types/gestao-tripulantes';

export interface DesligamentoConcluido {
  desligamento: GTDesligamento | null;
  etapas: GTDesligamentoEtapas;
  data_desligamento: string;
  mtv_deslig: string;
}

interface Props {
  colaboradorId: string;
  colaboradorNome: string;
  dataAdmissao?: string | null;
  onClose: () => void;
  onConcluido: (result: DesligamentoConcluido) => void;
}

type Step = 'form' | 'confirm' | 'result';

function todayCivil(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatBrDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function DesligamentoHistorico({ desligamento }: { desligamento: GTDesligamento }) {
  return (
    <div className="space-y-4 p-6" data-testid="desligamento-historico">
      <div className="rounded-xl border border-red-100 bg-red-50/80 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-red-800">Desligamento registrado</p>
        <p className="mt-1 text-sm text-red-900">
          {LABEL_TIPO_RESCISAO[desligamento.tipo_rescisao]} em {formatBrDate(desligamento.data_desligamento)}
        </p>
        <p className="mt-1 text-xs text-red-700">
          Status: {desligamento.status} · e-Social mtvDeslig {desligamento.mtv_deslig}
          {desligamento.prazo_pagamento
            ? ` · prazo de pagamento ${formatBrDate(desligamento.prazo_pagamento)}`
            : ''}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-500">Aviso prévio</dt>
          <dd className="font-medium text-gray-800">
            {LABEL_AVISO_PREVIO[desligamento.aviso_previo_tipo]}
            {desligamento.aviso_previo_dias != null ? ` (${desligamento.aviso_previo_dias} dias)` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Último dia trabalhado</dt>
          <dd className="font-medium text-gray-800">{formatBrDate(desligamento.data_ultimo_dia_trabalhado)}</dd>
        </div>
        {desligamento.motivo && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Motivo</dt>
            <dd className="text-gray-800">{desligamento.motivo}</dd>
          </div>
        )}
        {desligamento.observacoes && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Observações</dt>
            <dd className="text-gray-800">{desligamento.observacoes}</dd>
          </div>
        )}
      </dl>
      {desligamento.verbas_previstas.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-gray-500">Verbas previstas (folha)</p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {desligamento.verbas_previstas.map((v) => (
              <li key={v.code} className="px-3 py-2 text-sm">
                <span className="font-mono text-xs text-gray-500">{v.code}</span>{' '}
                <span className="font-medium text-gray-800">{v.name}</span>
                <p className="text-xs text-gray-500">{v.observation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DesligamentoModal({
  colaboradorId,
  colaboradorNome,
  dataAdmissao,
  onClose,
  onConcluido,
}: Props) {
  const [step, setStep] = useState<Step>('form');
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState<TipoRescisao>('sem_justa_causa');
  const [dataDesligamento, setDataDesligamento] = useState(todayCivil);
  const [motivo, setMotivo] = useState('');
  const [avisoTipo, setAvisoTipo] = useState<AvisoPrevioTipo>(avisoDefaultParaTipo('sem_justa_causa'));
  const [avisoDias, setAvisoDias] = useState(() => sugerirAvisoPrevioDias(dataAdmissao, todayCivil()));
  const [ultimoDia, setUltimoDia] = useState(todayCivil);
  const [observacoes, setObservacoes] = useState('');
  const [etapas, setEtapas] = useState<GTDesligamentoEtapas | null>(null);
  const [criado, setCriado] = useState<GTDesligamento | null>(null);

  const verbas = useMemo(() => verbasParaRescisao(tipo, avisoTipo), [tipo, avisoTipo]);

  const onChangeTipo = (next: TipoRescisao) => {
    setTipo(next);
    setAvisoTipo(avisoDefaultParaTipo(next));
  };

  const onChangeData = (next: string) => {
    setDataDesligamento(next);
    setAvisoDias(sugerirAvisoPrevioDias(dataAdmissao, next || todayCivil()));
    if (!ultimoDia || ultimoDia === dataDesligamento) setUltimoDia(next);
  };

  const submit = async () => {
    try {
      setSaving(true);
      const res = await fetchWithToken(`/api/gestao-tripulantes/colaboradores/${colaboradorId}/desligamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_rescisao: tipo,
          data_desligamento: dataDesligamento,
          motivo,
          aviso_previo_tipo: avisoTipo,
          aviso_previo_dias: avisoDias,
          data_ultimo_dia_trabalhado: ultimoDia,
          observacoes,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: GTDesligamento | null;
        etapas?: GTDesligamentoEtapas;
      };
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao registrar desligamento');
      }
      const nextEtapas = json.etapas || {
        gt: { ok: true },
        payroll: { ok: false, skipped: true },
        esocial: { ok: false },
      };
      setCriado(json.data || null);
      setEtapas(nextEtapas);
      setStep('result');
      onConcluido({
        desligamento: json.data || null,
        etapas: nextEtapas,
        data_desligamento: dataDesligamento,
        mtv_deslig: json.data?.mtv_deslig || '',
      });
      toast.success('Desligamento registrado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desligar colaborador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm"
        onClick={onClose}
        data-testid="desligamento-modal"
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative flex max-h-[min(92dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-red-100 bg-red-50 px-5 py-3">
            <div>
              <h3 className="text-base font-bold text-red-900">Desligar colaborador</h3>
              <p className="text-xs text-red-700 truncate">{colaboradorNome}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-red-100">
              <FiX className="h-5 w-5 text-red-800" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            {step === 'form' && (
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Tipo de rescisão</span>
                  <select
                    value={tipo}
                    onChange={(e) => onChangeTipo(e.target.value as TipoRescisao)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {TIPOS_RESCISAO.map((t) => (
                      <option key={t} value={t}>{LABEL_TIPO_RESCISAO[t]}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Data do desligamento</span>
                    <input
                      type="date"
                      value={dataDesligamento}
                      onChange={(e) => onChangeData(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Último dia trabalhado</span>
                    <input
                      type="date"
                      value={ultimoDia}
                      onChange={(e) => setUltimoDia(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Aviso prévio</span>
                    <select
                      value={avisoTipo}
                      onChange={(e) => setAvisoTipo(e.target.value as AvisoPrevioTipo)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {AVISO_PREVIO_TIPOS.map((t) => (
                        <option key={t} value={t}>{LABEL_AVISO_PREVIO[t]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Dias de aviso (sugestão 30+3/ano)</span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={avisoDias}
                      onChange={(e) => setAvisoDias(Number(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Motivo (texto livre)</span>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Descrição interna do desligamento"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Observações</span>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}

            {step === 'confirm' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    O colaborador será marcado como inativo, o e-Social S-2299 será disparado
                    (mtvDeslig do tipo escolhido) e a folha tentará gerar as rubricas abaixo.
                    Pagamento em até 10 dias corridos. Esta ação não pode ser desfeita aqui.
                  </p>
                </div>
                <p className="text-sm text-gray-700">
                  <strong>{LABEL_TIPO_RESCISAO[tipo]}</strong> em {formatBrDate(dataDesligamento)}.
                  Seguro-desemprego: {seguroDesempregoElegivel(tipo) ? 'elegível (conferir)' : 'não elegível'}.
                </p>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {verbas.map((v) => (
                    <li key={v.code} className="px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-gray-500">{v.code}</span>{' '}
                      {v.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 'result' && etapas && (
              <div className="space-y-3">
                <EtapaLinha ok={etapas.gt.ok} label="Gestão de Tripulantes" detail={etapas.gt.warning} />
                <EtapaLinha
                  ok={etapas.payroll.ok}
                  skipped={etapas.payroll.skipped}
                  label="Folha de pagamento"
                  detail={etapas.payroll.warning || (etapas.payroll.sheet_id ? `Folha ${etapas.payroll.sheet_id.slice(0, 8)}…` : undefined)}
                />
                <EtapaLinha
                  ok={etapas.esocial.ok}
                  label="e-Social S-2299"
                  detail={etapas.esocial.warning || (etapas.esocial.evento_id ? `Evento ${etapas.esocial.evento_id.slice(0, 8)}…` : undefined)}
                />
                {criado && <DesligamentoHistorico desligamento={criado} />}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            {step === 'form' && (
              <>
                <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Revisar
                </button>
              </>
            )}
            {step === 'confirm' && (
              <>
                <button type="button" onClick={() => setStep('form')} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { void submit(); }}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Registrando…' : 'Confirmar desligamento'}
                </button>
              </>
            )}
            {step === 'result' && (
              <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white">
                Fechar
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function EtapaLinha({
  ok,
  skipped,
  label,
  detail,
}: {
  ok: boolean;
  skipped?: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
      {ok ? (
        <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <FiMinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      )}
      <div>
        <p className="font-medium text-gray-800">
          {label}{' '}
          <span className="font-normal text-gray-500">
            {ok ? 'ok' : skipped ? 'ignorado' : 'não concluído'}
          </span>
        </p>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
      </div>
    </div>
  );
}
