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
import { trimTrailingChar, wkHttpsRequestJson } from './tls-pin';

/**
 * HTTPS da RadarAPI: validação LIGADA + pin SHA-256 (CN=WKSistemas).
 * Ver src/lib/wkradar/AGENTS.md.
 */
function wkRequestJson(
  destino: string,
  opcoes: { metodo: 'GET' | 'POST'; headers: Record<string, string>; corpo?: string; timeoutMs: number },
): Promise<{ status: number; corpo: string }> {
  return wkHttpsRequestJson(destino, opcoes);
}

/** Chaves de credencial em app_secrets (mesmo formato que getCredential consome). */
export const WK_URL_CREDENTIAL_KEY = 'wkradar_api_url';
export const WK_TOKEN_CREDENTIAL_KEY = 'wkradar_api_token';
/** Login da RadarAPI (POST {url}/login → JWT de 12h). Preferidos ao token estático. */
export const WK_USUARIO_CREDENTIAL_KEY = 'wkradar_api_usuario';
export const WK_SENHA_CREDENTIAL_KEY = 'wkradar_api_senha';
export const WK_EMPRESA_CREDENTIAL_KEY = 'wkradar_api_empresa';

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
 * VERIFICADO ao vivo em 2026-09-21 contra wk.groupabz.com (swagger 370
 * endpoints em scripts/_tmp_wk_swagger.json; extração real com 768
 * funcionários). RadarAPI é pull-only: só GETs de cards/dashboard.
 */
export const WK_PULL_PATHS: RegExp[] = [
  /^\/cards\/empresarial\/funcionarios\/?$/i,
  /^\/cards\/empresarial\/funcionarios\/existe\/?$/i,
  /^\/cards\/empresarial\/centroscustos\/?$/i,
  /^\/cards\/empresarial\/departamentosrh\/?$/i,
  /^\/cards\/empresarial\/filiais\/?$/i,
  /^\/cards\/folha\/ferias\/?$/i,
  /^\/cards\/folha\/esocial\/?$/i,
  /^\/cards\/folha\/esocial\/detalhado\/?$/i,
  /^\/cards\/folha\/custofolha\/?$/i,
  /^\/cards\/folha\/custofolha\/grupos\/?$/i,
  /^\/cards\/folha\/indicadorcolaboradores(detalhado)?\/?$/i,
  /^\/empresas\/?$/i,
  /^\/empresas\/datasistema\/?$/i,
];

/**
 * Endpoint de funcionários — VERIFICADO: GET /v1/cards/empresarial/funcionarios
 * paginado (NumPagina/QtdItens; envelope DadosConsultaFuncionario com
 * paginacao.temProxima) e cada item com id/codigo/nome/departamento/cargo.
 */
export const WK_CANDIDATOS_FUNCIONARIOS = ['/cards/empresarial/funcionarios'];

/**
 * A RadarAPI NÃO expõe lançamentos por funcionário (custofolha é agregado por
 * local de trabalho). O caminho detalhado continua sendo o backup via arquivo.
 * Candidato mantido só para o sync logar aviso claro em vez de 404.
 */
export const WK_CANDIDATOS_LANCAMENTOS = ['/cards/folha/custofolha/grupos'];

export interface WkCredenciais {
  url: string;
  token: string;
}

interface WkLogin {
  usuario: string;
  senha: string;
  empresa: string;
}

/** JWT em cache com expiração (a RadarAPI emite 12h; renovamos com 1h de folga). */
let cacheLogin: { token: string; expiraEm: number } | null = null;
const WK_TOKEN_TTL_MS = 11 * 60 * 60 * 1000;

/**
 * Autentica na RadarAPI: POST {url}/login com {usuario:{username,password},
 * empresa} → {token}. Só é chamado quando não há wkradar_api_token estático.
 */
async function logarWk(urlBase: string, login: WkLogin): Promise<string> {
  const agora = Date.now();
  if (cacheLogin && cacheLogin.expiraEm > agora) return cacheLogin.token;

  const { status, corpo } = await wkRequestJson(`${urlBase}/login`, {
    metodo: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    corpo: JSON.stringify({
      usuario: { username: login.usuario, password: login.senha },
      empresa: login.empresa,
    }),
    timeoutMs: WK_TIMEOUT_MS,
  });
  if (status < 200 || status >= 300) {
    throw new Error(`[WK] Login RadarAPI HTTP ${status} — confira wkradar_api_usuario/senha/empresa em /api/dp/wk/credentials.`);
  }
  const parsed = JSON.parse(corpo) as { token?: string };
  if (!parsed.token) throw new Error('[WK] Login RadarAPI sem token na resposta.');
  cacheLogin = { token: parsed.token, expiraEm: agora + WK_TOKEN_TTL_MS };
  return parsed.token;
}

export function invalidarSessaoWk(): void {
  cacheLogin = null;
}

/** Lê credenciais + resolve o Bearer (token estático ou login). */
async function autenticarWk(): Promise<{ url: string; token: string; estatico: boolean }> {
  const [urlCrua, tokenEstatico, usuario, senha, empresa] = await Promise.all([
    getCredential(WK_URL_CREDENTIAL_KEY),
    getCredential(WK_TOKEN_CREDENTIAL_KEY),
    getCredential(WK_USUARIO_CREDENTIAL_KEY),
    getCredential(WK_SENHA_CREDENTIAL_KEY),
    getCredential(WK_EMPRESA_CREDENTIAL_KEY),
  ]);
  if (!urlCrua) throw new ErroWkCredencial();
  const url = trimTrailingChar(urlCrua.trim(), '/');

  if (tokenEstatico) return { url, token: tokenEstatico.trim(), estatico: true };
  if (usuario && senha) {
    const token = await logarWk(url, {
      usuario: usuario.trim(),
      senha: senha.trim(),
      empresa: (empresa || '').trim(),
    });
    return { url, token, estatico: false };
  }
  throw new ErroWkCredencial();
}

/** Lê as credenciais da Radar.API (url obrigatória; Bearer via login ou token
 * estático). Sem nada disso → ErroWkCredencial. */
export async function carregarCredenciaisWk(): Promise<WkCredenciais> {
  const auth = await autenticarWk();
  return { url: auth.url, token: auth.token };
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

  const auth = await autenticarWk();

  const qs = new URLSearchParams();
  for (const [chave, valor] of Object.entries(opcoes?.query || {})) {
    if (valor === undefined || valor === null || valor === '') continue;
    qs.set(chave, String(valor));
  }
  const destino = `${auth.url}${normalizado}${qs.toString() ? `?${qs.toString()}` : ''}`;

  await agendarVezThrottle();

  const pedir = (token: string) =>
    wkRequestJson(destino, {
      metodo: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeoutMs: WK_TIMEOUT_MS,
    });

  let resposta = await pedir(auth.token);
  if (resposta.status === 401 && !auth.estatico) {
    // JWT expirado no meio da janela: renova e tenta UMA vez.
    invalidarSessaoWk();
    const nova = await autenticarWk();
    resposta = await pedir(nova.token);
  }
  if (resposta.status < 200 || resposta.status >= 300) {
    throw new Error(
      `[WK] Radar.API respondeu HTTP ${resposta.status} para GET ${normalizado}`,
    );
  }
  return JSON.parse(resposta.corpo) as T;
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
    for (const chave of ['data', 'items', 'rows', 'result', 'results', 'records', 'lista', 'conteudo']) {
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

/**
 * GET paginado nos endpoints de consulta da RadarAPI (envelope
 * DadosConsulta*: { cabecalho, paginacao: { paginaAtual, temProxima, ... },
 * conteudo: [...] }). Percorre NumPagina até esgotar (teto de segurança
 * `maxPaginas`) e devolve o conteúdo concatenado. Endpoint sem paginação
 * (array cru) devolve direto — tolerante.
 */
export async function wkGetPaginado<T = Record<string, unknown>>(
  path: string,
  opcoes?: WkGetOpcoes & { qtdItens?: number; maxPaginas?: number },
): Promise<T[]> {
  const qtdItens = opcoes?.qtdItens ?? 500;
  const maxPaginas = opcoes?.maxPaginas ?? 40;
  const todas: T[] = [];

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const json = await wkGet<unknown>(path, {
      ...opcoes,
      query: { ...opcoes?.query, NumPagina: pagina, QtdItens: qtdItens },
    });
    if (Array.isArray(json)) {
      todas.push(...(json as T[]));
      return todas;
    }
    const conteudo = (json as { conteudo?: T[] }).conteudo;
    if (!Array.isArray(conteudo)) {
      // Envelope inesperado: cai no extrator genérico e encerra.
      todas.push(...extrairListaWk<T>(json));
      return todas;
    }
    todas.push(...conteudo);
    const paginacao = (json as { paginacao?: { temProxima?: boolean; paginaAtual?: number } })
      .paginacao;
    if (!paginacao?.temProxima) return todas;
  }
  return todas;
}
