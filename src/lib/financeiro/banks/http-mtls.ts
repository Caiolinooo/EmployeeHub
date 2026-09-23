/**
 * Cliente HTTP compartilhado para adapters de banco (§4 do design financeiro).
 * - mTLS com agente node:https (pfx + passphrase do certificado A1)
 * - cache de token OAuth2 client_credentials por integracaoId (expiração −60 s)
 * - timeout de rede 30 s (regra §3.1)
 * - sanitização de `raw` (segredos NUNCA vazam para respostas/logs)
 *
 * TODOS os adapters usam este cliente (nada de fetch cru espalhado).
 * Testes injetam um HttpClient próprio — nenhuma chamada de rede real.
 */
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import type { BankContext } from './types';

export const TIMEOUT_HTTP_MS = 30_000;

/** Limite de agentes mTLS em cache; excedente destrói o mais antigo (evict). */
const MAX_AGENTES_MTLS = 8;

export interface HttpRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}

/** Resposta já materializada (texto), simples de mockar nos testes. */
export interface HttpResponse {
  status: number;
  ok: boolean;
  cabecalhos: Record<string, string>;
  texto: string;
}

export type HttpClient = (url: string, init?: HttpRequestInit) => Promise<HttpResponse>;

type CertificadoMtls = NonNullable<BankContext['certificado']>;

/* ------------------------------------------------------------------ */
/* Agente mTLS (cache por caminho + fingerprint do certificado)        */
/* ------------------------------------------------------------------ */

const agentes = new Map<string, https.Agent>();

/** Destrói e remove o agente mais antigo quando o cache excede o limite. */
function evictarAgenteSeNecessario(): void {
  while (agentes.size >= MAX_AGENTES_MTLS) {
    const maisAntigo = agentes.keys().next().value;
    if (maisAntigo === undefined) break;
    agentes.get(maisAntigo)?.destroy();
    agentes.delete(maisAntigo);
  }
}

function agenteParaCertificado(cert: CertificadoMtls): https.Agent {
  const chave = `${cert.pfxPath}:${cert.fingerprint ?? ''}`;
  const existente = agentes.get(chave);
  if (existente) return existente;
  // O pfxPath aponta para um arquivo local provisório (o service baixa do bucket
  // financeiro-certificados antes de montar o BankContext).
  const pfx = fs.readFileSync(cert.pfxPath);
  evictarAgenteSeNecessario();
  const agente = new https.Agent({
    pfx,
    passphrase: cert.pfxPassphrase,
    keepAlive: true,
    rejectUnauthorized: true,
  });
  agentes.set(chave, agente);
  return agente;
}

/** Destrói os agentes mTLS de um caminho de certificado (ex. rotação/evict explícito). */
export function liberarAgenteMtls(pfxPath: string): void {
  for (const [chave, agente] of agentes) {
    if (chave.startsWith(`${pfxPath}:`)) {
      agente.destroy();
      agentes.delete(chave);
    }
  }
}

/** Destrói TODOS os agentes mTLS em cache (uso em shutdown/testes). */
export function limparAgentesMtls(): void {
  for (const agente of agentes.values()) agente.destroy();
  agentes.clear();
}

/**
 * Apaga o .pfx temporário materializado pelo service (bucket → disco) APÓS o uso.
 * Só remove arquivos dentro do diretório temporário do SO — nunca caminhos arbitrários.
 */
export function apagarPfxTemporario(pfxPath: string): void {
  try {
    const resolvido = path.resolve(pfxPath);
    if (resolvido.startsWith(path.resolve(os.tmpdir()))) {
      fs.unlinkSync(resolvido);
    }
  } catch {
    // arquivo já removido/inacessível: cleanup é best-effort
  }
}

/**
 * Limpeza de recursos de uma integração (exposto para o service chamar após
 * operações com certificado): cache de token + agente mTLS + pfx temporário.
 */
export function limparRecursosMtls(integracaoId?: string, pfxPath?: string): void {
  limparCacheTokens(integracaoId);
  if (pfxPath) liberarAgenteMtls(pfxPath);
}

/* ------------------------------------------------------------------ */
/* Cliente default (node:https/node:http) com timeout 30 s             */
/* ------------------------------------------------------------------ */

function requisicao(
  url: string,
  init: HttpRequestInit,
  certificado?: CertificadoMtls,
): Promise<HttpResponse> {
  const { promise, resolve, reject } = Promise.withResolvers<HttpResponse>();
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    reject(new Error(`URL inválida no cliente HTTP bancário.`));
    return promise;
  }
  const lib = u.protocol === 'http:' ? http : https;
  const opcoes: https.RequestOptions = {
    method: init.method ?? 'GET',
    hostname: u.hostname,
    port: u.port || undefined,
    path: `${u.pathname}${u.search}`,
    headers: { ...init.headers },
  };
  if (certificado && u.protocol === 'https:') {
    opcoes.agent = agenteParaCertificado(certificado);
  }
  const req = lib.request(opcoes, (res) => {
    const pedacos: Buffer[] = [];
    res.on('data', (p: Buffer) => pedacos.push(p));
    res.on('end', () => {
      const cabecalhos: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        cabecalhos[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v ?? '';
      }
      resolve({
        status: res.statusCode ?? 0,
        ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
        cabecalhos,
        texto: Buffer.concat(pedacos).toString('utf8'),
      });
    });
  });
  req.setTimeout(TIMEOUT_HTTP_MS, () => {
    req.destroy(new Error(`Timeout de rede (${TIMEOUT_HTTP_MS / 1000}s) em ${u.host}.`));
  });
  req.on('error', reject);
  if (init.body != null) req.write(init.body);
  req.end();
  return promise;
}

/**
 * Monta o HttpClient de um adapter: usa o cliente injetado (testes) ou o
 * default com agente mTLS quando o contexto traz certificado.
 */
export function clienteHttp(
  ctx: Pick<BankContext, 'certificado'>,
  injetado?: HttpClient,
): HttpClient {
  if (injetado) return injetado;
  return (url, init) => requisicao(url, init ?? {}, ctx.certificado);
}

/* ------------------------------------------------------------------ */
/* OAuth2 client_credentials com cache por integracaoId (expira −60 s) */
/* ------------------------------------------------------------------ */

export interface TokenConfig {
  tokenUrl: string;
  escopo?: string;
  /** 'basic' = Basic auth no header (padrão); 'corpo' = credenciais no form body. */
  autenticacao?: 'basic' | 'corpo';
  /** Headers extras obrigatórios do banco (ex. x-itau-apikey no token endpoint). */
  cabecalhosExtras?: Record<string, string>;
}

const cacheTokens = new Map<string, { token: string; expiraEm: number }>();

export function montarFormUrlencoded(campos: Record<string, string>): string {
  return Object.entries(campos)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Devolve um token em cache válido ou solicita um novo via client_credentials.
 * Cache por ctx.integracaoId, expirando em expires_in − 60 s.
 */
export async function obterTokenOAuth2(
  ctx: Pick<BankContext, 'integracaoId' | 'credenciais'>,
  cfg: TokenConfig,
  http: HttpClient,
): Promise<string> {
  const emCache = cacheTokens.get(ctx.integracaoId);
  if (emCache && emCache.expiraEm > Date.now()) return emCache.token;

  const clientId = ctx.credenciais.client_id ?? '';
  const clientSecret = ctx.credenciais.client_secret ?? '';
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais OAuth2 ausentes: client_id/client_secret não configurados.');
  }
  const corpo: Record<string, string> = { grant_type: 'client_credentials' };
  if (cfg.escopo) corpo.scope = cfg.escopo;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const cabecalhos: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(cfg.cabecalhosExtras ?? {}),
  };
  if ((cfg.autenticacao ?? 'basic') === 'basic') {
    cabecalhos.Authorization = `Basic ${basic}`;
  } else {
    corpo.client_id = clientId;
    corpo.client_secret = clientSecret;
  }
  const res = await http(cfg.tokenUrl, {
    method: 'POST',
    headers: cabecalhos,
    body: montarFormUrlencoded(corpo),
  });
  if (!res.ok) {
    // Mensagem sem corpo/credenciais — só status.
    throw new Error(`Falha ao obter token OAuth2 do banco (HTTP ${res.status}).`);
  }
  let json: { access_token?: string; expires_in?: number };
  try {
    json = JSON.parse(res.texto) as typeof json;
  } catch {
    throw new Error('Resposta OAuth2 do banco não é JSON válido.');
  }
  if (!json.access_token) {
    throw new Error(`Resposta OAuth2 do banco sem access_token (HTTP ${res.status}).`);
  }
  const ttlMs = Math.max(0, (json.expires_in ?? 300) * 1000 - 60_000);
  cacheTokens.set(ctx.integracaoId, { token: json.access_token, expiraEm: Date.now() + ttlMs });
  return json.access_token;
}

/** Limpa cache de tokens (shutdown/testes; opcionalmente só uma integração). */
export function limparCacheTokens(integracaoId?: string): void {
  if (integracaoId) cacheTokens.delete(integracaoId);
  else cacheTokens.clear();
}

/* ------------------------------------------------------------------ */
/* Sanitização de raw (segredos nunca vazam em respostas/logs)         */
/* ------------------------------------------------------------------ */

const PADRAO_SEGREDO =
  /secret|senha|password|passphrase|token|authorization|apikey|api[-_]key|pfx|credential/i;

/** Percorre o objeto e substitui valores de campos sensíveis por '[removido]'. */
export function sanitizarRaw(valor: unknown, profundidade = 0): Record<string, unknown> {
  if (profundidade > 8) return { truncado: true };
  if (valor == null || typeof valor !== 'object') return { valor: valor ?? null };
  if (Array.isArray(valor)) return { itens: valor.map((v) => sanitizarRaw(v, profundidade + 1)) };
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (PADRAO_SEGREDO.test(k)) saida[k] = '[removido]';
    else if (v != null && typeof v === 'object') saida[k] = sanitizarRaw(v, profundidade + 1);
    else saida[k] = v;
  }
  return saida;
}
