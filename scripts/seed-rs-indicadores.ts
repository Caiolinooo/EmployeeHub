/**
 * Gate G3 — semeia o módulo Indicadores R&S com as 3 planilhas reais do R&S
 * (abas de DADOS; as abas de relatório derivadas — KPI/Gráfico — ficam de fora
 * e podem ser importadas pelo wizard quando necessário). Idempotente: dataset
 * reimportado é substituído por nome (abas recriadas, importações históricas).
 *
 * Uso:
 *   npx tsx scripts/seed-rs-indicadores.ts            # semeia
 *   npx tsx scripts/seed-rs-indicadores.ts --verificar # semeia + valida contagens no banco
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { analisarPlanilha } from '../src/lib/indicadores/xlsx-import';

const PASTA = 'C:/Users/caio.correia/Downloads/Indicadores';

const ATOR_SEED = { nome: 'Seed Indicadores R&S', sistema: true };

const DATASETS: Array<{ nome: string; arquivo: string; abas: string[] }> = [
  {
    nome: 'Controle de Vagas e Indicadores 2026',
    arquivo: 'Controle de vagas e indicadores - 2026.xlsx',
    abas: ['Relatorio de candidatos', 'Relatório de vagas'],
  },
  {
    nome: 'Indicador de Eficácia 2026',
    arquivo: 'Indicador de eficácia 2026.xlsx',
    abas: ['Relatório de vagas', 'Eficácia', 'KPI Eficácia'],
  },
  {
    nome: 'Indicadores Auditoria 2026',
    arquivo: 'Indicadores auditoria - 2026.xlsx',
    abas: ['Relatório de vagas'],
  },
];

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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('SEED_RS_FAIL: credenciais Supabase ausentes (.env.local)');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function falhar(msg: string): never {
  console.error('SEED_RS_FAIL:', msg);
  process.exit(1);
}

async function planilhaPeloNome(nome: string) {
  const { data, error } = await supabase
    .from('rs_planilhas')
    .select('id, nome')
    .eq('nome', nome)
    .maybeSingle();
  if (error) falhar(`rs_planilhas (${nome}): ${error.message}`);
  return data;
}

async function substituirDataset(cfg: (typeof DATASETS)[number]): Promise<Record<string, number>> {
  const caminho = path.join(PASTA, cfg.arquivo);
  if (!fs.existsSync(caminho)) falhar(`planilha ausente: ${caminho}`);
  const buffer = fs.readFileSync(caminho);
  const analise = analisarPlanilha(buffer, { arquivoNome: cfg.arquivo });

  // Dataset: cria ou apaga (cascade de abas/linhas) e recria — semântica do
  // 'substituir' do wizard, aplicada ao dataset inteiro.
  const existente = await planilhaPeloNome(cfg.nome);
  if (existente) {
    const { error: delErr } = await supabase.from('rs_planilhas').delete().eq('id', existente.id);
    if (delErr) falhar(`apagar dataset '${cfg.nome}': ${delErr.message}`);
  }
  const { data: plan, error: planErr } = await supabase
    .from('rs_planilhas')
    .insert({ nome: cfg.nome, arquivo_nome: cfg.arquivo, criado_por: ATOR_SEED })
    .select('id')
    .single();
  if (planErr || !plan) falhar(`criar dataset '${cfg.nome}': ${planErr?.message}`);

  const contagens: Record<string, number> = {};
  for (let i = 0; i < cfg.abas.length; i += 1) {
    const nomeAba = cfg.abas[i];
    const aba = analise.abas.find((a) => a.nome === nomeAba);
    if (!aba) falhar(`${cfg.arquivo}: aba '${nomeAba}' não encontrada na análise`);

    const { data: abaRow, error: abaErr } = await supabase
      .from('rs_abas')
      .insert({
        planilha_id: plan.id,
        nome: aba.nome,
        linha_cabecalho: aba.headerRow,
        colunas: aba.colunas,
        ordem: i,
      })
      .select('id')
      .single();
    if (abaErr || !abaRow) falhar(`criar aba '${nomeAba}': ${abaErr?.message}`);

    const linhas = aba.linhas.map((dados, idx) => ({
      aba_id: abaRow.id,
      dados,
      ordem: idx,
      criado_por: ATOR_SEED,
    }));
    // Inserção em blocos (chunk de 500) — payload grande estoura o limite do PostgREST.
    for (let de = 0; de < linhas.length; de += 500) {
      const bloco = linhas.slice(de, de + 500);
      const { error: linErr } = await supabase.from('rs_linhas').insert(bloco);
      if (linErr) falhar(`inserir linhas '${nomeAba}' (bloco em ${de}): ${linErr.message}`);
    }
    contagens[nomeAba] = aba.totalLinhas;
  }

  const { error: impErr } = await supabase.from('rs_importacoes').insert({
    planilha_id: plan.id,
    arquivo_nome: cfg.arquivo,
    modo: 'substituir',
    abas: cfg.abas,
    total_linhas: Object.values(contagens).reduce((a, b) => a + b, 0),
    ator: ATOR_SEED,
  });
  if (impErr) falhar(`registrar importação '${cfg.nome}': ${impErr.message}`);

  return contagens;
}

async function verificarNoBanco(cfg: (typeof DATASETS)[number], contagens: Record<string, number>) {
  const plan = await planilhaPeloNome(cfg.nome);
  if (!plan) falhar(`dataset '${cfg.nome}' não encontrado após semear`);
  const { data: abas, error } = await supabase
    .from('rs_abas')
    .select('id, nome')
    .eq('planilha_id', plan.id);
  if (error) falhar(`listar abas de '${cfg.nome}': ${error.message}`);
  for (const aba of abas ?? []) {
    const { count, error: cntErr } = await supabase
      .from('rs_linhas')
      .select('id', { count: 'exact', head: true })
      .eq('aba_id', aba.id)
      .is('deleted_at', null);
    if (cntErr) falhar(`contar linhas de '${aba.nome}': ${cntErr.message}`);
    if (count !== contagens[aba.nome]) {
      falhar(`'${cfg.nome}/${aba.nome}': ${count} linhas no banco ≠ ${contagens[aba.nome]} importadas`);
    }
    console.log(`  BANCO OK ${cfg.nome} › ${aba.nome}: ${count} linhas`);
  }
}

async function main() {
  const verificar = process.argv.includes('--verificar');
  for (const cfg of DATASETS) {
    const contagens = await substituirDataset(cfg);
    const total = Object.values(contagens).reduce((a, b) => a + b, 0);
    console.log(`SEMEADO '${cfg.nome}' (${cfg.arquivo}): ${Object.entries(contagens).map(([k, v]) => `${k}=${v}`).join(', ')} — total ${total}`);
    if (verificar) await verificarNoBanco(cfg, contagens);
  }
  console.log('SEED_RS_OK');
}

main().catch((e) => {
  console.error('SEED_RS_FAIL:', e);
  process.exit(1);
});
