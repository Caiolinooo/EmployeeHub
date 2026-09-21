'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiClock, FiRefreshCw, FiShield, FiXCircle } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import type { AprovadorObrigatorio, AssinaturaFechamento } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import { isFechamentoRole } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import AprovacaoFolhaModal from '@/components/payroll/AprovacaoFolhaModal';

export interface FolhaInboxAprovadorProps {
  className?: string;
}

interface AprovacaoSheet {
  aprovadores: AprovadorObrigatorio[];
  assinaturas: AssinaturaFechamento[];
  rejeicao?: { por: string; motivo: string; em: string };
  hash?: string;
}

interface InboxRow {
  id: string;
  label: string;
  status: string;
  aprovacao: AprovacaoSheet | null;
  pendentes: AprovadorObrigatorio[];
  assinados: number;
  obrigatorios: number;
  rejeitada: boolean;
  /** O usuário logado está entre os aprovadores pendentes (ou fallback gestor). */
  aguardandoVoce: boolean;
}

type FiltroInbox = 'voce' | 'em_aprovacao' | 'rejeitadas';

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

/** "Empresa · Departamento — MM/AAAA" a partir da linha enriquecida do GET sheets. */
function montarLabel(sheet: Record<string, unknown>): string {
  const mes = String(sheet.reference_month ?? '').padStart(2, '0');
  const ano = String(sheet.reference_year ?? '');
  const nomeEmpresa = ehRegistro(sheet.company) ? String(sheet.company.name || '') : '';
  const nomeDepto = ehRegistro(sheet.department) ? String(sheet.department.name || '') : '';
  const quem = [nomeEmpresa, nomeDepto].filter(Boolean).join(' · ');
  return quem ? `${quem} — ${mes}/${ano}` : `${mes}/${ano}`;
}

export default function FolhaInboxAprovador({ className = '' }: FolhaInboxAprovadorProps) {
  const { profile } = useSupabaseAuth();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroInbox>('voce');
  const [sheetAberta, setSheetAberta] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithToken('/api/payroll/sheets?status=calculated&limit=100');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erro ao carregar folhas');
      const sheets = (json.data || []) as Array<Record<string, unknown>>;

      // Estado de aprovação por sheet (poucas folhas calculadas por vez; blocos de 6).
      const linhas: InboxRow[] = [];
      for (let i = 0; i < sheets.length; i += 6) {
        const bloco = sheets.slice(i, i + 6);
        const estados = await Promise.all(
          bloco.map(async (sheet) => {
            const id = String(sheet.id || '');
            try {
              const r = await fetchWithToken(`/api/payroll/sheets/${id}/aprovacao`);
              const j = await r.json();
              if (!r.ok || !j.success) return null;
              const d = j.data as {
                aprovacao: AprovacaoSheet | null;
                pendentes: AprovadorObrigatorio[];
                assinados: number;
                obrigatorios: number;
              };
              const aprovacao = d.aprovacao;
              const jaAssinei = Boolean(
                aprovacao &&
                  aprovacao.assinaturas.some(
                    (s) =>
                      (profile?.id && s.userId === profile.id) ||
                      (profile?.email && s.email?.toLowerCase() === profile.email.toLowerCase()),
                  ),
              );
              const fallbackGestor =
                Boolean(aprovacao) &&
                (aprovacao?.aprovadores.length || 0) === 0 &&
                !jaAssinei &&
                isFechamentoRole(profile?.role);
              const aguardandoVoce =
                Boolean(
                  d.pendentes.some(
                    (p) =>
                      (profile?.id && p.id === profile.id) ||
                      (profile?.email && p.email.toLowerCase() === profile.email.toLowerCase()),
                  ),
                ) || fallbackGestor;
              const linha: InboxRow = {
                id,
                label: montarLabel(sheet),
                status: String(sheet.status || ''),
                aprovacao,
                pendentes: d.pendentes,
                assinados: d.assinados,
                obrigatorios: d.obrigatorios,
                rejeitada: Boolean(aprovacao?.rejeicao),
                aguardandoVoce,
              };
              return linha;
            } catch {
              return null;
            }
          }),
        );
        for (const e of estados) {
          if (e) linhas.push(e);
        }
      }
      setRows(linhas);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar fila de aprovação');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.email, profile?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const visiveis = useMemo(() => {
    if (filtro === 'voce') return rows.filter((r) => r.aguardandoVoce && !r.rejeitada);
    if (filtro === 'rejeitadas') return rows.filter((r) => r.rejeitada);
    return rows.filter((r) => r.aprovacao && !r.rejeitada);
  }, [rows, filtro]);

  const pendentesVoce = useMemo(
    () => rows.filter((r) => r.aguardandoVoce && !r.rejeitada).length,
    [rows],
  );

  const aberta = rows.find((r) => r.id === sheetAberta);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FiShield className="text-abz-blue" />
            Folha — fila de aprovação
          </h2>
          <p className="text-xs text-gray-500">
            Folhas calculadas aguardando suas assinaturas. 100% dos aprovadores assina → folha aprovada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroInbox)}
            className="rounded-lg border px-2 py-1.5 text-xs"
            aria-label="Filtrar folhas"
          >
            <option value="voce">Aguardando você ({pendentesVoce})</option>
            <option value="em_aprovacao">Todas em aprovação</option>
            <option value="rejeitadas">Rejeitadas</option>
          </select>
          <button type="button" onClick={load} className="rounded-lg border p-2" aria-label="Recarregar">
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-gray-50 font-bold uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Folha</th>
              <th className="px-3 py-2">Assinaturas</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  <FiRefreshCw className="mr-2 inline animate-spin" /> Carregando…
                </td>
              </tr>
            ) : visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma folha neste filtro.
                </td>
              </tr>
            ) : (
              visiveis.map((row) => (
                <tr key={row.id} className="align-middle">
                  <td className="px-3 py-3">
                    <div className="font-bold text-gray-900">{row.label}</div>
                    <div className="font-mono text-[10px] text-gray-400">{row.id}</div>
                  </td>
                  <td className="px-3 py-3 font-mono font-semibold text-gray-700">
                    {row.obrigatorios > 0 ? `${row.assinados}/${row.obrigatorios}` : `${row.assinados}`}
                  </td>
                  <td className="px-3 py-3">
                    {row.rejeitada && row.aprovacao?.rejeicao ? (
                      <span className="inline-flex items-center gap-1 font-bold text-red-700">
                        <FiXCircle /> Rejeitada
                        <span className="font-normal text-gray-500">
                          — {row.aprovacao.rejeicao.por}: {row.aprovacao.rejeicao.motivo}
                        </span>
                      </span>
                    ) : row.aguardandoVoce ? (
                      <span className="inline-flex items-center gap-1 font-bold text-abz-blue">
                        <FiShield /> Aguardando sua assinatura
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <FiClock /> Em aprovação
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSheetAberta(row.id)}
                      className="rounded-lg bg-abz-blue px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-800"
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {aberta && (
        <AprovacaoFolhaModal
          open
          sheetId={aberta.id}
          sheetLabel={aberta.label}
          onClose={() => setSheetAberta(null)}
          onResultado={() => {
            load();
          }}
        />
      )}
    </div>
  );
}
