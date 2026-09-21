'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiCheckCircle, FiClock, FiRefreshCw, FiSend, FiShield, FiX, FiXCircle } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useSignature } from '@/contexts/SignatureContext';
import type { AprovadorObrigatorio, AssinaturaFechamento } from '@/lib/gestao-tripulantes/fechamento-assinatura';

/** Contrato 3 — props EXATAS consumidas pelo DpFolhaPanel. */
export interface AprovacaoFolhaModalProps {
  open: boolean;
  onClose: () => void;
  sheetId: string;
  sheetLabel?: string;
  onResultado?: (resultado: 'aprovado' | 'rejeitado' | 'cancelado') => void;
}

/** Estado devolvido pelo GET /api/payroll/sheets/[id]/aprovacao. */
interface EstadoAprovacao {
  sheet: {
    id: string;
    status: string;
    reference_month: number;
    reference_year: number;
    total_gross: number | null;
    total_net: number | null;
    approved_by: string | null;
    approved_at: string | null;
  };
  aprovacao: {
    aprovadores: AprovadorObrigatorio[];
    assinaturas: AssinaturaFechamento[];
    rejeicao?: { por: string; motivo: string; em: string };
    hash?: string;
  } | null;
  pendentes: AprovadorObrigatorio[];
  assinados: number;
  obrigatorios: number;
  todosAssinaram: boolean;
  aprovado: boolean;
  hash: string | null;
}

function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

export default function AprovacaoFolhaModal({
  open,
  onClose,
  sheetId,
  sheetLabel,
  onResultado,
}: AprovacaoFolhaModalProps) {
  const { requestSignature } = useSignature();
  const [estado, setEstado] = useState<EstadoAprovacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  /** Uma decisão (aprovado/rejeitado) já foi reportada nesta abertura. */
  const decidiuRef = useRef(false);

  const load = useCallback(async () => {
    if (!sheetId) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchWithToken(`/api/payroll/sheets/${sheetId}/aprovacao`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erro ao carregar aprovação');
      setEstado(json.data as EstadoAprovacao);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar aprovação');
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    if (open && sheetId) {
      decidiuRef.current = false;
      load();
      setMotivo('');
    }
  }, [open, sheetId, load]);

  const assinar = async () => {
    try {
      // Sempre passa pelo modal global de assinatura antes do POST (padrão GT v2).
      const sign = await requestSignature({
        title: 'Assinatura Digital — Folha de Pagamento',
        description: `Assinar a aprovação da folha ${sheetLabel || sheetId}.`,
      });
      if (!sign) return;
      setBusy(true);
      const res = await fetchWithToken(`/api/payroll/sheets/${sheetId}/aprovacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_url: sign.signatureUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao assinar');
      toast.success(json.data.aprovado ? 'Folha aprovada (100% das assinaturas)' : 'Assinatura registrada');
      if (json.data.aprovado) {
        decidiuRef.current = true;
        onResultado?.('aprovado');
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na assinatura');
    } finally {
      setBusy(false);
    }
  };

  const rejeitar = async () => {
    if (!motivo.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }
    try {
      setBusy(true);
      const res = await fetchWithToken(`/api/payroll/sheets/${sheetId}/aprovacao`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao rejeitar');
      toast.success('Aprovação rejeitada — a folha permanece calculada');
      setMotivo('');
      decidiuRef.current = true;
      onResultado?.('rejeitado');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na rejeição');
    } finally {
      setBusy(false);
    }
  };

  const fechar = () => {
    if (!decidiuRef.current) {
      onResultado?.('cancelado');
    }
    onClose();
  };

  if (!open) return null;

  const aprovacao = estado?.aprovacao || null;
  const rejeitada = Boolean(aprovacao?.rejeicao);
  const progresso = estado && estado.obrigatorios > 0
    ? `${estado.assinados}/${estado.obrigatorios}`
    : `${estado?.assinados || 0}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-2">
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden border-0 bg-white shadow-2xl h-[100dvh] rounded-none sm:h-[min(92dvh,calc(100dvh-1rem))] sm:rounded-2xl sm:border sm:border-gray-200 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Aprovação da Folha de Pagamento"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <FiShield className="text-abz-blue" />
              Aprovação da Folha
            </h2>
            <p className="truncate text-xs text-gray-500">
              {sheetLabel || sheetId}
              {estado && (
                <> · {String(estado.sheet.reference_month).padStart(2, '0')}/{estado.sheet.reference_year}</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
            aria-label="Fechar"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4">
          {loading && (
            <p className="flex items-center gap-2 py-8 text-sm text-gray-500">
              <FiRefreshCw className="animate-spin" /> Carregando aprovação…
            </p>
          )}

          {!loading && erro && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
              <button type="button" onClick={load} className="ml-2 font-bold underline">
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !erro && estado && !aprovacao && !estado.aprovado && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
              Aprovação ainda não iniciada para esta folha. Clique em{' '}
              <strong>&quot;Iniciar aprovação&quot;</strong> para montar a lista de aprovadores
              (config do módulo Folha; sem config, ADMIN + setor DP) e começar a coletar assinaturas.
            </div>
          )}

          {!loading && !erro && estado && estado.aprovado && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <p className="flex items-center gap-2 font-bold">
                <FiCheckCircle /> Folha aprovada
              </p>
              {estado.sheet.approved_at && (
                <p className="mt-1 text-xs">Aprovada em {formatarDataBR(estado.sheet.approved_at)}</p>
              )}
              {estado.hash && (
                <p className="mt-1 break-all font-mono text-[10px]">Hash: {estado.hash}</p>
              )}
            </div>
          )}

          {!loading && !erro && rejeitada && aprovacao?.rejeicao && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-bold">
                <FiXCircle /> Aprovação rejeitada
              </p>
              <p className="mt-1 text-xs">
                Por {aprovacao.rejeicao.por} em {formatarDataBR(aprovacao.rejeicao.em)}: {aprovacao.rejeicao.motivo}
              </p>
              <p className="mt-1 text-xs">
                Reinicie a aprovação (botão abaixo) para limpar a rejeição e zerar as assinaturas.
              </p>
            </div>
          )}

          {!loading && !erro && aprovacao && !rejeitada && (
            <>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs">
                <span className="font-bold text-gray-700">
                  Progresso de assinaturas {estado?.todosAssinaram ? '— completa' : ''}
                </span>
                <span className="inline-flex items-center gap-1 font-mono font-bold text-abz-blue">
                  <FiClock /> {progresso}
                </span>
              </div>

              <ul className="divide-y rounded-lg border border-gray-200">
                {aprovacao.aprovadores.map((aprovador) => {
                  const assinatura = aprovacao.assinaturas.find(
                    (s) =>
                      (aprovador.id && s.userId === aprovador.id) ||
                      (aprovador.email && s.email?.toLowerCase() === aprovador.email.toLowerCase()),
                  );
                  return (
                    <li key={aprovador.id || aprovador.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{aprovador.nome}</p>
                        <p className="truncate text-xs text-gray-500">{aprovador.email || 'sem e-mail'}</p>
                        {assinatura?.assinaturaHash && (
                          <p className="break-all font-mono text-[10px] text-emerald-800">
                            {assinatura.assinaturaHash}
                          </p>
                        )}
                      </div>
                      {assinatura ? (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">
                          <FiCheckCircle /> Assinado
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">
                          Pendente
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {!estado?.todosAssinaram && (
                <div>
                  <label htmlFor="motivo-rejeicao" className="text-xs font-bold text-gray-600">
                    Rejeitar aprovação (motivo obrigatório)
                  </label>
                  <textarea
                    id="motivo-rejeicao"
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: divergência nas rubricas de hora extra"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={fechar}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
          >
            Fechar
          </button>
          {!estado?.aprovado && (
            <button
              type="button"
              onClick={assinar}
              disabled={busy || loading || Boolean(erro)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-abz-blue px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiSend />}
              {aprovacao ? 'Assinar folha' : 'Iniciar aprovação'}
            </button>
          )}
          {!estado?.aprovado && aprovacao && !rejeitada && (
            <button
              type="button"
              onClick={rejeitar}
              disabled={busy || !motivo.trim()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <FiXCircle /> Rejeitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
