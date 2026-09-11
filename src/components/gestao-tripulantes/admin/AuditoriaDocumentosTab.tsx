'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiRefreshCw, FiAlertTriangle, FiCheckCircle, FiFileText,
  FiCalendar, FiHash, FiCopy, FiShieldOff, FiClock, FiSearch,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

interface DocRow {
  id: string;
  colaborador_id: string | null;
  tipo_documento: string;
  titulo: string;
  numero_documento?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  numero_rastreio?: string | null;
  identity_match?: string | null;
  status_validacao?: string | null;
  origem?: string;
  gt_colaboradores?: { nome_completo?: string; cpf?: string } | null;
}

interface AuditData {
  resumo: Record<string, number>;
  sem_emissao: DocRow[];
  sem_validade: DocRow[];
  sem_rastreio: DocRow[];
  duplicados: { grupo: DocRow[] }[];
  quarentena: DocRow[];
  vencidos: DocRow[];
  vencendo: DocRow[];
}

type BucketKey = 'sem_emissao' | 'sem_validade' | 'sem_rastreio' | 'duplicados' | 'quarentena' | 'vencidos' | 'vencendo';

const BUCKETS: { key: BucketKey; label: string; icon: React.ReactNode }[] = [
  { key: 'quarentena', label: 'Em Quarentena', icon: <FiShieldOff /> },
  { key: 'sem_emissao', label: 'Sem Emissão', icon: <FiCalendar /> },
  { key: 'sem_validade', label: 'Sem Validade', icon: <FiCalendar /> },
  { key: 'sem_rastreio', label: 'Sem Rastreio', icon: <FiHash /> },
  { key: 'duplicados', label: 'Duplicados', icon: <FiCopy /> },
  { key: 'vencidos', label: 'Vencidos', icon: <FiAlertTriangle /> },
  { key: 'vencendo', label: 'Vencendo (30d)', icon: <FiClock /> },
];

function nomeColab(d: DocRow): string {
  return d.gt_colaboradores?.nome_completo || '(sem colaborador — quarentena)';
}

const isFallbackRastreio = (r?: string | null): boolean => !!r && /^GT-/.test(r);

export default function AuditoriaDocumentosTab() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<BucketKey>('quarentena');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editDatas, setEditDatas] = useState<Record<string, { emissao: string; validade: string }>>({});
  const [editRastreio, setEditRastreio] = useState<Record<string, string>>({});
  const [rastreioAberto, setRastreioAberto] = useState<Record<string, boolean>>({});
  const [colabSearch, setColabSearch] = useState<Record<string, string>>({});
  const [colabOptions, setColabOptions] = useState<{ id: string; nome: string }[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/auditoria');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erro ao carregar auditoria');
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const agir = async (body: Record<string, unknown>, docId: string) => {
    setBusyId(docId);
    setFeedback(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/auditoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setFeedback(
        res.ok && json.success
          ? { ok: true, msg: json.message || 'Corrigido com sucesso' }
          : { ok: false, msg: json.error || `Erro ${res.status}` }
      );
      if (res.ok) await carregar();
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : 'Erro desconhecido' });
    } finally {
      setBusyId(null);
    }
  };

  const buscarColabs = async (docId: string) => {
    const q = colabSearch[docId];
    if (!q || q.length < 3) return;
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/colaboradores?search=${encodeURIComponent(q)}&limit=8`);
      const json = await res.json();
      const items = (json?.data || json?.colaboradores || []) as any[];
      setColabOptions(items.map((c: any) => ({ id: c.id, nome: `${c.nome_completo} (${c.cpf || 'sem CPF'})` })));
    } catch { /* noop */ }
  };

  const listaAtual = (): DocRow[] => {
    if (!data) return [];
    switch (bucket) {
      case 'sem_emissao': return data.sem_emissao || [];
      case 'sem_validade': return data.sem_validade || [];
      case 'sem_rastreio': return data.sem_rastreio || [];
      case 'duplicados': return (data.duplicados || []).flatMap(g => g?.grupo || []);
      case 'quarentena': return data.quarentena || [];
      case 'vencidos': return data.vencidos || [];
      case 'vencendo': return data.vencendo || [];
      default: return [];
    }
  };

  const renderAcoes = (d: DocRow) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {!d.numero_rastreio && (
        <button
          onClick={() => agir({ acao: 'gerar_rastreio', documento_id: d.id }, d.id)}
          disabled={busyId === d.id}
          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
        >
          Gerar rastreio
        </button>
      )}
      <div className="flex flex-wrap items-center gap-1 w-full">
        <button
          onClick={() => setRastreioAberto(p => ({ ...p, [d.id]: !p[d.id] }))}
          className="px-3 py-1 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100"
        >
          {rastreioAberto[d.id] ? 'Fechar' : 'Editar rastreio'}
        </button>
        {rastreioAberto[d.id] && (
          <>
            <input
              placeholder="Número próprio do documento"
              className="text-xs border rounded px-2 py-1 w-56"
              value={editRastreio[d.id] ?? (isFallbackRastreio(d.numero_rastreio) ? '' : d.numero_rastreio || '')}
              onChange={e => setEditRastreio(p => ({ ...p, [d.id]: e.target.value }))}
            />
            <button
              onClick={() =>
                agir(
                  {
                    acao: 'corrigir_rastreio',
                    documento_id: d.id,
                    numero_rastreio: editRastreio[d.id] ?? d.numero_rastreio ?? '',
                  },
                  d.id
                )
              }
              disabled={busyId === d.id || !(editRastreio[d.id] ?? d.numero_rastreio)?.trim()}
              className="px-3 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 disabled:opacity-40"
            >
              Salvar rastreio
            </button>
            {isFallbackRastreio(d.numero_rastreio) && (
              <span className="text-[10px] text-orange-600">
                atual é fallback interno — digite o número impresso no documento
              </span>
            )}
          </>
        )}
      </div>
      {(!d.data_emissao || !d.data_validade) && (
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="date"
            className="text-xs border rounded px-1 py-0.5"
            value={editDatas[d.id]?.emissao ?? d.data_emissao ?? ''}
            onChange={e => setEditDatas(p => ({ ...p, [d.id]: { emissao: e.target.value, validade: p[d.id]?.validade ?? d.data_validade ?? '' } }))}
          />
          <input
            type="date"
            className="text-xs border rounded px-1 py-0.5"
            value={editDatas[d.id]?.validade ?? d.data_validade ?? ''}
            onChange={e => setEditDatas(p => ({ ...p, [d.id]: { emissao: p[d.id]?.emissao ?? d.data_emissao ?? '', validade: e.target.value } }))}
          />
          <button
            onClick={() =>
              agir({
                acao: 'corrigir_datas',
                documento_id: d.id,
                data_emissao: editDatas[d.id]?.emissao ?? d.data_emissao,
                data_validade: editDatas[d.id]?.validade ?? d.data_validade,
              }, d.id)
            }
            disabled={busyId === d.id || !(editDatas[d.id]?.emissao ?? d.data_emissao) || !(editDatas[d.id]?.validade ?? d.data_validade)}
            className="px-3 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-40"
          >
            Salvar datas
          </button>
        </div>
      )}
      {(d.identity_match === 'quarantine' || !d.colaborador_id) && (
        <div className="flex flex-wrap items-center gap-1 w-full">
          <div className="relative">
            <FiSearch className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
            <input
              placeholder="Buscar colaborador (nome ou CPF)"
              className="text-xs border rounded pl-6 pr-2 py-1 w-56"
              value={colabSearch[d.id] ?? ''}
              onChange={e => setColabSearch(p => ({ ...p, [d.id]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') buscarColabs(d.id); }}
            />
          </div>
          <button
            onClick={() => buscarColabs(d.id)}
            className="px-2 py-1 text-xs border rounded text-gray-600 hover:bg-gray-50"
          >
            Buscar
          </button>
          {colabOptions.length > 0 && (
            <select
              className="text-xs border rounded px-1 py-1 max-w-xs"
              defaultValue=""
              onChange={e => {
                if (e.target.value) agir({ acao: 'resolver_quarentena', documento_id: d.id, colaborador_id: e.target.value }, d.id);
              }}
            >
              <option value="">Associar ao colaborador…</option>
              {colabOptions.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );

  const renderDocCard = (d: DocRow, extra?: React.ReactNode) => (
    <div key={d.id} className={`border rounded-lg p-3 ${!d.colaborador_id ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm text-gray-900">{d.titulo}</p>
          <p className="text-xs text-gray-500">
            {nomeColab(d)} · tipo: {d.tipo_documento} · origem: {d.origem || '-'}
          </p>
          <p className="text-xs text-gray-500">
            rastreio: {isFallbackRastreio(d.numero_rastreio) ? (
              <span className="text-orange-600 font-medium" title="Código interno gerado — substituir pelo número próprio do documento quando existir">
                {d.numero_rastreio} (fallback)
              </span>
            ) : (
              d.numero_rastreio || <span className="text-red-600 font-medium">ausente</span>
            )} ·
            {' '}emissão: {d.data_emissao || <span className="text-red-600 font-medium">ausente</span>} ·
            {' '}validade: {d.data_validade || <span className="text-red-600 font-medium">ausente</span>}
            {d.identity_match === 'quarantine' && (
              <> · <span className="text-red-600 font-semibold">EM QUARENTENA</span></>
            )}
          </p>
        </div>
        {extra}
      </div>
      {renderAcoes(d)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Auditoria de Integridade Documental</h2>
          <p className="text-sm text-gray-500">Pendências de identidade, datas, rastreio e duplicidade</p>
        </div>
        <button onClick={carregar} className="flex items-center px-3 py-2 text-sm border rounded-md text-gray-600 hover:bg-gray-50">
          <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Recarregar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}
      {feedback && (
        <div className={`p-3 rounded-md text-sm ${feedback.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="border rounded-lg p-2 bg-gray-50">
          <p className="text-[10px] uppercase text-gray-400">Total docs</p>
          <p className="text-xl font-bold text-gray-900">{data?.resumo.total_documentos ?? '—'}</p>
        </div>
        {BUCKETS.map(b => (
          <button
            key={b.key}
            onClick={() => setBucket(b.key)}
            className={`border rounded-lg p-2 text-left transition ${bucket === b.key ? 'ring-2 ring-abz-blue bg-blue-50' : 'bg-white hover:bg-gray-50'} ${
              (data?.resumo[b.key] ?? 0) > 0 ? 'border-orange-300' : ''
            }`}
          >
            <span className="flex items-center gap-1 text-[10px] uppercase text-gray-400">
              {b.icon} {b.label}
            </span>
            <p className={`text-xl font-bold ${(data?.resumo?.[b.key] ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {b.key === 'duplicados' ? (data?.resumo?.duplicados_excedentes ?? '—') : (data?.resumo?.[b.key] ?? '—')}
            </p>
          </button>
        ))}
      </div>

      {bucket === 'duplicados' ? (
        <div className="space-y-3">
          {(data?.duplicados?.length ?? 0) === 0 && !loading && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
              <FiCheckCircle /> Nenhuma duplicidade encontrada.
            </div>
          )}
          {data?.duplicados?.map((g, gi) => (
            <div key={gi} className="border border-orange-200 bg-orange-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-orange-700 uppercase">
                Grupo com {g.grupo?.length || 0} registros idênticos — clique em &quot;Manter este&quot; no registro correto
              </p>
              {g.grupo?.map(d =>
                renderDocCard(
                  d,
                  <button
                    onClick={() => agir({ acao: 'mesclar_duplicados', manter_id: d.id }, d.id)}
                    disabled={busyId === d.id}
                    className="px-3 py-1 text-xs bg-white border border-orange-300 text-orange-700 rounded hover:bg-orange-100 whitespace-nowrap"
                  >
                    Manter este
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(listaAtual()?.length ?? 0) === 0 && !loading && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
              <FiCheckCircle /> Nada pendente nesta categoria.
            </div>
          )}
          {listaAtual()?.map(d => renderDocCard(d))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-6"><FiRefreshCw className="animate-spin h-6 w-6 text-abz-blue" /></div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <FiFileText /> Regras: todo documento consultável exige data de emissão, validade e número único de rastreio.
        O rastreio deve ser o NÚMERO PRÓPRIO do documento (nº do ASO no laudo, nº do passaporte, nº do certificado);
        o código interno GT-... é apenas fallback para documentos sem numeração própria.
        Documentos ambíguos de identidade vão para quarentena até resolução manual.
      </p>
    </div>
  );
}
