'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type UnifiedUser = {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  active?: boolean | null;
  authorizationStatus?: string | null;
  isAuthorized?: boolean | null;
};

type Shortcut = {
  title: string;
  description: string;
  href: string;
  internal?: boolean;
};

type ShortcutGroup = {
  label: string;
  items: Shortcut[];
};

// Sub-seções sem front mobile próprio caem no desktop via link normal
// (o catch-all /m/[...slug] redireciona de volta se um dia virarem /m/...).
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Usuários e permissões',
    items: [
      { title: 'Gestão de usuários', description: 'Cadastro, edição e aprovação de usuários', href: '/admin/user-management' },
      { title: 'Permissões de função', description: 'Papéis e permissões de acesso', href: '/admin/role-permissions' },
      { title: 'Aprovação de usuários', description: 'Configurar fluxo de aprovação', href: '/admin/user-approval-settings' },
      { title: 'Usuários banidos', description: 'Gerenciar banimentos', href: '/admin/banned-users' },
    ],
  },
  {
    label: 'Conteúdo e comunicação',
    items: [
      { title: 'Cards', description: 'Cards da página inicial', href: '/admin/cards' },
      { title: 'Menu', description: 'Itens de navegação do painel', href: '/admin/menu' },
      { title: 'Documentos', description: 'Documentos e políticas', href: '/admin/documents' },
      { title: 'Notícias', description: 'Publicações do mural', href: '/admin/noticias' },
      { title: 'Editores', description: 'Editores do Academy e Social', href: '/admin/editors' },
    ],
  },
  {
    label: 'Operacional',
    items: [
      { title: 'Gestão de EPIs', description: 'Solicitações, tipos e validade', href: '/admin/epi' },
      { title: 'Configurações de reembolso', description: 'Regras do módulo de reembolso', href: '/admin/reimbursement-settings' },
    ],
  },
  {
    label: 'Desempenho e integrações',
    items: [
      { title: 'Avaliação de desempenho', description: 'Períodos e avaliações', href: '/admin/avaliacao' },
      { title: 'Integração ERP', description: 'Status das conexões e sincronizações', href: '/m/admin/integracao-erp', internal: true },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { title: 'Configurações', description: 'Configurações gerais do painel', href: '/admin/settings' },
      { title: 'Setup do sistema', description: 'Configuração inicial e módulos', href: '/admin/setup' },
    ],
  },
];

export default function MobileAdmin() {
  const router = useRouter();
  const { profile, isAuthenticated, isAdmin, isLoading: authLoading } = useSupabaseAuth();
  const [users, setUsers] = useState<UnifiedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch('/api/users-unified', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.users || data.data || []);
    } catch {
      setError('Não foi possível carregar o resumo de usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, isAdmin, authLoading, load]);

  const openShortcut = (item: Shortcut) => {
    if (item.internal) router.push(item.href);
    else window.location.assign(item.href);
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.active).length;
  const pendingUsers = users.filter((u) => u.authorizationStatus === 'pending').length;

  return (
    <MobileShell title="Administração">
      <div className="flex flex-col gap-4" data-abz-mobile-admin="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para acessar a administração.
          </p>
        ) : !isAdmin && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Acesso restrito a administradores.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Bem-vindo, {profile?.first_name || 'Admin'}.
            </p>

            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={load}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2">
              <DataCard title={loading ? '…' : String(activeUsers)} subtitle="Usuários ativos" />
              <DataCard title={loading ? '…' : String(pendingUsers)} subtitle="Pendentes" />
              <DataCard title={loading ? '…' : String(totalUsers)} subtitle="Total" />
            </div>

            {/* Atalhos para as sub-seções */}
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.label} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-gray-700">{group.label}</h2>
                {group.items.map((item) => (
                  <DataCard
                    key={item.href}
                    title={item.title}
                    subtitle={item.description}
                    meta={item.internal ? 'Mobile' : 'Desktop'}
                    onClick={() => openShortcut(item)}
                  />
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </MobileShell>
  );
}
