'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSignature } from '@/contexts/SignatureContext';
import { getToken } from '@/lib/tokenStorage';
import BottomSheet from './BottomSheet';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type EpiRegistration = {
  id: string;
  equipment_type: string;
  quantity: number;
  reason?: string | null;
  status?: 'pending' | 'approved' | 'rejected' | 'delivered' | 'returned' | null;
  observation?: string | null;
  equipment_ca?: string | null;
  validity_date?: string | null;
  delivered_at?: string | null;
  created_at?: string | null;
};

type EpiType = {
  id: string;
  name: string;
  category?: string | null;
  size?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Reprovado',
  delivered: 'Entregue',
  returned: 'Devolvido',
};

function statusLabel(status?: string | null): string {
  if (!status) return 'Pendente';
  return STATUS_LABEL[status] || status;
}

function statusTone(status?: string | null): string {
  if (status === 'approved' || status === 'delivered') return 'text-green-700';
  if (status === 'rejected') return 'text-red-700';
  if (status === 'returned') return 'text-gray-600';
  return 'text-amber-700';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MobileEpi() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const { requestSignature } = useSignature();
  const [registrations, setRegistrations] = useState<EpiRegistration[]>([]);
  const [epiTypes, setEpiTypes] = useState<EpiType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [equipmentType, setEquipmentType] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/epi', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRegistrations(Array.isArray(data.data) ? data.data : []);
    } catch {
      setError('Não foi possível carregar seus EPIs.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/epi/types', { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setEpiTypes(Array.isArray(data.data) ? data.data : []);
    } catch {
      // Tipos são auxiliares do formulário; falha não bloqueia a lista.
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      load();
      loadTypes();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, load, loadTypes]);

  const approvedIds = registrations.filter((r) => r.status === 'approved').map((r) => r.id);

  const submit = async () => {
    setFormError(null);
    const qty = parseInt(quantity, 10);
    if (!equipmentType) {
      setFormError('Selecione o tipo de EPI.');
      return;
    }
    if (!qty || qty < 1) {
      setFormError('Informe uma quantidade válida.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Informe o motivo da solicitação.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/epi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          equipment_type: equipmentType,
          quantity: qty,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setFormOpen(false);
      setEquipmentType('');
      setQuantity('1');
      setReason('');
      setSuccessMsg('Solicitação de EPI criada com sucesso.');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao enviar solicitação.');
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (id: string) => {
    setCancellingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/epi?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao cancelar solicitação.');
    } finally {
      setCancellingId(null);
    }
  };

  const confirmDelivery = async () => {
    if (!user?.id || approvedIds.length === 0) return;
    const result = await requestSignature({
      title: 'Assinar Recebimento de EPI',
      description: 'Confirme sua identidade para registrar o recebimento dos EPIs aprovados.',
    });
    if (!result) return;
    setSigning(true);
    setError(null);
    try {
      const res = await fetch('/api/epi/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId: user.id,
          registrationIds: approvedIds,
          signatureUrl: result.signatureUrl,
          authMethod: result.authMethod,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSuccessMsg('Recebimento confirmado com sucesso.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao confirmar entrega.');
    } finally {
      setSigning(false);
    }
  };

  return (
    <MobileShell title="EPI">
      <div className="flex flex-col gap-3" data-abz-mobile-epi="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver seus EPIs.
          </p>
        ) : (
          <>
            {successMsg ? (
              <div className="abz-m-alert-ok rounded-xl p-3 text-sm" role="status">
                {successMsg}
              </div>
            ) : null}
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            <TouchButton
              className="w-full justify-center"
              onClick={() => setFormOpen(true)}
              data-abz-mobile-epi-new=""
            >
              Solicitar EPI
            </TouchButton>

            {approvedIds.length > 0 ? (
              <TouchButton
                variant="ghost"
                className="w-full justify-center"
                onClick={confirmDelivery}
                disabled={signing}
                data-abz-mobile-epi-sign=""
              >
                {signing
                  ? 'Confirmando…'
                  : `Assinar recebimento (${approvedIds.length} aprovado${approvedIds.length > 1 ? 's' : ''})`}
              </TouchButton>
            ) : null}

            {registrations.map((reg) => (
              <DataCard
                key={reg.id}
                title={reg.equipment_type}
                subtitle={reg.reason || undefined}
                meta={`${reg.quantity}x`}
              >
                <span className={`mt-2 block text-xs font-semibold ${statusTone(reg.status)}`}>
                  {statusLabel(reg.status)}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {reg.equipment_ca ? `CA ${reg.equipment_ca} · ` : ''}
                  Solicitado em {formatDate(reg.created_at)}
                  {reg.delivered_at ? ` · Entregue em ${formatDate(reg.delivered_at)}` : ''}
                  {reg.validity_date ? ` · Validade ${formatDate(reg.validity_date)}` : ''}
                </span>
                {reg.observation ? (
                  <span className="mt-1 block text-xs text-gray-500">{reg.observation}</span>
                ) : null}
                {reg.status === 'pending' ? (
                  <TouchButton
                    variant="link"
                    className="mt-1 px-0 text-red-700"
                    onClick={() => cancelRequest(reg.id)}
                    disabled={cancellingId === reg.id}
                  >
                    {cancellingId === reg.id ? 'Cancelando…' : 'Cancelar solicitação'}
                  </TouchButton>
                ) : null}
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && registrations.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhum EPI registrado.
              </p>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title="Solicitar EPI">
        <div className="flex flex-col gap-3" data-abz-mobile-epi-form="">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Tipo de EPI
            <select
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
              className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
            >
              <option value="">Selecione…</option>
              {epiTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                  {t.size ? ` (${t.size})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Quantidade
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Motivo
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
          </label>
          {formError ? (
            <p className="abz-m-alert-error rounded-xl p-2 text-sm" role="alert">
              {formError}
            </p>
          ) : null}
          <TouchButton className="w-full justify-center" onClick={submit} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar solicitação'}
          </TouchButton>
        </div>
      </BottomSheet>
    </MobileShell>
  );
}
