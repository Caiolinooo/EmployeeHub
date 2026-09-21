/**
 * Cliente REST da Radar.API (WK Radar) — PULL-ONLY.
 *
 * Padrão do client MIO (src/lib/mio/client.ts): allowlist de paths de leitura
 * + bloqueio de escrita. Aqui só existe GET: qualquer outro método é recusado
 * antes de sair da rede, e paths fora da allowlist também.
 *
 * Credenciais vêm da tabela app_secrets via getCredential() (mesma via do
 * resto do portal): 'wkradar_api_url' e 'wkradar_api_token'.
 *
 * Throttle: 4 req/s (intervalo mínimo de 250ms entre requisições, fila
 * sequencial) — mesmo espírito do throttle do pull do MIO.
 */
import { getCredential } from '@/lib/secure-credentials';

/** Chaves de credencial em app_secrets (mesmo formato que getCredential consome). */
export const WK_URL_CREDENTIAL_KEY = 'wkradar_api_url';
export const WK_TOKEN_CREDENTIAL_KEY = 'wkradar_api_token';

/** Credencial ausente/parcial — mensagem acionável apontando a rota de config. */
export class ErroWkCredencial extends Error {
  constructor(mensagem?: string) {
    super(
      mensagem ||
        'Credenciais da Radar.API (WK Radar) não configuradas. Um ADMIN deve cadastrar wkradar_api_url e wkradar_api_token em PUT /api/dp/wk/credentials (ou use a importação por arquivo).'
    );
    this.name = 'ErroWkCredencial';
  }
}

const WK_TIMEOUT_MS = 15_000;
/** 4 req/s → 250ms entre requisições. */
const WK_INTERVALO_MIN_MS = 250;

/**
 * Allowlist de paths de LEITURA da Radar.API.
 * UNVERIFIED — confirmar os paths exatos no swagger da instância (a Radar.API
 * varia por versão/contrato do cliente); ajuste aqui sem tocar nos contratos
 * internos (sync/normalize/rotas).
 */
export const WK_PULL_PATHS: RegExp[] = [
  /^\/funcionarios\/?$/i,            // UNVERIFIED: listagem de funcionários (RH)
  /^\/funcionarios\/[^/]+\/?$/i,     // UNVERIFIED: funcionário por identificador
  /^\/rh\/funcionarios\/?$/i,        // UNVERIFIED: alternativa de agrupador RH
  /^\/folha\/funcionarios\/?$/i,     // UNVERIFIED: funcionários no escopo de folha
  /^\/afastamentos\/?$/i,            // UNVERIFIED: afastamentos (RH/folha)
  /^\/rubricas\/?$/i,                // UNVERIFIED: tabela de rubricas/eventos
  /^\/rubricas-programadas\/?$/i,    // UNVERIFIED: rubricas programadas por competência
  /^\/folha\/lancamentos\/?$/i,      // UNVERIFIED: lançamentos da folha da competência
];

/** UNVERIFIED — candidatos de endpoint de funcionários, testados em ordem pelo sync. */
export const WK_CANDIDATOS_FUNCIONARIOS = [
  '/funcionarios',
  '/rh/funcionarios',
  '/folha/funcionarios',
];

/** UNVERIFIED — candidatos de endpoint de lançamentos/rubricas da competência. */
export const WK_CANDIDATOS_LANCAMENTOS = [
  '/rubricas-programadas',
  '/folha/lancamentos',
  '/rubricas',
];

export interface WkCredenciais {
  url: string;
  token: string;
}

/** Lê as credenciais da Radar.API. Falta uma delas → ErroWkCredencial
 * (nunca segue com request parcial). */
export async function carregarCredenciaisWk(): Promise<WkCredenciais> {
  const [urlCrua, token] = await Promise.all([
    getCredential(WK_URL_CREDENTIAL_KEY),
    getCredential(WK_TOKEN_CREDENTIAL_KEY),
  ]);
  if (!urlCrua || !token) throw new ErroWkCredencial();
  return { url: urlCrua.trim().replace(/\/+$/, ''), token };
}

/** Path está na allowlist de pull? */
export function ehPathPullWk(path: string): boolean {
  const normalizado = path.startsWith('/') ? path : `/${path}`;
  return WK_PULL_PATHS.some((re) => re.test(normalizado));
}

// ---------------------------------------------------------------------------
// Throttle: fila sequencial que garante ≥ WK_INTERVALO_MIN_MS entre requests.
// Técnica de "chain": cada requisição agenda seu instante alvo na ponta da
// fila (mesma abordagem de serialização de pulls do client MIO).
// ---------------------------------------------------------------------------
let cadeiaThrottle: Promise<number> = Promise.resolve(0);

async function agendarVezThrottle(): Promise<void> {
  const vez = cadeiaThrottle.then((anterior) =>
    Math.max(anterior + WK_INTERVALO_MIN_MS, Date.now()),
  );
  cadeiaThrottle = vez;
  const alvo = await vez;
  const espera = alvo - Date.now();
  if (espera > 0) {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, espera);
    await promise;
  }
}

export interface WkGetOpcoes {
  /** Query params; undefined/null/vazio são ignorados. */
  query?: Record<string, string | number | undefined | null>;
}

/**
 * GET pull-only na Radar.API: allowlist + Bearer token + throttle 4 req/s +
 * timeout de 15s. Falha HTTP/ rede → Error com contexto; credencial ausente →
 * ErroWkCredencial.
 */
export async function wkGet<T = unknown>(
  path: string,
  opcoes?: WkGetOpcoes,
): Promise<T> {
  const normalizado = path.startsWith('/') ? path : `/${path}`;
  if (!ehPathPullWk(normalizado)) {
    throw new Error(
      `[WK] Path fora da allowlist de pull bloqueado: GET ${normalizado} — Radar.API é somente leitura e só paths em WK_PULL_PATHS são permitidos.`,
    );
  }

  const { url, token } = await carregarCredenciaisWk();

  const qs = new URLSearchParams();
  for (const [chave, valor] of Object.entries(opcoes?.query || {})) {
    if (valor === undefined || valor === null || valor === '') continue;
    qs.set(chave, String(valor));
  }
  const destino = `${url}${normalizado}${qs.toString() ? `?${qs.toString()}` : ''}`;

  await agendarVezThrottle();

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), WK_TIMEOUT_MS);
  try {
    const resposta = await fetch(destino, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controlador.signal,
      cache: 'no-store',
    });
    if (!resposta.ok) {
      throw new Error(
        `[WK] Radar.API respondeu HTTP ${resposta.status} para GET ${normalizado}`,
      );
    }
    return (await resposta.json()) as T;
  } catch (erro) {
    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new Error(
        `[WK] Timeout de ${WK_TIMEOUT_MS / 1000}s na Radar.API (GET ${normalizado})`,
      );
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extrai a lista de registros de envelopes variados da Radar.API:
 * array cru, { data: [...] }, { items }, { rows }, { result(s) },
 * { records }, { lista } — e até 2 níveis de aninhamento em qualquer chave
 * (endpoints UNVERIFIED: envelope não conhecido a priori).
 */
export function extrairListaWk<T = Record<string, unknown>>(json: unknown, profundidade = 2): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object' && profundidade > 0) {
    const rec = json as Record<string, unknown>;
    for (const chave of ['data', 'items', 'rows', 'result', 'results', 'records', 'lista']) {
      const valor = rec[chave];
      if (Array.isArray(valor)) return valor as T[];
    }
    for (const valor of Object.values(rec)) {
      if (valor && typeof valor === 'object') {
        const aninhado = extrairListaWk<T>(valor, profundidade - 1);
        if (aninhado.length) return aninhado;
      }
    }
  }
  return [];
}
