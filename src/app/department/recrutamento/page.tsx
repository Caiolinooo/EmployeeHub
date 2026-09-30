'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiPlus, FiRefreshCw, FiUserCheck } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

interface Vaga {
  id: string;
  titulo: string;
  empresa?: string | null;
  centro_custo?: string | null;
  status: string;
}

interface Prospecto {
  id: string;
  nome_completo: string;
  cpf?: string | null;
  email?: string | null;
  status: string;
  colaborador_id?: string | null;
  vaga?: { titulo?: string | null } | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  prospecto: 'Prospecto',
  pre_cadastro: 'Pré-cadastro',
  aprovado: 'Aprovado',
  contratado: 'Contratado',
  rejeitado: 'Rejeitado',
  convertido: 'Convertido',
};

export default function RecrutamentoPage() {
  const { hasFeature } = useSupabaseAuth();
  const podeGerenciar = hasFeature('recrutamento.manage') || hasFeature('recrutamento.admin');

  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [convertendoId, setConvertendoId] = useState<string | null>(null);

  const [novaVaga, setNovaVaga] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoCpf, setNovoCpf] = useState('');
  const [novaVagaId, setNovaVagaId] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [v, p] = await Promise.all([
        fetchWithToken('/api/recrutamento/vagas').then(r => r.ok ? r.json() : { data: [] }),
        fetchWithToken('/api/recrutamento/prospectos').then(r => r.ok ? r.json() : { data: [] }),
      ]);
      setVagas(v.data || []);
      setProspectos(p.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criarVaga = async () => {
    const titulo = novaVaga.trim();
    if (!titulo) {
      toast.error('Informe o título da vaga');
      return;
    }
    const res = await fetchWithToken('/api/recrutamento/vagas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Erro ao cadastrar vaga');
      return;
    }
    setNovaVaga('');
    toast.success('Vaga cadastrada');
    carregar();
  };

  const criarProspecto = async () => {
    const nome = novoNome.trim();
    if (!nome) {
      toast.error('Informe o nome do prospecto');
      return;
    }
    const res = await fetchWithToken('/api/recrutamento/prospectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome_completo: nome,
        cpf: novoCpf.trim() || null,
        vaga_id: novaVagaId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Erro ao cadastrar prospecto');
      return;
    }
    setNovoNome('');
    setNovoCpf('');
    toast.success('Prospecto cadastrado');
    carregar();
  };

  const sincronizarInhire = async () => {
    setSyncing(true);
    try {
      const res = await fetchWithToken('/api/recrutamento/inhire/sync', { method: 'POST' });
      const json = await res.json();
      if (json.warning) {
        toast.error(json.warning);
      } else if (json.success) {
        toast.success(`Sincronizado: ${json.data.vagas} vagas, ${json.data.prospectos} prospectos`);
      } else {
        toast.error(json.error || 'Falha no sync Inhire');
      }
      carregar();
    } finally {
      setSyncing(false);
    }
  };

  const converter = async (prospecto: Prospecto) => {
    setConvertendoId(prospecto.id);
    try {
      const res = await fetchWithToken(`/api/recrutamento/prospectos/${prospecto.id}/converter`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Falha ao converter');
        return;
      }
      toast.success(json.message || 'Prospecto convertido');
      carregar();
    } finally {
      setConvertendoId(null);
    }
  };

  return (
    <GtPageShell>
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-black text-gray-900">Recrutamento</h1>
          <p className="text-sm text-gray-500">
            Vagas do Inhire e prospectos em pré-cadastro. O DP converte o contratado em colaborador.
          </p>
        </div>
        <button
          onClick={sincronizarInhire}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
        >
          <FiRefreshCw className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Inhire'}
        </button>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${GT_PAGE_SCROLLPORT_CLASS}`}>
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Vagas ({vagas.length})</h2>
            {podeGerenciar && (
              <div className="flex gap-2">
                <input
                  value={novaVaga}
                  onChange={e => setNovaVaga(e.target.value)}
                  placeholder="Nova vaga..."
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
                />
                <button
                  onClick={criarVaga}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-abz-blue rounded-lg"
                >
                  <FiPlus /> Criar
                </button>
              </div>
            )}
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Título</th>
                  <th className="px-3 py-2 text-left">Empresa</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">Carregando...</td></tr>
                ) : vagas.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">Nenhuma vaga. Sincronize o Inhire ou crie manualmente.</td></tr>
                ) : vagas.map(v => (
                  <tr key={v.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">{v.titulo}</td>
                    <td className="px-3 py-2 text-gray-600">{v.empresa || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Prospectos ({prospectos.length})</h2>
            {podeGerenciar && (
              <div className="flex flex-wrap gap-2">
                <input
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome do prospecto..."
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
                />
                <input
                  value={novoCpf}
                  onChange={e => setNovoCpf(e.target.value)}
                  placeholder="CPF (opcional)"
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg w-32"
                />
                <select
                  value={novaVagaId}
                  onChange={e => setNovaVagaId(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
                >
                  <option value="">Sem vaga</option>
                  {vagas.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}
                </select>
                <button
                  onClick={criarProspecto}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-abz-blue rounded-lg"
                >
                  <FiPlus /> Adicionar
                </button>
              </div>
            )}
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Vaga</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Carregando...</td></tr>
                ) : prospectos.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Nenhum prospecto.</td></tr>
                ) : prospectos.map(p => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{p.nome_completo}</div>
                      <div className="text-[11px] text-gray-400">{p.cpf || 'sem CPF'}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.vaga?.titulo || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        p.status === 'convertido' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status !== 'convertido' && (
                        <button
                          onClick={() => converter(p)}
                          disabled={convertendoId === p.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-50"
                          title="Converter em colaborador (DP)"
                        >
                          <FiUserCheck />
                          {convertendoId === p.id ? 'Convertendo...' : 'Converter DP'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </GtPageShell>
  );
}
