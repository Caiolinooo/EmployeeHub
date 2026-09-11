'use client';

import React, { useEffect, useState } from 'react';
import { fetchWithToken } from '@/lib/tokenStorage';
import { classificarValidadeCivil } from '@/lib/gestao-tripulantes/validade-civil';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';

interface Props {
  colaboradorId: string;
  onOpenTab?: (tab: string, documentoId?: string) => void;
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function FichaUnificadaTab({ colaboradorId, onOpenTab }: Props) {
  const [record, setRecord] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithToken(`/api/employee-hub/${colaboradorId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Não foi possível carregar a ficha unificada');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setRecord(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [colaboradorId]);

  if (loading) return <p className="p-6 text-sm text-gray-400">Carregando ficha unificada…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!record) return null;

  const colab = record.colaborador || {};
  const summary = record.documentsSummary || {};
  const alertas = record.documentosAlertas || [];
  const docs = record.documentos || [];

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} gap-6 p-6`}>
      <section className="shrink-0">
        <h3 className="text-sm font-bold text-gray-800">Identidade central</h3>
        <p className="text-xs text-gray-500 mt-1">
          Fonte canônica `gt_*` via Employee Hub — documentos, escala, e-Social, afastamentos e treinamentos no mesmo registro.
        </p>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><dt className="text-gray-400 text-xs">Nome</dt><dd className="font-medium">{colab.nome_completo || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs">CPF</dt><dd className="font-mono">{colab.cpf || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs">Matrícula</dt><dd>{colab.matricula || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs">Status</dt><dd>{colab.status_embarque || '—'}{colab.escala_codigo_hoje ? ` (${colab.escala_codigo_hoje})` : ''}</dd></div>
        </dl>
      </section>

      <section className="shrink-0">
        <h3 className="text-sm font-bold text-gray-800">Documentos vigentes</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 font-semibold">{summary.vencidos ?? 0} vencidos</span>
          <span className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 font-semibold">{summary.vencendo ?? 0} vencendo</span>
          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{summary.validos ?? 0} válidos</span>
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">{summary.total ?? docs.length} no dossiê</span>
        </div>
      </section>

      {alertas.length > 0 && (
        <section className="shrink-0">
          <h3 className="text-sm font-bold text-gray-800">Onde está o documento com alerta</h3>
          <ul className="mt-2 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {alertas.map((a: any) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onOpenTab?.(a.aba, a.id)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-gray-900">{a.titulo}</p>
                  <p className="text-xs text-gray-500">
                    {a.tipo_documento} · validade {formatDate(a.data_validade)} · {a.papel} · abrir aba {a.aba}
                    {a.status_stale ? ' · status no banco desatualizado' : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex min-h-0 flex-1 flex-col">
        <h3 className="shrink-0 text-sm font-bold text-gray-800">Todos os documentos</h3>
        <div className={`${COLLABORATOR_MODAL_TABLE_SCROLL_CLASS} mt-2`}>
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left text-gray-400">
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Validade</th>
                <th className="py-2 pr-3">Civil</th>
                <th className="py-2">Papel</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d: any) => {
                const alerta = classificarValidadeCivil(d.data_validade);
                return (
                  <tr key={d.id} className="border-t border-gray-50">
                    <td className="py-2 pr-3">{d.tipo_documento}</td>
                    <td className="py-2 pr-3">{d.titulo}</td>
                    <td className="py-2 pr-3 font-mono">{formatDate(d.data_validade)}</td>
                    <td className={`py-2 pr-3 font-semibold ${alerta === 'vencido' ? 'text-red-600' : alerta === 'vencendo' ? 'text-orange-600' : 'text-gray-600'}`}>
                      {alerta}
                    </td>
                    <td className="py-2">{d.papel_conformidade || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid shrink-0 grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-400">Embarques</p>
          <p className="text-lg font-bold">{(record.embarques || []).length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-400">e-Social</p>
          <p className="text-lg font-bold">{record.esocialSummary?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-400">Afastamentos</p>
          <p className="text-lg font-bold">{(record.afastamentos || []).length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-400">Férias (portal)</p>
          <p className="text-lg font-bold">{(record.ferias || []).length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-400">Reembolsos</p>
          <p className="text-lg font-bold">{(record.reembolsos || []).length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-3" data-testid="ficha-portal-user">
          <p className="text-xs text-gray-400">Usuário do portal</p>
          {record.portalUser ? (
            <>
              <p className="text-sm font-semibold truncate">
                {`${record.portalUser.first_name || ''} ${record.portalUser.last_name || ''}`.trim() || record.portalUser.email || '—'}
              </p>
              {record.portalUser.email ? (
                <p className="text-xs text-gray-500 truncate">{record.portalUser.email}</p>
              ) : null}
              {record.portalUser.role ? (
                <p className="text-xs text-gray-400">{record.portalUser.role}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold">sem vínculo</p>
          )}
        </div>
      </section>
    </div>
  );
}
