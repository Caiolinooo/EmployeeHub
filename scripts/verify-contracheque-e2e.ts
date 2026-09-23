/**
 * Gate E2E do contracheque do funcionário (design §7) — chama os HANDLERS
 * REAIS das rotas /api/contracheque/** com NextRequest montado, padrão
 * scripts/verify-codes-crud.ts:
 *   - fixtures via service_role (empresa/funcionário/folha approved/itens/
 *     resumo + 2 usuários users_unified);
 *   - usuário dono simulado por JWT assinado com JWT_SECRET do .env.local
 *     (header Authorization: Bearer — mesmo mecanismo de auth da rota,
 *     verifyToken de src/lib/auth.ts; é o "header interno de teste": só existe
 *     no script, nenhum backdoor na rota);
 *   - usuário NÃO-dono (outro CPF) prova o 403.
 *
 * Contrato testado:
 *   GET  /api/contracheque                — lista competências approved/paid
 *        do próprio usuário + flag aceito_em;
 *   GET  /api/contracheque/[sheetId]      — HTML do holerite (dono);
 *   GET  /api/contracheque/[sheetId]?pdf=1 — PDF nativo (%PDF-, bytes > 0);
 *   POST /api/contracheque/[sheetId]/aceite — grava aceite c/ hash SHA-256,
 *        idempotente (2º POST → 200 com o existente);
 *   403  — viewer/aceite para usuário sem vínculo (CPF) com a sheet.
 *
 * Fixtures dedicadas (empresa 'E2E Contracheque Fixture', CNPJ
 * '00.000.000/0002-88', e-mails e2e-contracheque*@fixture.local, competência
 * 09/2099) — limpas ao iniciar e ao final.
 *
 * Uso: npx tsx scripts/verify-contracheque-e2e.ts  → CONTRACHEQUE_E2E_OK
 */
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const EMPRESA_CNPJ = '00.000.000/0002-88';
const EMPRESA_NOME = 'E2E Contracheque Fixture';
const COMPETENCIA = { mes: 9, ano: 2099 }; // isolada (mod-internos 11/2099; dp-wk 12/2099)
const CPF_DONO = '11144477735';
// Não-dono: CPF único por execução (timestamp) — nunca casa com
// payroll_employees real/fixture (ex.: '52998224725' é do fixture financeiro).
const CPF_OUTRO = `996${String(Date.now()).slice(-7)}1`; // 11 dígitos
const EMAIL_DONO = 'e2e-contracheque@fixture.local';
const EMAIL_OUTRO = 'e2e-contracheque-outro@fixture.local';

interface RotaLista {
  GET?: (request: NextRequest) => Promise<Response>;
}
interface RotaViewer {
  GET?: (request: NextRequest, ctx: { params: Promise<{ sheetId: string }> }) => Promise<Response>;
}
interface RotaAceite {
  POST?: (request: NextRequest, ctx: { params: Promise<{ sheetId: string }> }) => Promise<Response>;
}

function falhar(msg: string): never {
  console.error(`CONTRACHEQUE_E2E_FAIL: ${msg}`);
  process.exit(1);
}

function loadEnvFiles(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of ['.env.local', '.env', '.env.production']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!env[m[1]] && val) env[m[1]] = val;
    }
  }
  return env;
}

const env = loadEnvFiles();
// IMPORTANTE: process.env precisa estar pronto ANTES do import dinâmico das
// rotas — '@/lib/supabase' constrói o supabaseAdmin no escopo do módulo.
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const supabase: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

/** JWT no formato de src/lib/auth.ts generateToken (mesmo JWT_SECRET/fallback). */
function tokenDe(userId: string, email: string): string {
  return jwt.sign(
    { userId, role: 'USER', email },
    process.env.JWT_SECRET?.trim() || 'dev-only-jwt-secret-not-for-production',
    { expiresIn: '1h' },
  );
}

function requisicao(method: 'GET' | 'POST', url: string, token: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'user-agent': 'verify-contracheque-e2e' },
  });
}

async function limparFixtures(): Promise<void> {
  const { data: empresa } = await supabase
    .from('payroll_companies')
    .select('id')
    .eq('cnpj', EMPRESA_CNPJ)
    .maybeSingle();
  if (empresa) {
    const empresaId = (empresa as { id: string }).id;
    const { data: sheets } = await supabase.from('payroll_sheets').select('id').eq('company_id', empresaId);
    const sheetIds = ((sheets || []) as { id: string }[]).map((s) => s.id);
    for (const s of sheetIds) {
      await supabase.from('payroll_contracheque_aceites').delete().eq('sheet_id', s);
      await supabase.from('payroll_employee_summaries').delete().eq('sheet_id', s);
      await supabase.from('payroll_sheet_items').delete().eq('sheet_id', s);
    }
    await supabase.from('payroll_sheets').delete().eq('company_id', empresaId);
    await supabase.from('payroll_employees').delete().eq('company_id', empresaId);
    await supabase.from('payroll_companies').delete().eq('id', empresaId);
  }
  await supabase.from('users_unified').delete().in('email', [EMAIL_DONO, EMAIL_OUTRO]);
}

async function main(): Promise<void> {
  console.log('=== verify-contracheque-e2e — viewer/aceite/PDF via handlers reais ===');

  await limparFixtures();

  // ---------- 1. fixtures ----------
  const { data: empresa, error: errEmpresa } = await supabase
    .from('payroll_companies')
    .insert({ name: EMPRESA_NOME, cnpj: EMPRESA_CNPJ })
    .select('id')
    .single();
  if (errEmpresa) falhar(`fixture empresa: ${errEmpresa.message}`);
  const empresaId = (empresa as { id: string }).id;

  const { data: employee, error: errEmp } = await supabase
    .from('payroll_employees')
    .insert({ company_id: empresaId, name: 'Funcionária E2E Contracheque', cpf: CPF_DONO, base_salary: 9000, status: 'active' })
    .select('id')
    .single();
  if (errEmp) falhar(`fixture employee: ${errEmp.message}`);
  const employeeId = (employee as { id: string }).id;

  const { data: userDono, error: errUser } = await supabase
    .from('users_unified')
    .insert({ email: EMAIL_DONO, first_name: 'E2E', last_name: 'Contracheque', role: 'USER', tax_id: CPF_DONO })
    .select('id')
    .single();
  if (errUser) falhar(`fixture usuário dono: ${errUser.message}`);
  const userDonoId = (userDono as { id: string }).id;

  const { data: userOutro, error: errOutro } = await supabase
    .from('users_unified')
    .insert({ email: EMAIL_OUTRO, first_name: 'E2E', last_name: 'Outro', role: 'USER', tax_id: CPF_OUTRO })
    .select('id')
    .single();
  if (errOutro) falhar(`fixture usuário não-dono: ${errOutro.message}`);
  const userOutroId = (userOutro as { id: string }).id;

  const { data: sheet, error: errSheet } = await supabase
    .from('payroll_sheets')
    .insert({
      company_id: empresaId,
      reference_month: COMPETENCIA.mes,
      reference_year: COMPETENCIA.ano,
      period_start: `${COMPETENCIA.ano}-09-01`,
      period_end: `${COMPETENCIA.ano}-09-30`,
      status: 'approved',
      total_employees: 1,
      total_gross: 10000,
      total_deductions: 1200,
      total_net: 8800,
    })
    .select('id')
    .single();
  if (errSheet) falhar(`fixture sheet: ${errSheet.message}`);
  const sheetId = (sheet as { id: string }).id;

  // Rubricas do seed canônico (001 provento / 104 desconto).
  const { data: codes, error: errCodes } = await supabase
    .from('payroll_codes')
    .select('id, code, type')
    .in('code', ['001', '104']);
  if (errCodes || !codes || codes.length < 2) falhar('payroll_codes 001/104 ausentes — rode a migration 20260921_000001');
  const codePorCodigo = new Map((codes as { id: string; code: string }[]).map((c) => [c.code, c.id]));

  const { error: errItems } = await supabase.from('payroll_sheet_items').insert([
    { sheet_id: sheetId, employee_id: employeeId, code_id: codePorCodigo.get('001'), quantity: 30, reference_value: 300, calculated_value: 10000, origem: 'manual' },
    { sheet_id: sheetId, employee_id: employeeId, code_id: codePorCodigo.get('104'), quantity: 1, reference_value: 10000, calculated_value: 1200, origem: 'manual' },
  ]);
  if (errItems) falhar(`fixture itens: ${errItems.message}`);

  const { error: errSummary } = await supabase.from('payroll_employee_summaries').insert({
    sheet_id: sheetId,
    employee_id: employeeId,
    base_salary: 9000,
    total_earnings: 10000,
    total_deductions: 1200,
    gross_salary: 10000,
    net_salary: 8800,
    inss_base: 10000,
    irrf_base: 8800,
    fgts_base: 10000,
    inss_value: 800,
    irrf_value: 400,
    fgts_value: 800,
  });
  if (errSummary) falhar(`fixture summary: ${errSummary.message}`);
  console.log(`Fixtures: empresa ${empresaId} · sheet ${sheetId} (approved 09/2099) · employee ${employeeId}`);

  try {
    // ---------- 2. rotas (handlers reais) ----------
    // import() dinâmico INTENCIONAL (fronteira de teste): as rotas constroem
    // supabaseAdmin no escopo do módulo a partir de process.env — import
    // estático as carregaria ANTES do loadEnvFiles acima.
    const rotaLista = (await import('../src/app/api/contracheque/route')) as unknown as RotaLista;
    const rotaViewer = (await import('../src/app/api/contracheque/[sheetId]/route')) as unknown as RotaViewer;
    const rotaAceite = (await import('../src/app/api/contracheque/[sheetId]/aceite/route')) as unknown as RotaAceite;
    if (typeof rotaLista.GET !== 'function' || typeof rotaViewer.GET !== 'function' || typeof rotaAceite.POST !== 'function') {
      falhar('rotas /api/contracheque/** não expõem os handlers esperados (GET lista, GET viewer, POST aceite)');
    }
    const ctx = { params: Promise.resolve({ sheetId }) };
    const tokenDono = tokenDe(userDonoId, EMAIL_DONO);
    const tokenOutro = tokenDe(userOutroId, EMAIL_OUTRO);

    // ---------- 3. GET lista (dono) ----------
    const resLista = await rotaLista.GET(requisicao('GET', '/api/contracheque', tokenDono));
    const jsonLista = await resLista.json();
    if (resLista.status !== 200 || !jsonLista.success) falhar(`lista: HTTP ${resLista.status} — ${JSON.stringify(jsonLista)}`);
    const item = (jsonLista.data as Array<Record<string, unknown>>).find((c) => c.sheet_id === sheetId);
    if (!item) falhar('lista não contém a sheet fixture');
    if (item.competencia !== '09/2099') falhar(`competencia esperada 09/2099, veio ${item.competencia}`);
    if ((item.empresa as { nome: string }).nome !== EMPRESA_NOME) falhar('empresa divergente na lista');
    if (item.aceito_em !== null) falhar('aceito_em deveria ser null antes do aceite');
    console.log('GET lista (dono): OK — 1 competência, aceito_em null');

    // ---------- 4. GET viewer HTML (dono) ----------
    const resHtml = await rotaViewer.GET(requisicao('GET', `/api/contracheque/${sheetId}`, tokenDono), ctx);
    const html = await resHtml.text();
    if (resHtml.status !== 200) falhar(`viewer HTML: HTTP ${resHtml.status}`);
    if (!(resHtml.headers.get('content-type') || '').includes('text/html')) falhar('viewer: content-type não é text/html');
    if (!html.includes('Funcionária E2E Contracheque')) falhar('viewer: HTML sem o nome do funcionário');
    console.log(`GET viewer HTML (dono): OK — ${html.length} bytes`);

    // ---------- 5. GET viewer PDF (dono) ----------
    const resPdf = await rotaViewer.GET(requisicao('GET', `/api/contracheque/${sheetId}?pdf=1`, tokenDono), ctx);
    const pdfBuf = Buffer.from(await resPdf.arrayBuffer());
    if (resPdf.status !== 200) falhar(`viewer PDF: HTTP ${resPdf.status}`);
    if ((resPdf.headers.get('content-type') || '') !== 'application/pdf') falhar('viewer: content-type não é application/pdf');
    if (pdfBuf.length === 0 || pdfBuf.subarray(0, 5).toString() !== '%PDF-') falhar('PDF inválido (sem magic %PDF-)');
    console.log(`GET viewer PDF (dono): OK — ${pdfBuf.length} bytes, %PDF-`);

    // ---------- 6. POST aceite (dono) + idempotência ----------
    const resAceite = await rotaAceite.POST(requisicao('POST', `/api/contracheque/${sheetId}/aceite`, tokenDono), ctx);
    const jsonAceite = await resAceite.json();
    if (resAceite.status !== 200 || !jsonAceite.success) falhar(`aceite: HTTP ${resAceite.status} — ${JSON.stringify(jsonAceite)}`);
    const hash = jsonAceite.data.assinatura_hash as string;
    if (!/^[0-9a-f]{64}$/.test(hash)) falhar(`assinatura_hash não é SHA-256 hex: ${hash}`);
    if (jsonAceite.data.ja_aceito !== false) falhar('1º aceite deveria ter ja_aceito=false');
    console.log(`POST aceite (dono): OK — hash ${hash.slice(0, 12)}…`);

    const resAceite2 = await rotaAceite.POST(requisicao('POST', `/api/contracheque/${sheetId}/aceite`, tokenDono), ctx);
    const jsonAceite2 = await resAceite2.json();
    if (resAceite2.status !== 200 || !jsonAceite2.success) falhar(`aceite idempotente: HTTP ${resAceite2.status}`);
    if (jsonAceite2.data.ja_aceito !== true) falhar('2º aceite deveria ter ja_aceito=true');
    if (jsonAceite2.data.aceito_em !== jsonAceite.data.aceito_em) falhar('2º aceite mudou aceito_em (não idempotente)');
    console.log('POST aceite (dono, 2ª vez): OK — idempotente, mesmo registro');

    // ---------- 7. lista reflete o aceite ----------
    const resLista2 = await rotaLista.GET(requisicao('GET', '/api/contracheque', tokenDono));
    const jsonLista2 = await resLista2.json();
    const item2 = (jsonLista2.data as Array<Record<string, unknown>>).find((c) => c.sheet_id === sheetId);
    if (!item2?.aceito_em) falhar('lista não reflete aceito_em após o aceite');
    console.log('GET lista pós-aceite: OK — aceito_em preenchido');

    // ---------- 8. 403 para não-dono ----------
    const resHtmlOutro = await rotaViewer.GET(requisicao('GET', `/api/contracheque/${sheetId}`, tokenOutro), ctx);
    if (resHtmlOutro.status !== 403) falhar(`viewer não-dono: esperado 403, veio ${resHtmlOutro.status}`);
    const resPdfOutro = await rotaViewer.GET(requisicao('GET', `/api/contracheque/${sheetId}?pdf=1`, tokenOutro), ctx);
    if (resPdfOutro.status !== 403) falhar(`pdf não-dono: esperado 403, veio ${resPdfOutro.status}`);
    const resAceiteOutro = await rotaAceite.POST(requisicao('POST', `/api/contracheque/${sheetId}/aceite`, tokenOutro), ctx);
    if (resAceiteOutro.status !== 403) falhar(`aceite não-dono: esperado 403, veio ${resAceiteOutro.status}`);
    const resListaOutro = await rotaLista.GET(requisicao('GET', '/api/contracheque', tokenOutro));
    const jsonListaOutro = await resListaOutro.json();
    if (resListaOutro.status !== 200 || (jsonListaOutro.data as unknown[]).length !== 0) {
      falhar('lista do não-dono deveria ser 200 vazia');
    }
    console.log('Não-dono: OK — 403 no viewer/PDF/aceite, lista vazia');

    console.log('\nCONTRACHEQUE_E2E_OK');
  } finally {
    await limparFixtures();
    console.log('Fixtures removidas.');
  }
}

main().catch((e) => {
  console.error('CONTRACHEQUE_E2E_FAIL:', e);
  process.exit(1);
});
