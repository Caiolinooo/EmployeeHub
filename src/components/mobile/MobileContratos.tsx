'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import { hasFeaturePermission, type AppUserLike } from '@/lib/permissions';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type FilterStatus = 'ALL' | 'PENDING' | 'SIGNED';

type ContractDocument = {
  id: string;
  titulo?: string | null;
  descricao?: string | null;
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  data_criacao?: string | null;
};

type ContractItem = {
  id: string;
  // visão colaborador (solicitacoes_assinatura)
  status?: string | null;
  created_at?: string | null;
  documento?: ContractDocument | null;
  // visão gestor (vw_envelopes_completo)
  descricao?: string | null;
  titulo?: string | null;
  data_criacao?: string | null;
  total_documentos?: number | null;
  total_pendentes?: number | null;
  total_assinados?: number | null;
  total_solicitacoes?: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  SIGNED: 'Assinado',
  ACTIVE: 'Ativo',
  REJECTED: 'Rejeitado',
  SENT: 'Enviado',
  COMPLETED: 'Concluído',
};

function statusLabel(status?: string | null): string {
  if (!status) return 'Pendente';
  return STATUS_LABEL[status] || status;
}

function statusTone(status?: string | null): string {
  if (status === 'SIGNED' || status === 'COMPLETED') return 'text-emerald-700';
  if (status === 'REJECTED') return 'text-red-700';
  if (status === 'ACTIVE' || status === 'SENT') return 'text-blue-700';
  return 'text-amber-700';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export default function MobileContratos() {
  const router = useRouter();
  const { user, profile, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const appUser: AppUserLike | null = profile
    ? {
        role: profile.role ?? undefined,
        access_permissions: profile.access_permissions,
        accessPermissions: profile.accessPermissions,
      }
    : null;
  const isManager =
    hasFeaturePermission(appUser, 'contracts.manage') ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER';

  const [documentos, setDocumentos] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const token = getToken();
      const res = await fetch(`/api/contracts?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setDocumentos(Array.isArray(data.documentos) ? data.documentos : []);
      } else {
        throw new Error(data.error || 'Erro ao carregar documentos');
      }
    } catch {
      setError('Não foi possível carregar seus documentos.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, searchTerm]);

  useEffect(() => {
    if (isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  return (
    <MobileShell title="Contratos">
      <div className="flex flex-col gap-3" data-abz-mobile-contratos="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver seus documentos.
          </p>
        ) : (
          <>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
            />

            <div className="flex gap-2" role="group" aria-label="Filtrar por status">
              {(['ALL', 'PENDING', 'SIGNED'] as FilterStatus[]).map((s) => (
                <TouchButton
                  key={s}
                  variant={statusFilter === s ? 'primary' : 'ghost'}
                  className="flex-1 justify-center px-2 text-sm"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Pendentes' : 'Assinados'}
                </TouchButton>
              ))}
            </div>

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {documentos.map((doc) => {
              const docData = isManager ? doc : doc.documento;
              const docId = isManager ? doc.id : docData?.id;
              const titulo = isManager ? doc.titulo : docData?.titulo;
              const dataCriacao = isManager ? doc.data_criacao : docData?.data_criacao;
              const docStatus = isManager
                ? (doc.total_pendentes ?? 0) > 0
                  ? 'PENDING'
                  : (doc.total_assinados ?? 0) > 0
                    ? 'SIGNED'
                    : 'ACTIVE'
                : doc.status;
              const subtitle = isManager
                ? `${doc.total_documentos ?? 0} docs · ${doc.total_assinados ?? 0}/${doc.total_solicitacoes ?? 0} assinados`
                : docData?.descricao || undefined;

              return (
                <DataCard
                  key={doc.id}
                  title={titulo || 'Documento'}
                  subtitle={subtitle}
                  meta={formatDate(dataCriacao) || undefined}
                  onClick={docId ? () => router.push(`/contratos/${docId}`) : undefined}
                >
                  <span className={`mt-2 block text-xs font-semibold ${statusTone(docStatus)}`}>
                    {statusLabel(docStatus)}
                  </span>
                </DataCard>
              );
            })}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && documentos.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                {isManager ? 'Nenhum envelope encontrado.' : 'Nenhum documento encontrado.'}
              </p>
            ) : null}
          </>
        )}
      </div>
    </MobileShell>
  );
}
