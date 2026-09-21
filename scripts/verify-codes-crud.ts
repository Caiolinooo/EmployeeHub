/**
 * Gate — valida o CRUD de rubricas (src/app/api/payroll/codes/[id]/route.ts)
 * chamando os HANDLERS REAIS com NextRequest montado e token ADMIN assinado
 * com JWT_SECRET do .env.local (mesmo mecanismo do gate garantirNivelPayroll).
 *
 * Contrato testado:
 *   PUT  /api/payroll/codes/[id]  — edita name/description/calculation_type/
 *         value/legal_type/is_active/codigo_wk; `code`+`type` imutáveis quando
 *         há itens em payroll_sheet_items → 409.
 *   DELETE /api/payroll/codes/[id] — soft delete SEMPRE (is_active=false),
 *         linha intacta (histórico de itens referencia codes).
 *   Resposta { success, data, error }.
 *
 * Registros de teste: código 'VCR*' + sheet 10/2099 — removidos ao final.
 * Se a rota do agente Rubricas ainda não existir → PENDENTE (exit 0).
 *
 * Uso: npx tsx scripts/verify-codes-crud.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ROUTE_PATH = path.join(process.cwd(), 'src/app/api/payroll/codes/[id]/route.ts');
const COMPETENCIA = { mes: 10, ano: 2099 }; // isolada (mod-internos 11/2099; dp-wk 12/2099)
// Limites reais do banco: payroll_codes.code é varchar(10); payroll_employees
// .cpf varchar(14) — identificadores curtos, CPF de 11 dígitos.
const stampDigitos = String(Date.now()).slice(-7);
const codigoTeste = `V${stampDigitos}`; // 8 chars
const matriculaTeste = `VC${stampDigitos}`; // 9 chars
const cpfTeste = `996${stampDigitos}1`; // 11 dígitos

interface RouteModule {
  PUT?: (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  DELETE?: (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
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
// IMPORTANTE: process.env precisa estar pronto ANTES do import dinâmico da rota
// — '@/lib/supabase' constrói o supabaseAdmin no escopo do módulo.
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const supabase: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

let total = 0;
let falhas = 0;

function check(nome: string, obtido: unknown, esperado: unknown): void {
  total += 1;
  const ok = obtido === esperado;
  if (!ok) falhas += 1;
  console.log(`  ${ok ? 'OK  ' : 'FALHA'} ${nome} | obtido=${JSON.stringify(obtido) ?? 'undefined'} esperado=${JSON.stringify(esperado) ?? 'undefined'}`);
}

function requisicao(method: 'PUT' | 'DELETE', id: string, corpo?: unknown): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    // Token ADMIN no mesmo formato do gate (payroll-auth: role uppercase ADMIN → sempre ok).
    authorization: `Bearer ${jwt.sign(
      { userId: 'verify-codes-crud', role: 'ADMIN', email: 'verify-codes-crud@teste.local' },
      process.env.JWT_SECRET?.trim() || 'dev-only-jwt-secret-not-for-production',
      { expiresIn: '1h' },
    )}`,
  };
  return new NextRequest(`http://localhost/api/payroll/codes/${id}`, {
    method,
    headers,
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
}

/** Invoca o handler aceitando assinatura Next 15 (params Promise) e 14 (objeto). */
async function chamarHandler(
  handler: (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>,
  method: 'PUT' | 'DELETE',
  id: string,
  corpo?: unknown,
): Promise<Response> {
  try {
    return await handler(requisicao(method, id, corpo), { params: Promise.resolve({ id }) });
  } catch {
    // Assinatura Next 14: params síncrono disfarçado de thenable.
    const params = Object.assign({ id }, {
      then: (res: (v: { id: string }) => void) => res({ id }),
    });
    return handler(requisicao(method, id, corpo), { params: params as unknown as Promise<{ id: string }> });
  }
}

async function main(): Promise<void> {
  console.log('=== verify-codes-crud — CRUD de rubricas via handlers reais ===');

  if (!fs.existsSync(ROUTE_PATH)) {
    console.log('\nPENDENTE: src/app/api/payroll/codes/[id]/route.ts não existe ainda.');
    console.log('Contrato esperado: PUT edita campos (code+type imutáveis com itens → 409); DELETE = soft delete is_active=false.');
    console.log('Script escrito contra o contrato — rodar novamente quando o agente Rubricas entregar.');
    return;
  }

  // Import dinâmico intencional: env precisa estar em process.env antes do
  // módulo (supabaseAdmin no escopo) e a rota é entregue por agente irmão.
  const rota = (await import('../src/app/api/payroll/codes/[id]/route')) as unknown as RouteModule;
  if (typeof rota.PUT !== 'function' || typeof rota.DELETE !== 'function') {
    console.log('\nPENDENTE: route.ts existe mas não expõe PUT/DELETE (contrato divergente).');
    return;
  }

  let codeId: string | null = null;
  let sheetId: string | null = null;
  let itemId: string | null = null;
  let empId: string | null = null;
  try {
    // ---- Fixture -------------------------------------------------------
    const { data: companies } = await supabase
      .from('payroll_companies')
      .select('id')
      .eq('is_active', true)
      .order('created_at')
      .limit(1);
    if (!companies || companies.length === 0) throw new Error('Nenhuma payroll_companies ativa — rode o seed.');
    const companyId = companies[0].id as string;

    const { data: code, error: errCode } = await supabase
      .from('payroll_codes')
      .insert({
        code: codigoTeste,
        type: 'desconto',
        name: 'Rubrica Verify CRUD',
        description: 'criada por scripts/verify-codes-crud.ts',
        calculation_type: 'fixed',
        value: 10,
        is_active: true,
      })
      .select('id')
      .single();
    if (errCode) throw new Error(`insert payroll_codes: ${errCode.message}`);
    const idDaRubrica: string = code!.id;
    codeId = idDaRubrica;

    // Employee + sheet + item para travar code+type (regra do 409).
    const { data: emp, error: errEmp } = await supabase
      .from('payroll_employees')
      .insert({
        company_id: companyId,
        registration_number: matriculaTeste,
        name: 'VERIFY CODES CRUD',
        cpf: cpfTeste,
        base_salary: 1000,
        admission_date: '2024-01-01',
        status: 'active',
      })
      .select('id')
      .single();
    if (errEmp) throw new Error(`insert payroll_employees: ${errEmp.message}`);
    empId = emp!.id;

    const { data: sheet, error: errSheet } = await supabase
      .from('payroll_sheets')
      .insert({
        company_id: companyId,
        reference_month: COMPETENCIA.mes,
        reference_year: COMPETENCIA.ano,
        period_start: `${COMPETENCIA.ano}-${String(COMPETENCIA.mes).padStart(2, '0')}-01`,
        period_end: `${COMPETENCIA.ano}-${String(COMPETENCIA.mes).padStart(2, '0')}-28`,
        status: 'draft',
        notes: 'verify-codes-crud',
      })
      .select('id')
      .single();
    if (errSheet) throw new Error(`insert payroll_sheets: ${errSheet.message}`);
    sheetId = sheet!.id;

    const { data: item, error: errItem } = await supabase
      .from('payroll_sheet_items')
      .insert({
        sheet_id: sheetId,
        employee_id: empId,
        code_id: codeId,
        quantity: 1,
        reference_value: 10,
        calculated_value: 10,
        origem: 'manual',
        observation: 'verify-codes-crud',
      })
      .select('id')
      .single();
    if (errItem) throw new Error(`insert payroll_sheet_items: ${errItem.message}`);
    itemId = item!.id;

    // ---- 1) PUT edita name + codigo_wk ----------------------------------
    console.log('\n----- 1) PUT edita name/codigo_wk -----');
    const novoWk = `W${stampDigitos}`; // 8 chars, cabe em codigo_wk
    const res1 = await chamarHandler(rota.PUT, 'PUT', idDaRubrica, { name: 'Rubrica Verify CRUD v2', codigo_wk: novoWk });
    const json1 = (await res1.json().catch(() => ({}))) as { success?: boolean; error?: unknown };
    check('1.1 status 200', res1.status, 200);
    check('1.2 success=true', json1.success, true);
    const { data: aposPut1 } = await supabase
      .from('payroll_codes')
      .select('name, codigo_wk')
      .eq('id', codeId)
      .single();
    check('1.3 name refletido no banco', aposPut1?.name, 'Rubrica Verify CRUD v2');
    check('1.4 codigo_wk refletido no banco', aposPut1?.codigo_wk, novoWk);

    // ---- 2) PUT trocando code+type COM item lançado → 409 ----------------
    console.log('\n----- 2) PUT code+type com itens lançados → 409 -----');
    const res2 = await chamarHandler(rota.PUT, 'PUT', idDaRubrica, { code: 'VCRX', type: 'provento' });
    const json2 = (await res2.json().catch(() => ({}))) as { success?: boolean; error?: unknown };
    check('2.1 status 409', res2.status, 409);
    check('2.2 success=false', json2.success, false);
    const { data: aposPut2 } = await supabase
      .from('payroll_codes')
      .select('code, type, name')
      .eq('id', codeId)
      .single();
    check('2.3 chave intacta no banco', `${aposPut2?.code}:${aposPut2?.type}`, `${codigoTeste}:desconto`);
    check('2.4 name não regrediu (PATCH semântico)', aposPut2?.name, 'Rubrica Verify CRUD v2');

    // ---- 3) DELETE = soft delete -----------------------------------------
    console.log('\n----- 3) DELETE desativa sem apagar -----');
    const res3 = await chamarHandler(rota.DELETE, 'DELETE', idDaRubrica);
    const json3 = (await res3.json().catch(() => ({}))) as { success?: boolean; error?: unknown };
    check('3.1 status 200', res3.status, 200);
    check('3.2 success=true', json3.success, true);
    const { data: aposDelete } = await supabase
      .from('payroll_codes')
      .select('is_active, name, codigo_wk')
      .eq('id', codeId)
      .single();
    check('3.3 is_active=false', aposDelete?.is_active, false);
    check('3.4 linha intacta (histórico preservado)', aposDelete?.name !== undefined, true);

    // Reativa para documentar comportamento reversível? Não — limpeza remove tudo.
  } finally {
    console.log('\n----- Limpeza -----');
    if (itemId) await supabase.from('payroll_sheet_items').delete().eq('id', itemId);
    if (sheetId) {
      await supabase.from('payroll_employee_summaries').delete().eq('sheet_id', sheetId);
      await supabase.from('payroll_sheets').delete().eq('id', sheetId);
    }
    if (empId) await supabase.from('payroll_employees').delete().eq('id', empId);
    if (codeId) {
      await supabase.from('payroll_audit_log').delete().eq('table_name', 'payroll_codes').eq('record_id', codeId);
      await supabase.from('payroll_codes').delete().eq('id', codeId);
    }
    const { count: sobraCode } = await supabase
      .from('payroll_codes')
      .select('id', { count: 'exact', head: true })
      .eq('code', codigoTeste);
    const { count: sobraSheet } = await supabase
      .from('payroll_sheets')
      .select('id', { count: 'exact', head: true })
      .eq('reference_month', COMPETENCIA.mes)
      .eq('reference_year', COMPETENCIA.ano)
      .eq('notes', 'verify-codes-crud');
    check('limpeza: zero códigos de teste', sobraCode ?? -1, 0);
    check('limpeza: zero sheets de teste', sobraSheet ?? -1, 0);
  }

  console.log(`\n===== RESULTADO: ${total - falhas}/${total} checks OK, ${falhas} falha(s) =====`);
  if (falhas > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('ERRO FATAL:', e);
  process.exitCode = 1;
});
