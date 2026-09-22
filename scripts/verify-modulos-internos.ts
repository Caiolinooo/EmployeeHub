/**
 * Gate — valida a fonte única dos módulos internos (src/lib/payroll/fontes-dp.ts)
 * contra o banco real de dev (.env.local), conforme o CONTRATO da onda:
 *   sincronizarModulosInternos({ competencia: { mes, ano }, companyId, departmentId?, usuarioId? })
 *     → { inseridos, descartadosPrecedencia, pendencias: [{ cpf, nome, motivo }] }
 *   Itens gravados com origem='gt'; itens 'manual' intocados; PRECEDÊNCIA:
 *   item 'wk' do mesmo employee+code vence e o 'gt' é descartado (auditado).
 *   Idempotente: re-executar não duplica.
 *
 * Fontes reais (mesmas do GET /api/gestao-tripulantes/relatorio-mensal →
 * gerarRelatorioEscalaMensal): gt_colaboradores, gt_historico_embarques (escala)
 * e gt_afastamentos (férias, tipo_afastamento='ferias', deleted_at IS NULL).
 * Casamento gt_colaboradores.cpf ↔ payroll_employees.cpf.
 *
 * Fixture mínima marcada com matrículas 'VTST-*' e competência isolada (11/2099),
 * totalmente removida ao final. Se fontes-dp.ts ainda não existir → PENDENTE (exit 0).
 *
 * Uso: npx tsx scripts/verify-modulos-internos.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FONTE_DP_PATH = path.join(process.cwd(), 'src/lib/payroll/fontes-dp.ts');
const COMPETENCIA = { mes: 11, ano: 2099 }; // isolada (verify-dp-wk usa 12/2099; codes-crud 10/2099)
// Limites reais do banco: payroll_employees.cpf é varchar(14) — usar CPF de 11
// DÍGITOS; matrículas curtas (≤14). Stamp por execução evita colisões.
const stampDigitos = String(Date.now()).slice(-7);
const matriculaDe = (n: number) => `VTS${stampDigitos}${n}`; // 11 chars
const cpfFalso = (n: number) => `997${stampDigitos}${n}`; // 11 dígitos

interface ResultadoSync {
  inseridos: number;
  descartadosPrecedencia: number;
  pendencias: Array<{ cpf: string; nome: string; motivo: string }>;
}
interface ContratoFontesDp {
  sincronizarModulosInternos(entrada: {
    competencia: { mes: number; ano: number };
    companyId: string;
    departmentId?: string | null;
    usuarioId?: string;
  }): Promise<ResultadoSync>;
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

function check(nome: string, obtido: unknown, esperado: unknown, tolerancia = 0.005): void {
  total += 1;
  const ok =
    typeof obtido === 'number' && typeof esperado === 'number'
      ? Math.abs(obtido - esperado) < tolerancia
      : obtido === esperado;
  const mostra = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : JSON.stringify(v) ?? 'undefined');
  if (!ok) falhas += 1;
  console.log(`  ${ok ? 'OK  ' : 'FALHA'} ${nome} | obtido=${mostra(obtido)} esperado=${mostra(esperado)}`);
}

async function empresaDeTeste(): Promise<string> {
  const { data, error } = await supabase
    .from('payroll_companies')
    .select('id, name')
    .eq('is_active', true)
    .order('created_at')
    .limit(1);
  if (error) throw new Error(`payroll_companies: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Nenhuma payroll_companies ativa — rode o seed-payroll-data.sql antes.');
  console.log(`Empresa de teste: ${data[0].name} (${data[0].id})`);
  return data[0].id as string;
}

async function limpar(companyId: string, sheetIds: string[], empIds: string[], colabIds: string[]): Promise<void> {
  for (const id of sheetIds) {
    await supabase.from('payroll_employee_summaries').delete().eq('sheet_id', id);
    await supabase.from('payroll_audit_log').delete().eq('table_name', 'payroll_sheets').eq('record_id', id);
  }
  await supabase.from('payroll_sheets').delete().eq('company_id', companyId).eq('reference_month', COMPETENCIA.mes).eq('reference_year', COMPETENCIA.ano);
  await supabase.from('payroll_employees').delete().in('id', empIds.length > 0 ? empIds : ['00000000-0000-0000-0000-000000000000']);
  // GT: afastamentos/embarques caem por CASCADE ao remover os colaboradores de teste.
  await supabase.from('gt_colaboradores').delete().in('id', colabIds.length > 0 ? colabIds : ['00000000-0000-0000-0000-000000000000']);
}

async function main(): Promise<void> {
  console.log('=== verify-modulos-internos — fontes DP → folha (origem gt) ===');

  if (!fs.existsSync(FONTE_DP_PATH)) {
    console.log('\nPENDENTE: src/lib/payroll/fontes-dp.ts não existe ainda.');
    console.log('Contrato esperado: sincronizarModulosInternos({ competencia, companyId }) → { inseridos, descartadosPrecedencia, pendencias }');
    console.log('Script escrito contra o contrato — rodar novamente quando o agente Módulos entregar.');
    return;
  }

  // Import dinâmico intencional (mesmo padrão do verify-dp-wk.ts): módulo irmão
  // pode não existir no momento da execução; guarda PENDENTE acima exige isso.
  const fontes = (await import('../src/lib/payroll/fontes-dp')) as unknown as ContratoFontesDp;
  if (typeof fontes.sincronizarModulosInternos !== 'function') {
    console.log('\nPENDENTE: fontes-dp.ts existe mas não expõe sincronizarModulosInternos (contrato divergente).');
    return;
  }

  const companyId = await empresaDeTeste();
  const sheetIdsVisitadas: string[] = [];
  const empIdsVisitados: string[] = [];
  const colabIdsVisitados: string[] = [];
  try {
    // ---- Fixture -------------------------------------------------------
    const { data: codes } = await supabase.from('payroll_codes').select('id, code').in('code', ['001', '005', '006']);
    const codeMap: Record<string, string> = {};
    for (const c of codes ?? []) codeMap[c.code as string] = c.id as string;
    if (!codeMap['005']) throw new Error('Código 005 (Férias) ausente do seed.');

    const { data: empA, error: errEmp } = await supabase
      .from('payroll_employees')
      .insert({
        company_id: companyId,
        registration_number: matriculaDe(1),
        name: 'VERIFY GT COM MATCH',
        cpf: cpfFalso(1),
        base_salary: 3000,
        admission_date: '2024-01-01',
        status: 'active',
      })
      .select('id')
      .single();
    if (errEmp) throw new Error(`insert payroll_employees: ${errEmp.message}`);
    empIdsVisitados.push(empA!.id);

    const { data: colabs, error: errColab } = await supabase
      .from('gt_colaboradores')
      .insert([
        { nome_completo: 'VERIFY GT COM MATCH', cpf: cpfFalso(1), matricula: matriculaDe(1), status_embarque: 'desembarcado' },
        { nome_completo: 'VERIFY GT SEM MATCH', cpf: cpfFalso(2), matricula: matriculaDe(2), status_embarque: 'desembarcado' },
      ])
      .select('id, cpf, nome_completo');
    if (errColab) throw new Error(`insert gt_colaboradores: ${errColab.message}`);
    for (const c of colabs ?? []) colabIdsVisitados.push(c.id as string);
    const colabA = (colabs ?? []).find((c) => c.cpf === cpfFalso(1))!;

    // Férias intersectando 11/2099 + um trecho de escala (dias ON) no mês.
    const { error: errAfast } = await supabase.from('gt_afastamentos').insert({
      colaborador_id: colabA.id,
      tipo_afastamento: 'ferias',
      data_inicio: '2099-11-01',
      data_fim: '2099-11-20',
      motivo: 'verify-modulos-internos',
    });
    if (errAfast) throw new Error(`insert gt_afastamentos: ${errAfast.message}`);
    const { error: errEmb } = await supabase.from('gt_historico_embarques').insert({
      colaborador_id: colabA.id,
      tipo: 'normal',
      data_embarque: '2099-11-01',
      data_desembarque: '2099-11-10',
      observacoes: 'verify-modulos-internos',
    });
    if (errEmb) throw new Error(`insert gt_historico_embarques: ${errEmb.message}`);

    // ---- 1) Primeira consolidação --------------------------------------
    console.log('\n----- 1) sincronizarModulosInternos (11/2099) -----');
    const r1 = await fontes.sincronizarModulosInternos({ competencia: COMPETENCIA, companyId });
    check('1.1 inseridos >= 1 (escala + férias)', r1.inseridos >= 1, true);
    check('1.2 pendencias >= 1', (r1.pendencias ?? []).length >= 1, true);
    check('1.3 pendência = colaborador sem casamento de CPF', (r1.pendencias ?? []).some((p) => p.cpf === cpfFalso(2) && p.nome === 'VERIFY GT SEM MATCH' && typeof p.motivo === 'string'), true);
    // O banco real pode ter outros colaboradores GT sem vínculo (pendências legítimas);
    // o invariante é: quem TEM casamento nunca vira pendência, e pendência tem motivo.
    check('1.4 colab casado (A) nunca listado como pendência', (r1.pendencias ?? []).some((p) => p.cpf === cpfFalso(1)), false);
    check('1.4b todas as pendências com motivo', (r1.pendencias ?? []).every((p) => typeof p.motivo === 'string' && p.motivo.length > 0), true);

    const { data: sheet1 } = await supabase
      .from('payroll_sheets')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('reference_month', COMPETENCIA.mes)
      .eq('reference_year', COMPETENCIA.ano)
      .maybeSingle();
    sheetIdsVisitadas.push(sheet1!.id);
    check('1.5 sheet da competência em draft', sheet1?.status, 'draft');

    const { data: itensGt } = await supabase
      .from('payroll_sheet_items')
      .select('id, employee_id, code_id, calculated_value, origem')
      .eq('sheet_id', sheet1!.id)
      .eq('origem', 'gt');
    check('1.6 itens origem=gt na sheet', (itensGt ?? []).length >= 1, true);
    check('1.7 férias lançadas como 005 (e/ou 006 1/3)', (itensGt ?? []).some((i) => i.code_id === codeMap['005'] || i.code_id === codeMap['006']), true);
    // Contrato: item gt só nasce de quem tem casamento CPF↔ficha (inclui os
    // administrativos reais — escala_embarque=0 — que entram via fallback 001).
    const idsItens = [...new Set((itensGt ?? []).map((i) => i.employee_id as string))];
    const { data: empsItens } = await supabase.from('payroll_employees').select('id, cpf').in('id', idsItens);
    const cpfsItens = (empsItens ?? []).map((e) => String(e.cpf ?? '').replace(/\D/g, ''));
    const { data: colabsItens } = await supabase.from('gt_colaboradores').select('cpf').is('deleted_at', null);
    const cpfsGt = new Set((colabsItens ?? []).map((c) => String(c.cpf ?? '').replace(/\D/g, '')));
    check(
      '1.8 itens gt só de employees com colaborador GT casado (CPF)',
      cpfsItens.every((cpf) => cpfsGt.has(cpf)),
      true,
    );

    // ---- 2) Precedência WK > GT ----------------------------------------
    console.log('\n----- 2) Precedência: item wk do mesmo employee+code vence -----');
    const { data: itemWk, error: errWk } = await supabase
      .from('payroll_sheet_items')
      .insert({
        sheet_id: sheet1!.id,
        employee_id: empA!.id,
        code_id: codeMap['005'],
        quantity: 20,
        reference_value: 100,
        calculated_value: 2000,
        origem: 'wk',
        observation: 'verify-modulos-internos: item wk de precedência',
      })
      .select('id')
      .single();
    if (errWk) throw new Error(`insert item wk: ${errWk.message}`);

    const r2 = await fontes.sincronizarModulosInternos({ competencia: COMPETENCIA, companyId });
    check('2.1 descartadosPrecedencia >= 1', r2.descartadosPrecedencia >= 1, true);
    const { data: itensA005 } = await supabase
      .from('payroll_sheet_items')
      .select('id, origem')
      .eq('sheet_id', sheet1!.id)
      .eq('employee_id', empA!.id)
      .eq('code_id', codeMap['005']);
    check('2.2 exatamente 1 item do employee+code 005', (itensA005 ?? []).length, 1);
    check('2.3 o sobrevivente é o wk', (itensA005 ?? [])[0]?.origem, 'wk');
    check('2.4 item wk intacto', (itensA005 ?? [])[0]?.id, itemWk!.id);

    // ---- 3) Idempotência ------------------------------------------------
    console.log('\n----- 3) Re-execução idempotente -----');
    const { count: gtAposR2 } = await supabase
      .from('payroll_sheet_items')
      .select('id', { count: 'exact', head: true })
      .eq('sheet_id', sheet1!.id)
      .eq('origem', 'gt');
    await fontes.sincronizarModulosInternos({ competencia: COMPETENCIA, companyId });
    const { count: gtAposR3 } = await supabase
      .from('payroll_sheet_items')
      .select('id', { count: 'exact', head: true })
      .eq('sheet_id', sheet1!.id)
      .eq('origem', 'gt');
    check('3.1 contagem origem=gt estável após re-execução', gtAposR3 ?? -1, gtAposR2 ?? -2);
    const { count: itensWkAposR3 } = await supabase
      .from('payroll_sheet_items')
      .select('id', { count: 'exact', head: true })
      .eq('sheet_id', sheet1!.id)
      .eq('origem', 'wk');
    check('3.2 item wk não foi tocado', itensWkAposR3 ?? -1, 1);
  } finally {
    console.log('\n----- Limpeza -----');
    await limpar(companyId, sheetIdsVisitadas, empIdsVisitados, colabIdsVisitados);
    const { data: sobraColab } = await supabase
      .from('gt_colaboradores')
      .select('id')
      .in('id', colabIdsVisitados.length > 0 ? colabIdsVisitados : ['00000000-0000-0000-0000-000000000000']);
    const { data: sobraEmp } = await supabase
      .from('payroll_employees')
      .select('id')
      .in('id', empIdsVisitados.length > 0 ? empIdsVisitados : ['00000000-0000-0000-0000-000000000000']);
    const { count: sobraSheet } = await supabase
      .from('payroll_sheets')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('reference_month', COMPETENCIA.mes)
      .eq('reference_year', COMPETENCIA.ano);
    check('limpeza: zero sheets de teste', sobraSheet ?? -1, 0);
    check('limpeza: zero gt_colaboradores de teste', (sobraColab ?? []).length, 0);
    check('limpeza: zero payroll_employees de teste', (sobraEmp ?? []).length, 0);
  }

  console.log(`\n===== RESULTADO: ${total - falhas}/${total} checks OK, ${falhas} falha(s) =====`);
  if (falhas > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('ERRO FATAL:', e);
  process.exitCode = 1;
});
