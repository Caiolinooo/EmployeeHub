'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiMail,
  FiCalendar,
  FiDollarSign,
  FiClipboard,
  FiShield,
  FiClock,
  FiLoader,
} from 'react-icons/fi';

interface PendencyCounts {
  emails_nao_lidos: number;
  ferias_pendentes: number;
  reembolsos_pendentes: number;
  avaliacoes_pendentes: number;
  epis_vencidos: number;
  eventos_hoje_amanha: number;
  total: number;
}

interface PendencyItem {
  label: string;
  count: number;
  href: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function PendencyBadge({ item }: { item: PendencyItem }) {
  if (item.count === 0) return null;

  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bgColor}`}>
          <item.icon className={`w-5 h-5 ${item.color}`} />
        </div>
        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{item.label}</span>
      </div>
      <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${item.bgColor} ${item.color}`}>
        {item.count}
      </span>
    </Link>
  );
}

export default function PendenciesWidget() {
  const [counts, setCounts] = useState<PendencyCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token =
      typeof document !== 'undefined'
        ? document.cookie
            .split(';')
            .map((c) => c.trim())
            .find((c) => c.startsWith('abzToken=') || c.startsWith('token='))
            ?.split('=')[1]
        : null;

    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/dashboard/pendencies', {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setCounts(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items: PendencyItem[] = [
    {
      label: 'E-mails não lidos',
      count: counts?.emails_nao_lidos || 0,
      href: '/ia',
      icon: FiMail,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Férias pendentes',
      count: counts?.ferias_pendentes || 0,
      href: '/ferias',
      icon: FiCalendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Reembolsos pendentes',
      count: counts?.reembolsos_pendentes || 0,
      href: '/reembolso',
      icon: FiDollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Avaliações pendentes',
      count: counts?.avaliacoes_pendentes || 0,
      href: '/avaliacao',
      icon: FiClipboard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'EPIs vencidos',
      count: counts?.epis_vencidos || 0,
      href: '/epi',
      icon: FiShield,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Eventos hoje/amanhã',
      count: counts?.eventos_hoje_amanha || 0,
      href: '/calendario',
      icon: FiClock,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
  ];

  const total = counts?.total || 0;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 text-lg">Minhas Pendências</h3>
        {!loading && total > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
            {total}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <FiLoader className="animate-spin w-5 h-5 text-gray-400" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
            <FiClipboard className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-sm text-gray-500">Sem pendências no momento</p>
          <p className="text-xs text-gray-500 mt-1">Tudo em dia!</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item) => (
            <PendencyBadge key={item.label} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}