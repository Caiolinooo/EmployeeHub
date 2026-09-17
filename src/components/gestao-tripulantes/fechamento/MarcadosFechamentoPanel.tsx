'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiList,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiUserCheck,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import {
  resolverColaboradorIdLinha,
  type ColaboradorTotaisLinha,
} from './fechamentoV2';

interface MarcadosFechamentoPanelProps {
  mesReferencia: string;
  /** Linhas do payload atual do relatorio-mensal (colaboradoresTotais, já filtradas). */
  colaboradores: ColaboradorTotaisLinha[];
  podeEditar: boolean;
  /** Tick externo (live probe) — refetch quando muda. */
  refreshTick?: number;
}

interface MarcadoRow {
  colaboradorId: string;
  nome: string;
  marcado: boolean;
  marcadoPorNome?: string | null;
}

interface MarcacoesApiResponse {
  success?: boolean;
  listaConfirmada?: boolean;
  marcados?: Array<{
    colaboradorId?: string;
    colaborador_id?: string;
    nome?: string;
    marcado?: boolean;
    marcadoPorNome?: string | null;
    marcado_por_nome?: string | null;
  }>;
  data?: MarcacoesApiResponse;
  error?: string;
}

/**
 * R5: lista explícita de marcados por mes_referencia.
 * lista_confirmada = false → comportamento legado (entra quem passa nos filtros).
 * lista_confirmada = true  → SÓ os marcados entram no fechamento daquele mês.
 */
export default function MarcadosFechamentoPanel({
  mesReferencia,
  colaboradores,
  podeEditar,
  refreshTick = 0,
}: MarcadosFechamentoPanelProps) {
  const { t } = useI18n();
  const [marcadosMap, setMarcadosMap] = useState<Map<string, MarcadoRow>>(new Map());
  const [listaConfirmada, setListaConfirmada] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [idMap, setIdMap] = useState<Map<string, string>>(new Map());
  const seqRef = useRef(0);
  const lastTickRef = useRef(refreshTick);

  const carregar = useCallback(async () => {
    if (!mesReferencia) return;
    const seq = ++seqRef.current;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWithToken(
        `/api/gestao-tripulantes/fechamento/marcacoes?mesReferencia=${encodeURIComponent(mesReferencia)}`,
      );
      const json = (await res.json().catch(() => ({}))) as MarcacoesApiResponse;
      if (seq !== seqRef.current) return;
      if (!res.ok) {
        throw new Error(
          json.error || t('gtFechV2.marcados.erroCarregar', 'Erro ao carregar lista de marcados.'),
        );
      }
      const payload = json?.data && typeof json.data === 'object' ? json.data : json;
      const rows = Array.isArray(payload?.marcados) ? payload!.marcados! : [];
      const next = new Map<string, MarcadoRow>();
      rows.forEach((r) => {
        const id = String(r.colaboradorId || r.colaborador_id || '').trim();
        if (!id) return;
        next.set(id, {
          colaboradorId: id,
          nome: String(r.nome || ''),
          marcado: r.marcado !== false,
          marcadoPorNome: r.marcadoPorNome || r.marcado_por_nome || null,
        });
      });
      setMarcadosMap(next);
      setListaConfirmada(Boolean(payload?.listaConfirmada));
    } catch (err) {
      if (seq !== seqRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === seqRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesReferencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // R3: refetch quando o probe de mudança disparar.
  useEffect(() => {
    if (refreshTick !== lastTickRef.current) {
      lastTickRef.current = refreshTick;
      carregar();
    }
  }, [refreshTick, carregar]);

  // Mapa nome→id do quadro de colaboradores (fallback quando o payload do
  // relatório ainda não traz colaboradorId por linha).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchWithToken('/api/gestao-tripulantes/colaboradores?limit=5000');
        if (!res.ok || cancelled) return;
        const json = await res.json().catch(() => ({}));
        const rows = json.data || json.colaboradores || [];
        if (!Array.isArray(rows) || cancelled) return;
        const map = new Map<string, string>();
        rows.forEach((r: { id?: string; nome_completo?: string; cpf?: string }) => {
          if (!r.id) return;
          const nome = String(r.nome_completo || '').trim().toLowerCase();
          const cpf = String(r.cpf || '').replace(/\D/g, '');
          if (nome) map.set(`n:${nome}`, r.id);
          if (cpf) map.set(`c:${cpf}`, r.id);
        });
        if (!cancelled) setIdMap(map);
      } catch {
        // fail-soft: fallback de resolução indisponível
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolverId = (linha: ColaboradorTotaisLinha): string | null => {
    const direto = resolverColaboradorIdLinha(linha);
    if (direto) return direto;
    const porNome = idMap.get(`n:${(linha.nome || '').trim().toLowerCase()}`);
    if (porNome) return porNome;
    const porCpf = idMap.get(`c:${String(linha.cpf || '').replace(/\D/g, '')}`);
    if (porCpf) return porCpf;
    return null;
  };

  // União: linhas do payload atual + marcações persistidas fora do filtro atual.
  const linhas = useMemo(() => {
    const vistas = new Set<string>();
    const out: Array<{
      id: string | null;
      nome: string;
      cargo?: string;
      embarcacao?: string;
      cpf?: string;
      marcado: boolean;
      marcadoPorNome?: string | null;
      origemPayload: boolean;
    }> = [];
    colaboradores.forEach((c) => {
      const id = resolverId(c);
      const key = id || `nome:${(c.nome || '').toLowerCase()}`;
      vistas.add(key);
      const persistido = id ? marcadosMap.get(id) : undefined;
      out.push({
        id,
        nome: c.nome,
        cargo: c.cargo,
        embarcacao: c.embarcacao,
        cpf: c.cpf_formatado || c.cpf,
        marcado: persistido ? persistido.marcado : false,
        marcadoPorNome: persistido?.marcadoPorNome || null,
        origemPayload: true,
      });
    });
    marcadosMap.forEach((m) => {
      if (vistas.has(m.colaboradorId)) return;
      // marcado fora do filtro atual — aparece para não sumir da lista
      out.push({
        id: m.colaboradorId,
        nome: m.nome,
        marcado: m.marcado,
        marcadoPorNome: m.marcadoPorNome,
        origemPayload: false,
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradores, marcadosMap, idMap]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter(
      (l) =>
        (l.nome || '').toLowerCase().includes(q) ||
        (l.cargo || '').toLowerCase().includes(q) ||
        String(l.cpf || '').includes(q),
    );
  }, [linhas, busca]);

  const totalMarcados = linhas.filter((l) => l.marcado).length;

  const setMarcado = (id: string | null, valor: boolean) => {
    if (!id) return;
    setMarcadosMap((prev) => {
      const next = new Map(prev);
      const atual = next.get(id);
      next.set(id, {
        colaboradorId: id,
        nome: atual?.nome || '',
        marcado: valor,
        marcadoPorNome: atual?.marcadoPorNome || null,
      });
      return next;
    });
  };

  const marcarTodosVisiveis = (valor: boolean) => {
    setMarcadosMap((prev) => {
      const next = new Map(prev);
      filtradas.forEach((l) => {
        if (!l.id) return;
        next.set(l.id, {
          colaboradorId: l.id,
          nome: l.nome,
          marcado: valor,
          marcadoPorNome: next.get(l.id)?.marcadoPorNome || null,
        });
      });
      return next;
    });
  };

  const salvar = async (confirmarLista?: boolean) => {
    setErrorMsg(null);
    setOkMsg(null);
    const itens = linhas
      .filter((l) => l.id)
      .map((l) => ({ colaboradorId: l.id as string, marcado: l.marcado }));
    setIsSaving(true);
    try {
      // R5: listaConfirmada só vai no body no confirmar/reabrir EXPLÍCITO.
      // No "Salvar marcações" simples o campo fica ausente (server mantém o
      // valor atual) — ecoar o estado local poderia desconfirmar uma lista
      // confirmada por outra sessão entre o load e o save.
      const body: Record<string, unknown> = { mesReferencia, itens };
      if (typeof confirmarLista === 'boolean') body.listaConfirmada = confirmarLista;
      const res = await fetchWithToken('/api/gestao-tripulantes/fechamento/marcacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as MarcacoesApiResponse;
      if (!res.ok) {
        throw new Error(json.error || t('gtFechV2.marcados.erroSalvar', 'Erro ao salvar marcados.'));
      }
      if (confirmarLista !== undefined) setListaConfirmada(confirmarLista);
      setOkMsg(
        confirmarLista
          ? t('gtFechV2.marcados.confirmadaOk', 'Lista confirmada: só os marcados entram neste fechamento.')
          : t('gtFechV2.marcados.salvo', 'Marcados salvos.'),
      );
      await carregar();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const btnBase =
    'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50';

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-900">
          <FiList className="text-violet-600" />
          {t('gtFechV2.marcados.titulo', 'Marcados do Fechamento')}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              listaConfirmada ? 'bg-emerald-600 text-white' : 'bg-amber-400 text-amber-950'
            }`}
          >
            {listaConfirmada
              ? t('gtFechV2.marcados.estadoConfirmada', 'Confirmada — só marcados entram')
              : t('gtFechV2.marcados.estadoAberta', 'Aberta — todos entram')}
          </span>
        </h4>
        <span className="text-[11px] font-semibold text-gray-600">
          {t(
            'gtFechV2.marcados.totalMarcados',
            { n: totalMarcados, total: linhas.length },
            '{{n}} marcados de {{total}}',
          )}
        </span>
      </div>

      <p className="text-[11px] text-gray-600">
        {listaConfirmada
          ? t(
              'gtFechV2.marcados.estadoConfirmadaHint',
              'Lista confirmada: apenas as pessoas marcadas abaixo entram no fechamento deste mês.',
            )
          : t(
              'gtFechV2.marcados.estadoAbertaHint',
              'Lista não confirmada: todos que passam nos filtros entram no fechamento (comportamento atual). Confirme a lista para restringir aos marcados.',
            )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t('gtFechV2.marcados.buscaPlaceholder', 'Filtrar por nome, cargo ou CPF…')}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-xs focus:ring-2 focus:ring-abz-blue"
          />
        </div>
        <button
          type="button"
          onClick={() => marcarTodosVisiveis(true)}
          disabled={!podeEditar || filtradas.length === 0}
          className={`${btnBase} border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50`}
        >
          <FiUserCheck className="h-3.5 w-3.5" />
          {t('gtFechV2.marcados.marcarTodos', 'Marcar todos (filtro atual)')}
        </button>
        <button
          type="button"
          onClick={() => marcarTodosVisiveis(false)}
          disabled={!podeEditar || filtradas.length === 0}
          className={`${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
        >
          {t('gtFechV2.marcados.limpar', 'Limpar')}
        </button>
        <button
          type="button"
          onClick={() => salvar()}
          disabled={!podeEditar || isSaving}
          className={`${btnBase} border border-abz-blue/30 bg-white text-abz-blue hover:bg-blue-50`}
        >
          {isSaving ? (
            <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FiSave className="h-3.5 w-3.5" />
          )}
          {t('gtFechV2.marcados.salvar', 'Salvar marcações')}
        </button>
        {listaConfirmada ? (
          <button
            type="button"
            onClick={() => salvar(false)}
            disabled={!podeEditar || isSaving}
            className={`${btnBase} border border-amber-300 bg-white text-amber-800 hover:bg-amber-50`}
          >
            {t('gtFechV2.marcados.reabrirLista', 'Reabrir lista')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => salvar(true)}
            disabled={!podeEditar || isSaving}
            className={`${btnBase} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}
          >
            <FiCheckCircle className="h-3.5 w-3.5" />
            {t('gtFechV2.marcados.confirmarLista', 'Confirmar lista')}
          </button>
        )}
        <button
          type="button"
          onClick={carregar}
          disabled={isLoading}
          className="min-h-[44px] rounded-lg border border-gray-300 bg-white p-2 text-gray-500 hover:text-gray-900 disabled:opacity-50"
          title={t('gtFechV2.toolbar.recarregar', 'Recarregar')}
        >
          <FiRefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!podeEditar && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
          {t(
            'gtFechV2.marcados.semPermissao',
            'Somente gestores de fechamento (ou ACL fechamento.marcas) podem editar a lista.',
          )}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {okMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
          <FiCheckCircle className="h-4 w-4 shrink-0" />
          <span>{okMsg}</span>
        </div>
      )}

      <div className="max-h-[420px] overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 bg-gray-100 text-gray-700">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 font-bold">{t('gtFechV2.fila.colaborador', 'Tripulante')}</th>
              <th className="px-3 py-2 font-bold">{t('gtFechV2.marcados.colCargo', 'Cargo')}</th>
              <th className="px-3 py-2 font-bold">{t('gtFechV2.marcados.colEmbarcacao', 'Embarcação')}</th>
              <th className="px-3 py-2 font-bold">{t('gtFechV2.marcados.colMarcadoPor', 'Marcado por')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading && linhas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  <FiRefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin text-abz-blue" />
                  {t('gtFechV2.marcados.carregando', 'Carregando marcados…')}
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  {t('gtFechV2.marcados.vazio', 'Nenhum tripulante no filtro atual.')}
                </td>
              </tr>
            ) : (
              filtradas.map((l, idx) => (
                <tr key={l.id || `${l.nome}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={l.marcado}
                      disabled={!podeEditar || !l.id}
                      onChange={(e) => setMarcado(l.id, e.target.checked)}
                      title={
                        !l.id
                          ? t('gtFechV2.marcados.semId', 'Sem vínculo de colaborador — não marcável')
                          : undefined
                      }
                      className="h-4 w-4 min-w-4 rounded border-gray-300 text-abz-blue focus:ring-abz-blue"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-gray-900">{l.nome}</span>
                    {!l.origemPayload && (
                      <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {t('gtFechV2.marcados.foraFiltro', 'fora do filtro atual')}
                      </span>
                    )}
                    {l.cpf && (
                      <span className="ml-2 font-mono text-[10px] text-gray-400">{l.cpf}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{l.cargo || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{l.embarcacao || '—'}</td>
                  <td className="px-3 py-2 text-[11px] text-gray-500">
                    {l.marcadoPorNome || (l.marcado ? '—' : '')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
