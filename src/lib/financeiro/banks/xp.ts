/**
 * Adapter XP Investimentos (FEBRABAN 348) — §4 do design financeiro.
 *
 * FASE 1: conciliação via importação de extrato/CSV do Internet Banking XP
 * (nenhuma credencial de API; upload manual na rota /conciliacoes/upload-csv).
 *
 * HOOK API PRIVADA (futuro): credentialSchema já traz `api_url` + `api_token`.
 * Quando a API privada da XP for liberada, implementar aqui as chamadas HTTP
 * (Bearer no api_token, base em api_url) — até lá listarConciliacao sem
 * credenciais lança CapacidadeNaoSuportadaError apontando para o upload CSV,
 * e gerarCobrancaBoleto/Pix/enviarPagamentoLote sempre lançam o erro tipado.
 */
import type {
  BankAdapter,
  BankAdapterMeta,
  BankStatusResultado,
  ConciliacaoMovimento,
} from './types';
import { CapacidadeNaoSuportadaError } from './types';
import { clienteHttp, sanitizarRaw, type HttpClient } from './http-mtls';
import { parseCsvExtrato } from './csv-extrato';

export const XP_META: BankAdapterMeta = {
  key: 'xp',
  nome: 'XP Investimentos',
  codigoFebraban: '348',
  ambientes: ['producao'],
  capacidades: ['conciliacao'],
  credentialSchema: [
    {
      key: 'api_url',
      label: 'URL da API privada XP',
      kind: 'text',
      required: false,
      help: 'Reservado para a API privada XP (hook futuro); não usado na Fase 1.',
    },
    {
      key: 'api_token',
      label: 'Token da API privada XP',
      kind: 'secret',
      required: false,
      help: 'Reservado para a API privada XP (hook futuro); não usado na Fase 1.',
    },
  ],
  certificados: [],
  descricaoCredenciais:
    'Fase 1: nenhuma credencial de API — conciliação por CSV exportado do Internet ' +
    'Banking XP (upload manual). api_url/api_token preenchíveis para a API privada futura.',
};

export interface DepsXp {
  http?: HttpClient;
}

export function criarXpAdapter(deps: DepsXp = {}): BankAdapter {
  return {
    meta: XP_META,

    /**
     * API privada (hook): só ativa se api_url + api_token estiverem preenchidos.
     * Sem credenciais → erro tipado apontando para o fluxo de upload CSV.
     */
    async listarConciliacao(ctx, input) {
      const { api_url: apiUrl, api_token: apiToken } = ctx.credenciais;
      if (!apiUrl || !apiToken) {
        throw new CapacidadeNaoSuportadaError(
          'conciliação via API (use upload do extrato CSV do Internet Banking)',
          'xp',
        );
      }
      // HOOK — endpoint ilustrativo; confirmar quando a API privada for liberada.
      const qs = new URLSearchParams({ de: input.de, ate: input.ate });
      const http = clienteHttp(ctx, deps.http);
      const res = await http(`${apiUrl.replace(/\/$/, '')}/extrato?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`XP API: falha ao consultar extrato (HTTP ${res.status}).`);
      const json = JSON.parse(res.texto) as { movimentos?: Record<string, unknown>[] };
      const movimentos: ConciliacaoMovimento[] = [];
      for (const l of Array.isArray(json.movimentos) ? json.movimentos : []) {
        const valor = Number(l.valor ?? 0);
        movimentos.push({
          idExterno: String(l.id ?? ''),
          data: String(l.data ?? '').slice(0, 10),
          tipo: valor >= 0 ? 'credito' : 'debito',
          valor: Math.abs(valor),
          descricao: String(l.descricao ?? ''),
          raw: sanitizarRaw(l),
        });
      }
      return movimentos;
    },

    async gerarCobrancaBoleto() {
      throw new CapacidadeNaoSuportadaError('cobranca_boleto', 'xp');
    },

    async gerarCobrancaPix() {
      throw new CapacidadeNaoSuportadaError('cobranca_pix', 'xp');
    },

    async enviarPagamentoLote() {
      throw new CapacidadeNaoSuportadaError('pagamento_lote', 'xp');
    },

    async status(ctx): Promise<BankStatusResultado> {
      const { api_url: apiUrl, api_token: apiToken } = ctx.credenciais;
      if (!apiUrl || !apiToken) {
        return {
          ok: true,
          detalhe: 'XP Fase 1: conciliação via upload de CSV do Internet Banking (sem API conectada).',
        };
      }
      try {
        const http = clienteHttp(ctx, deps.http);
        const res = await http(apiUrl, { headers: { Authorization: `Bearer ${apiToken}` } });
        return res.ok
          ? { ok: true, detalhe: 'XP API privada respondeu OK (hook).' }
          : { ok: false, detalhe: `XP API privada respondeu HTTP ${res.status}.` };
      } catch (e) {
        return { ok: false, detalhe: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

/**
 * Fase 1 — importação de extrato CSV do Internet Banking XP (rota upload-csv).
 * Delgada para o parser genérico; exposta aqui para o service/stream de rotas.
 */
export function importarCsvExtrato(conteudo: string): ConciliacaoMovimento[] {
  return parseCsvExtrato(conteudo);
}

/** Instância padrão usada pelo registry. */
export const xpAdapter: BankAdapter = criarXpAdapter();
