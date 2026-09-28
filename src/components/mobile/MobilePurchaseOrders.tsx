'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type PurchaseOrder = {
  id: string;
  po_number?: string | null;
  provider_name?: string | null;
  provider_trade_name?: string | null;
  total_value?: number | null;
  status?: string | null;
  created_at?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  submitted: 'Aguardando',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'submitted', label: 'Aguardando' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
  { value: 'draft', label: 'Rascunho' },
];

function statusLabel(status?: string | null): string {
  if (!status) return 'Pendente';
  return STATUS_LABEL[status] || status;
}

function statusTone(status?: string | null): string {
  if (status === 'approved') return 'text-green-700';
  if (status === 'rejected') return 'text-red-700';
  if (status === 'submitted') return 'text-blue-700';
  if (status === 'draft') return 'text-gray-600';
  return 'text-amber-700';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function formatValue(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

export default function MobilePurchaseOrders() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch('/api/purchase-orders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.data || []);
    } catch {
      setError('Não foi possível carregar suas ordens de compra.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((po) => {
      const matchesSearch =
        !term ||
        (po.po_number?.toLowerCase() || '').includes(term) ||
        (po.provider_name?.toLowerCase() || '').includes(term) ||
        (po.provider_trade_name?.toLowerCase() || '').includes(term);
      const matchesStatus = statusFilter ? po.status === statusFilter : true;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  return (
    <MobileShell title="Ordens de Compra">
      <div className="flex flex-col gap-3" data-abz-mobile-purchase-orders="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver suas ordens de compra.
          </p>
        ) : (
          <>
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número ou fornecedor"
              className="touch-target w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
              data-abz-mobile-purchase-orders-search=""
            />

            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((f) => (
                <TouchButton
                  key={f.value}
                  variant={statusFilter === f.value ? 'primary' : 'ghost'}
                  className="shrink-0"
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </TouchButton>
              ))}
            </div>

            {filtered.map((po) => (
              <DataCard
                key={po.id}
                title={po.po_number || '#-'}
                subtitle={po.provider_trade_name || po.provider_name || undefined}
                meta={formatValue(po.total_value)}
              >
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{formatDate(po.created_at)}</span>
                  <span className={`text-xs font-semibold ${statusTone(po.status)}`}>
                    {statusLabel(po.status)}
                  </span>
                </div>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && filtered.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhuma ordem de compra encontrada.
              </p>
            ) : null}

            <p className="py-2 text-center text-xs text-gray-400">
              Para criar ou aprovar ordens, acesse a versão desktop.
            </p>
          </>
        )}
      </div>
    </MobileShell>
  );
}
