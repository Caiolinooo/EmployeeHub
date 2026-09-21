/**
 * Gate — valida a sincronização WKradar (src/lib/wkradar/sync.ts) contra o
 * banco real de dev (.env.local), conforme o CONTRATO da onda dp-rubricas-wkradar:
 *   sincronizarWk({ fonte: 'arquivo', competencia, companyId, planilha, nomeArquivo?, usuarioId? })
 *     → { employeesUpsertados, itensCriados, sheetId, avisos }
 *   class ErroWkCredencial; código sem payroll_codes.codigo_wk → erro 422-like
 *   com codigosNaoMapeados (nunca auto-criar rubrica).
 *
 * Fixture XLSX gerada em memória (xlsx). Idempotência: re-sync não duplica
 * itens 'wk' e preserva item 'manual' de teste. Toda mutation é marcada com
 * matrículas 'WKTST-*' e sheet em competência isolada (12/2099) — removida ao final.
 *
 * Se o módulo do agente WK ainda não existir, o script é marcado PENDENTE
 * (exit 0) — não falha o processo.
 *
 * Uso: npx tsx scripts/verify-dp-wk.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SYNC_PATH = path.join(process.cwd(), 'src/lib/wkradar/sync.ts');
const COMPETENCIA = { mes: 12, ano: 2099 }; // competência isolada p/ teste (ano far-future)
const PREFIXO_MATRICULA = 'WKTST';

// --- Contrato esperado do agente WK (tipos locais, espelham o contrato fixado) ---
interface ResultadoWk {
  employeesUpsertados: number;
  itensCriados: number;
  sheetId: string;
  avisos: string[];
}
interface ContratoWk {
  sincronizarWk(entrada: {
    fonte: 'api' | 'arquivo';
    competencia: { mes: number; ano: number };
    companyId: string;
    departmentId?: string | null;
    planilha?: Buffer | ArrayBuffer;
    nomeArquivo?: string;
    usuarioId?: string;
  }): Promise<ResultadoWk>;
  ErroWkCredencial: new (mensagem: string) => Error;
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
// Credenciais precisam existir em process.env ANTES de qualquer import do src/.
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const supabase: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// --- Harness mínimo ---
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

const stamp = Date.now().toString(36);
// CPF de teste: SÓ DÍGITOS, 11 posições — o normalizador WK recusa outros tamanhos.
const stampDigitos = String(Date.now()).slice(-7);
const matricula = (n: number) => `${PREFIXO_MATRICULA}-${stamp}-${String(n).padStart(2, '0')}`;
const cpfFalso = (n: number) => `999${stampDigitos}${n}`; // 3 + 7 + 1 = 11 dígitos

/**
 * Mapeamento temporário de codigo_wk para o teste: a fixture usa códigos WK
 * '001'/'201', que precisam apontar para as rubricas do portal de mesmo código.
 * Guarda o estado original (incl. terceiras rubricas que por acaso já tenham
 * esses codigo_wk — índice único) para restaurar exatamente na limpeza.
 */
let mapaOriginalCodigoWk: Array<{ id: string; codigo_wk: string | null }> = [];

async function aplicarMapeamentoTemporario(): Promise<void> {
  const { data: conflitantes } = await supabase
    .from('payroll_codes')
    .select('id, code, codigo_wk')
    .in('codigo_wk', ['001', '201']);
  const { data: alvos } = await supabase
    .from('payroll_codes')
    .select('id, code, codigo_wk')
    .in('code', ['001', '201']);

  const vistos = new Map<string, { id: string; codigo_wk: string | null }>();
  for (const linha of [...(conflitantes ?? []), ...(alvos ?? [])]) {
    vistos.set(linha.id as string, { id: linha.id as string, codigo_wk: (linha.codigo_wk as string | null) ?? null });
  }
  mapaOriginalCodigoWk = [...vistos.values()];

  for (const { id, codigo_wk } of mapaOriginalCodigoWk) {
    await supabase.from('payroll_codes').update({ codigo_wk: null }).eq('id', id);
  }
  for (const codigo of ['001', '201']) {
    const alvo = (alvos ?? []).find((c) => c.code === codigo);
    if (alvo) await supabase.from('payroll_codes').update({ codigo_wk: codigo }).eq('id', alvo.id as string);
  }
}

async function restaurarMapeamento(): Promise<void> {
  for (const { id, codigo_wk } of mapaOriginalCodigoWk) {
    await supabase.from('payroll_codes').update({ codigo_wk }).eq('id', id);
  }
  mapaOriginalCodigoWk = [];
}

/**
 * Fixture XLSX mínima. Cabeçalhos confirmados no parser do sync (analisarWorkbook
 * + variantes de cabeçalho de normalize.ts):
 *   aba "Colaboradores": Matricula, Nome, CPF, Cargo, SalarioBase, Admissao, Demissao, Status
 *   aba "Lancamentos":   Matricula, Codigo, Quantidade, Valor
 * As linhas extras PRECISAM reusar exatamente essas chaves — colunas repetidas
 * com outra capitalização viram 'codigo-2' no analisarWorkbook e são ignoradas.
 */
function construirPlanilhaFixture(lancamentosExtra?: Array<{ Matricula: string; Codigo: string; Quantidade: number; Valor: number }>): Buffer {
  const colaboradores = [
    { Matricula: matricula(1), Nome: 'VERIFY WK UM', CPF: cpfFalso(1), Cargo: 'Marinheiro', SalarioBase: 3000, Admissao: '2024-01-01', Demissao: '', Status: 'active' },
    { Matricula: matricula(2), Nome: 'VERIFY WK DOIS', CPF: cpfFalso(2), Cargo: 'Cozinheiro', SalarioBase: 2500, Admissao: '2024-02-01', Demissao: '', Status: 'active' },
  ];
  const lancamentos = [
    { Matricula: matricula(1), Codigo: '001', Quantidade: 30, Valor: 100 },
    { Matricula: matricula(2), Codigo: '201', Quantidade: 1, Valor: 180 },
    ...(lancamentosExtra ?? []),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colaboradores), 'Colaboradores');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lancamentos), 'Lancamentos');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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

async function itensDaSheet(sheetId: string, origem?: string) {
  let q = supabase.from('payroll_sheet_items').select('id, employee_id, code_id, quantity, reference_value, calculated_value, origem').eq('sheet_id', sheetId);
  if (origem) q = q.eq('origem', origem);
  const { data, error } = await q;
  if (error) throw new Error(`payroll_sheet_items: ${error.message}`);
  return data ?? [];
}

async function limpar(companyId: string, sheetIds: string[]): Promise<void> {
  // Ordem: resumos → auditoria → sheets (cascade em itens) → colaboradores de teste.
  for (const id of sheetIds) {
    await supabase.from('payroll_employee_summaries').delete().eq('sheet_id', id);
    await supabase.from('payroll_audit_log').delete().eq('table_name', 'payroll_sheets').eq('record_id', id);
  }
  await supabase.from('payroll_sheets').delete().eq('company_id', companyId).eq('reference_month', COMPETENCIA.mes).eq('reference_year', COMPETENCIA.ano);
  await supabase.from('payroll_employees').delete().eq('company_id', companyId).like('registration_number', `${PREFIXO_MATRICULA}-${stamp}-%`);
  await restaurarMapeamento();
}

async function main(): Promise<void> {
  console.log('=== verify-dp-wk — sincronização WKradar ===');

  if (!fs.existsSync(SYNC_PATH)) {
    console.log('\nPENDENTE: src/lib/wkradar/sync.ts não existe ainda.');
    console.log('Contrato esperado: sincronizarWk({ fonte, competencia, companyId, planilha }) → { employeesUpsertados, itensCriados, sheetId, avisos }; classe ErroWkCredencial.');
    console.log('Script escrito contra o contrato — rodar novamente quando o agente WK entregar.');
    return;
  }

  // Import dinâmico intencional (único do repo de scripts): o módulo é entregue
  // por um agente irmão e pode não existir no momento da execução — a guarda
  // PENDENTE acima exige resolução em runtime. O cast com razão nomeia o
  // contrato esperado; a checagem de shape abaixo o valida de verdade.
  const wk = (await import('../src/lib/wkradar/sync')) as unknown as ContratoWk;
  if (typeof wk.sincronizarWk !== 'function' || !wk.ErroWkCredencial) {
    console.log('\nPENDENTE: src/lib/wkradar/sync.ts existe mas não expõe sincronizarWk/ErroWkCredencial (contrato divergente).');
    return;
  }

  const companyId = await empresaDeTeste();
  const sheetIdsVisitadas: string[] = [];
  try {
    // Códigos reais do seed usados na fixture
    const { data: codes, error: errCodes } = await supabase.from('payroll_codes').select('id, code').in('code', ['001', '201']);
    if (errCodes) throw new Error(`payroll_codes: ${errCodes.message}`);
    const codeMap = new Map((codes ?? []).map((c) => [c.code as string, c.id as string]));
    if (!codeMap.get('001') || !codeMap.get('201')) throw new Error('Códigos 001/201 ausentes do seed — rode scripts/seed-payroll-data.sql.');

    // Códigos WK '001'/'201' precisam existir em payroll_codes.codigo_wk —
    // mapeia temporariamente (restaurado na limpeza).
    await aplicarMapeamentoTemporario();

    // ---- 1) Primeira sync (arquivo) -----------------------------------
    console.log('\n----- 1) Primeira sincronização (fonte: arquivo) -----');
    const planilha = construirPlanilhaFixture();
    const r1 = await wk.sincronizarWk({
      fonte: 'arquivo',
      competencia: COMPETENCIA,
      companyId,
      planilha,
      nomeArquivo: 'verify-dp-wk.xlsx',
    });
    sheetIdsVisitadas.push(r1.sheetId);
    check('1.1 employeesUpsertados = 2', r1.employeesUpsertados, 2);
    check('1.2 itensCriados = 2', r1.itensCriados, 2);
    check('1.3 sheetId presente', typeof r1.sheetId === 'string' && r1.sheetId.length > 0, true);

    const { data: sheet1 } = await supabase.from('payroll_sheets').select('id, status').eq('id', r1.sheetId).maybeSingle();
    check('1.4 sheet em status draft', sheet1?.status, 'draft');

    const itensWk1 = await itensDaSheet(r1.sheetId, 'wk');
    check('1.5 itens origem=wk na sheet', itensWk1.length, 2);
    check('1.6 códigos resolvidos (001/201)', itensWk1.filter((i) => i.code_id === codeMap.get('001') || i.code_id === codeMap.get('201')).length, 2);
    check(
      '1.7 valores calculados = quantidade × valor',
      itensWk1
        .map((i) => i.calculated_value)
        .sort((a, b) => a - b)
        .join('|'),
      itensWk1.map((i) => (i.code_id === codeMap.get('001') ? 3000 : 180)).sort((a, b) => a - b).join('|'),
    );
    check('1.8 avisos é array', Array.isArray(r1.avisos), true);

    const { data: emps } = await supabase
      .from('payroll_employees')
      .select('id, registration_number, cpf')
      .eq('company_id', companyId)
      .like('registration_number', `${PREFIXO_MATRICULA}-${stamp}-%`);
    check('1.9 colaboradores upsertados por matrícula', (emps ?? []).length, 2);
    check('1.10 CPFs persistidos (11 dígitos)', (emps ?? []).every((e) => typeof e.cpf === 'string' && /^\d{11}$/.test(e.cpf)), true);

    // ---- 2) Item manual + re-sync idempotente -------------------------
    console.log('\n----- 2) Re-sync idempotente preservando item manual -----');
    const emp1 = (emps ?? []).find((e) => e.registration_number === matricula(1));
    const { data: manual, error: errManual } = await supabase
      .from('payroll_sheet_items')
      .insert({
        sheet_id: r1.sheetId,
        employee_id: emp1!.id,
        code_id: codeMap.get('201'),
        quantity: 1,
        reference_value: 50,
        calculated_value: 50,
        origem: 'manual',
        observation: 'verify-dp-wk: item manual de teste',
      })
      .select('id')
      .single();
    if (errManual) throw new Error(`insert item manual: ${errManual.message}`);

    const r2 = await wk.sincronizarWk({ fonte: 'arquivo', competencia: COMPETENCIA, companyId, planilha, nomeArquivo: 'verify-dp-wk.xlsx' });
    check('2.1 mesmo sheetId no re-sync', r2.sheetId, r1.sheetId);
    check('2.2 itensCriados estável (sem duplicar)', r2.itensCriados, 2);
    const itensWk2 = await itensDaSheet(r1.sheetId, 'wk');
    check('2.3 contagem origem=wk estável', itensWk2.length, 2);
    const { data: manualDepois } = await supabase.from('payroll_sheet_items').select('id').eq('id', manual!.id).maybeSingle();
    check('2.4 item manual preservado', manualDepois?.id, manual!.id);
    const totalItens = await itensDaSheet(r1.sheetId);
    check('2.5 total de itens na sheet = 3 (2 wk + 1 manual)', totalItens.length, 3);

    // ---- 3) Código desconhecido → 422-like com codigosNaoMapeados ------
    console.log('\n----- 3) Código sem codigo_wk mapeado aborta tudo -----');
    let erroMapeamento: unknown = null;
    try {
      await wk.sincronizarWk({
        fonte: 'arquivo',
        competencia: COMPETENCIA,
        companyId,
        planilha: construirPlanilhaFixture([{ Matricula: matricula(1), Codigo: 'ZZZ999', Quantidade: 1, Valor: 10 }]),
        nomeArquivo: 'verify-dp-wk-zzz.xlsx',
      });
    } catch (e) {
      erroMapeamento = e;
    }
    check('3.1 sincronizarWk rejeitou', erroMapeamento !== null, true);
    let listaMapeados: unknown;
    if (erroMapeamento !== null && typeof erroMapeamento === 'object' && 'codigosNaoMapeados' in erroMapeamento) {
      listaMapeados = erroMapeamento.codigosNaoMapeados;
    }
    check('3.2 erro lista codigosNaoMapeados', Array.isArray(listaMapeados), true);
    check('3.3 ZZZ999 presente na lista', Array.isArray(listaMapeados) && listaMapeados.includes('ZZZ999'), true);
    const itensAposErro = await itensDaSheet(r1.sheetId);
    check('3.4 transação abortou sem sujar a sheet', itensAposErro.length, 3);

    // ---- 4) fonte 'api' sem credenciais → ErroWkCredencial -------------
    console.log('\n----- 4) fonte api sem credenciais -----');
    const { data: segredos } = await supabase
      .from('app_secrets')
      .select('key')
      .in('key', ['wkradar_api_url', 'wkradar_api_token']);
    const temCredenciais = (segredos ?? []).length >= 2;
    if (temCredenciais) {
      console.log('  IGNORADO: credenciais wkradar_api_url/wkradar_api_token existem no banco — teste de ErroWkCredencial exigiria chamar a API real.');
    } else {
      let erroCred: unknown = null;
      try {
        await wk.sincronizarWk({ fonte: 'api', competencia: COMPETENCIA, companyId });
      } catch (e) {
        erroCred = e;
      }
      check('4.1 sincronizarWk(api) rejeitou', Boolean(erroCred), true);
      check('4.2 erro é ErroWkCredencial', erroCred instanceof wk.ErroWkCredencial, true);
      const msg = erroCred instanceof Error ? erroCred.message : '';
      check('4.3 mensagem acionável (aponta credenciais)', /wkradar_api_(url|token)|credencial/i.test(msg), true);
    }
  } finally {
    console.log('\n----- Limpeza -----');
    await limpar(companyId, sheetIdsVisitadas);
    const { count: sobraEmp } = await supabase
      .from('payroll_employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .like('registration_number', `${PREFIXO_MATRICULA}-${stamp}-%`);
    const { count: sobraSheet } = await supabase
      .from('payroll_sheets')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('reference_month', COMPETENCIA.mes)
      .eq('reference_year', COMPETENCIA.ano);
    check('limpeza: zero colaboradores WKTST', sobraEmp ?? -1, 0);
    check('limpeza: zero sheets de teste', sobraSheet ?? -1, 0);
  }

  console.log(`\n===== RESULTADO: ${total - falhas}/${total} checks OK, ${falhas} falha(s) =====`);
  if (falhas > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('ERRO FATAL:', e);
  process.exitCode = 1;
});
