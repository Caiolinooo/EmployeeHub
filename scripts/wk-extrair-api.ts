/**
 * wk-extrair-api.ts — Extrator da RadarAPI do WK Radar (migração granular → Painel ABZ)
 *
 * Uso:  npx tsx scripts/wk-extrair-api.ts [--usuario <u>] [--senha <s>]
 *       (credenciais também via env WK_USUARIO / WK_SENHA; defaults embutidos abaixo)
 *
 * Saída: wk-export/wk-export.json (contrato compartilhado com editor/importador)
 *
 * TLS: pin SHA-256 via wkHttpsRequestJson (validação ligada). Sem fetch global.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wkHttpsRequestJson } from '../src/lib/wkradar/tls-pin';

const BASE = 'https://wk.groupabz.com/RadarAPI';
const TIMEOUT_MS = 20_000;
const PAGE_SIZE = 500;

type Json = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Credenciais: flags --usuario/--senha > env WK_USUARIO/WK_SENHA > defaults
// ---------------------------------------------------------------------------
function argOrEnv(flag: string, env: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${flag}`);
  return (idx >= 0 && process.argv[idx + 1]) || process.env[env] || fallback;
}
const USUARIO = argOrEnv('usuario', 'WK_USUARIO', 'wk');
const SENHA = argOrEnv('senha', 'WK_SENHA', 'Caio@2122@');
const EMPRESA = 'AguasBrasileiras';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function asJson(v: unknown): Json | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}

async function httpJson(
  method: 'GET' | 'POST',
  path: string,
  opts: { token?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let status: number;
  let texto: string;
  try {
    const resposta = await wkHttpsRequestJson(url.href, {
      metodo: method,
      headers,
      corpo: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      timeoutMs: TIMEOUT_MS,
    });
    status = resposta.status;
    texto = resposta.corpo;
  } catch (err) {
    const e = err as { name?: string; message?: string; cause?: { message?: string } };
    const causa = e?.name === 'TimeoutError' || e?.name === 'AbortError'
      ? `timeout de ${TIMEOUT_MS / 1000}s`
      : (e?.cause?.message ?? e?.message ?? String(err));
    throw new Error(`Falha de rede em ${method} ${path}: ${causa}`);
  }

  if (status < 200 || status >= 300) {
    throw new Error(`${method} ${path} → HTTP ${status}: ${texto.slice(0, 300)}`);
  }
  try {
    return texto ? JSON.parse(texto) : null;
  } catch {
    throw new Error(`${method} ${path} → resposta não-JSON: ${texto.slice(0, 200)}`);
  }
}

async function login(): Promise<string> {
  console.log(`Autenticando como "${USUARIO}" (empresa ${EMPRESA})...`);
  const resp = asJson(await httpJson('POST', '/v1/login', {
    body: { usuario: { username: USUARIO, password: SENHA }, empresa: EMPRESA },
  }));
  const token = resp?.token ?? resp?.Token;
  if (typeof token !== 'string' || !token) {
    throw new Error('Login sem token na resposta: ' + JSON.stringify(resp).slice(0, 300));
  }
  console.log('Login OK.');
  return token;
}

/** Busca paginada: NumPagina + QtdItens até esgotar pelo campo `paginacao`. */
async function getPaginado(token: string, path: string): Promise<Json[]> {
  const itens: Json[] = [];
  let pagina = 1;
  for (;;) {
    const resp = asJson(await httpJson('GET', path, {
      token,
      params: { NumPagina: String(pagina), QtdItens: String(PAGE_SIZE) },
    }));
    const conteudo = Array.isArray(resp?.conteudo) ? (resp.conteudo as Json[]) : [];
    itens.push(...conteudo);
    const pag = asJson(resp?.paginacao);
    console.log(`  ${path} pág.${pagina}: +${conteudo.length} (total ${pag?.totalItens ?? itens.length})`);
    if (!conteudo.length || (pag ? !pag.temProxima : conteudo.length < PAGE_SIZE)) break;
    pagina++;
  }
  return itens;
}

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------
type Coleta = { ok: boolean; dados: unknown };

/** Executa uma coleta; falha vira aviso e o lote continua. */
async function tentar(rotulo: string, fn: () => Promise<unknown>): Promise<Coleta> {
  try {
    return { ok: true, dados: await fn() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [AVISO] ${rotulo} falhou: ${msg}`);
    return { ok: false, dados: null };
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function lista(c: Coleta): Json[] {
  return c.ok && Array.isArray(c.dados) ? (c.dados as Json[]) : [];
}

async function main() {
  const token = await login();
  const hoje = new Date().toISOString().slice(0, 10);

  // --- Endpoints paginados (empresarial) ---
  const rFunc = await tentar('funcionarios', () => getPaginado(token, '/v1/cards/empresarial/funcionarios'));
  const rCC = await tentar('centrosCustos', () => getPaginado(token, '/v1/cards/empresarial/centrosCustos'));
  const rDep = await tentar('departamentosRH', () => getPaginado(token, '/v1/cards/empresarial/departamentosRH'));
  const rFil = await tentar('filiais', () => getPaginado(token, '/v1/cards/empresarial/filiais'));

  // --- Endpoints de payload único (folha/empresas) — ficam brutos por inteiro ---
  const rFerias = await tentar('ferias', () => httpJson('GET', '/v1/cards/folha/ferias', { token }));
  const rIndic = await tentar('indicadorColaboradoresDetalhado', () =>
    httpJson('GET', '/v1/cards/folha/indicadorColaboradoresDetalhado', {
      token,
      params: { PeriodoInicial: '2024-01-01', PeriodoFinal: hoje },
    }));
  const rCusto = await tentar('custofolha', () => httpJson('GET', '/v1/cards/folha/custofolha', { token }));
  const rCustoGrupos = await tentar('custofolha/grupos', () =>
    httpJson('GET', '/v1/cards/folha/custofolha/grupos', { token }));
  const rESocial = await tentar('eSocial', () => httpJson('GET', '/v1/cards/folha/eSocial', { token }));
  const rAvisos = await tentar('avisosvencimentos', () =>
    httpJson('GET', '/v1/cards/folha/avisosvencimentos', { token }));
  const rEmpresas = await tentar('empresas', () => httpJson('GET', '/v1/empresas', { token }));
  const rDataSistema = await tentar('empresas/datasistema', () =>
    httpJson('GET', '/v1/empresas/datasistema', { token }));

  // --- Normalização para o contrato wk-export.json ---
  const funcionarios = lista(rFunc).map((f) => ({
    id: num(f.id),
    codigo: String(f.codigo ?? ''),
    nome: String(f.nome ?? ''),
    departamento: str(f.departamento),
    cargo: str(f.cargo),
    _raw: f,
  }));

  const centrosCusto = lista(rCC).map((c) => ({
    id: num(c.id),
    codigo: String(c.codigo ?? ''),
    nome: String(c.nome ?? ''),
    _raw: c,
  }));

  const departamentosRH = lista(rDep).map((d) => ({
    id: num(d.id),
    codigo: String(d.codigo ?? ''),
    nome: String(d.descricao ?? d.nome ?? ''),
    _raw: d,
  }));

  const filiais = lista(rFil).map((f) => ({
    id: num(f.id),
    codigo: String(f.codigo ?? ''),
    nome: String(f.nome ?? f.descricao ?? ''),
    _raw: f,
  }));

  const bruto = (c: Coleta) => (c.ok ? c.dados : null);

  const exportJson = {
    geradoEm: new Date().toISOString(),
    fonte: 'RadarAPI v1',
    empresa: EMPRESA,
    funcionarios,
    centrosCusto,
    departamentosRH,
    filiais,
    ferias: bruto(rFerias),
    indicadorColaboradores: bruto(rIndic),
    custoFolha: bruto(rCusto),
    custoFolhaGrupos: bruto(rCustoGrupos),
    eSocial: bruto(rESocial),
    avisosVencimentos: bruto(rAvisos),
    empresas: bruto(rEmpresas),
    dataSistema: bruto(rDataSistema),
  };

  mkdirSync('wk-export', { recursive: true });
  const destino = join('wk-export', 'wk-export.json');
  writeFileSync(destino, JSON.stringify(exportJson, null, 2), 'utf-8');

  // --- Resumo ---
  const marcador = (c: Coleta) => (c.ok ? 'OK (bruto)' : 'FALHOU');
  console.log('\n===== RESUMO DA EXTRAÇÃO =====');
  console.log(`funcionarios:            ${funcionarios.length}`);
  console.log(`centrosCusto:            ${centrosCusto.length}`);
  console.log(`departamentosRH:         ${departamentosRH.length}`);
  console.log(`filiais:                 ${filiais.length}`);
  console.log(`ferias:                  ${marcador(rFerias)}`);
  console.log(`indicadorColaboradores:  ${marcador(rIndic)}`);
  console.log(`custoFolha:              ${marcador(rCusto)}`);
  console.log(`custoFolhaGrupos:        ${marcador(rCustoGrupos)}`);
  console.log(`eSocial:                 ${marcador(rESocial)}`);
  console.log(`avisosVencimentos:       ${marcador(rAvisos)}`);
  console.log(`empresas:                ${rEmpresas.ok ? 'OK' : 'FALHOU'}`);
  console.log(`dataSistema:             ${rDataSistema.ok ? JSON.stringify(rDataSistema.dados) : 'FALHOU'}`);
  console.log(`Arquivo gravado: ${destino}`);

  if (funcionarios.length > 0) {
    console.log('WK_EXTRACAO_OK');
  } else {
    console.error('ERRO: nenhum funcionário extraído.');
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error('FALHA FATAL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
