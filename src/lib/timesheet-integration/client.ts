/**
 * Cliente da Integration API v1 do Time-Sheet / PontoFlow (design §4/§8).
 * Singleton por empresa (1 tenant TS por empresa — D10); credenciais via
 * getCredential('timesheet.<empresa_id>.{base_url,api_key}') e URL validada
 * por parseSafeUrl (SSRF guard: https, sem credenciais, sem host privado).
 */
import { getCredential } from '@/lib/secure-credentials';
import { joinSafeUrl, parseSafeUrl } from '@/lib/security/safe-url';
import { empresaCredentialKeys } from './settings';
import type {
  ISODate,
  PersonResult,
  PersonUpsert,
  TimesheetClient,
  TimesheetSummary,
} from './types';

export class TimesheetApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = 'timesheet_api_error') {
    super(message);
    this.name = 'TimesheetApiError';
    this.status = status;
    this.code = code;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

type QueryParams = Record<string, string>;

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    const inner: unknown = payload.data;
    return inner as T;
  }
  return payload as T;
}

/** Extrai {code,message} de um corpo de erro `{error:{code,message}}` via narrowing. */
function parseErrorBody(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return {};
  const errVal: unknown = payload.error;
  if (!errVal || typeof errVal !== 'object') return {};
  return {
    code: 'code' in errVal && typeof errVal.code === 'string' ? errVal.code : undefined,
    message: 'message' in errVal && typeof errVal.message === 'string' ? errVal.message : undefined,
  };
}

async function apiFetch(
  base: URL,
  apiKey: string,
  path: string,
  init: { method: string; body?: unknown; headers?: Record<string, string>; query?: QueryParams },
): Promise<unknown> {
  const url = joinSafeUrl(base.href, path, { allowedHosts: [base.hostname] });
  if (init.query) {
    url.search = new URLSearchParams(init.query).toString();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers || {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimesheetApiError('Timeout ao chamar a API do Time-Sheet', 0, 'timeout');
    }
    throw new TimesheetApiError(
      `Falha de rede ao chamar a API do Time-Sheet: ${err instanceof Error ? err.message : String(err)}`,
      0,
      'network_error',
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const apiError = parseErrorBody(payload);
    throw new TimesheetApiError(
      apiError.message || `Time-Sheet API respondeu HTTP ${res.status}`,
      res.status,
      apiError.code || `http_${res.status}`,
    );
  }
  return payload;
}

function buildClient(base: URL, apiKey: string): TimesheetClient {
  return {
    async putPerson(
      p: PersonUpsert,
      o: { idempotencyKey: string; dryRun?: boolean },
    ): Promise<PersonResult> {
      const payload = await apiFetch(base, apiKey, '/api/integration/v1/people', {
        method: 'PUT',
        body: p,
        headers: { 'Idempotency-Key': o.idempotencyKey },
        ...(o.dryRun ? { query: { dryRun: 'true' } } : {}),
      });
      return unwrap<PersonResult>(payload);
    },

    async createSsoLink(p: { externalId: string }): Promise<{ url: string; expiresAt: string }> {
      const payload = await apiFetch(base, apiKey, '/api/integration/v1/sso', {
        method: 'POST',
        body: { externalId: p.externalId },
      });
      const data = unwrap<{ url?: string; expiresAt?: string; expires_at?: string }>(payload);
      if (!data || typeof data.url !== 'string' || !data.url) {
        throw new TimesheetApiError('Resposta de SSO sem URL', 0, 'invalid_sso_response');
      }
      return {
        url: data.url,
        expiresAt: data.expiresAt || data.expires_at || new Date(Date.now() + 60_000).toISOString(),
      };
    },

    async listTimesheets(p: {
      externalId: string;
      from: ISODate;
      to: ISODate;
    }): Promise<TimesheetSummary[]> {
      const payload = await apiFetch(base, apiKey, '/api/integration/v1/timesheets', {
        method: 'GET',
        query: { externalId: p.externalId, from: p.from, to: p.to },
      });
      if (Array.isArray(payload)) return payload as TimesheetSummary[];
      const data = unwrap<TimesheetSummary[] | { timesheets?: TimesheetSummary[] }>(payload);
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.timesheets)) return data.timesheets;
      return [];
    },
  };
}

const clientCache = new Map<string, Promise<TimesheetClient>>();

/** Invalida o singleton (ex.: após salvar novas credenciais da empresa). */
export function resetTimesheetClientCache(empresaId?: string): void {
  if (empresaId) clientCache.delete(empresaId);
  else clientCache.clear();
}

/**
 * Singleton por empresa. Lê `timesheet.<empresa_id>.base_url|api_key` de
 * app_secrets e valida a URL com parseSafeUrl (allowlist = próprio host,
 * mesmo padrão de resolvePoliwebUrl em safe-url.ts).
 */
export function getTimesheetClient(empresaId: string): Promise<TimesheetClient> {
  const cached = clientCache.get(empresaId);
  if (cached) return cached;

  const promise = (async (): Promise<TimesheetClient> => {
    const keys = empresaCredentialKeys(empresaId);
    const [baseUrlRaw, apiKey] = await Promise.all([
      getCredential(keys.baseUrl),
      getCredential(keys.apiKey),
    ]);
    if (!baseUrlRaw || !apiKey) {
      throw new TimesheetApiError(
        `Credenciais do Time-Sheet não configuradas para a empresa ${empresaId}`,
        0,
        'credenciais_ausentes',
      );
    }
    let hostname: string;
    try {
      hostname = new URL(baseUrlRaw).hostname;
    } catch {
      throw new TimesheetApiError('URL base do Time-Sheet inválida', 0, 'url_invalida');
    }
    const base = parseSafeUrl(baseUrlRaw, { allowedHosts: [hostname] });
    return buildClient(base, apiKey);
  })();

  clientCache.set(empresaId, promise);
  // Não cachear falhas: próxima tentativa re-resolve as credenciais.
  promise.catch(() => clientCache.delete(empresaId));
  return promise;
}
