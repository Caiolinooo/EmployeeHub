/**
 * Gate — valida o motor KPI R&S (src/lib/indicadores/kpi.ts) contra os dados
 * reais do banco (rs_planilhas/rs_abas/rs_linhas), replicando o fluxo da rota
 * GET /api/indicadores/kpi.
 *
 * Uso:
 *   npx tsx scripts/verify-rs-kpi.ts            # planilha mais recente
 *   npx tsx scripts/verify-rs-kpi.ts --todas    # todas as planilhas
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  calcularKpisPlanilha,
  type KpiColuna,
  type KpiLinha,
} from '../src/lib/indicadores/kpi';

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
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

async function linhasDaAba(abaId: string): Promise<KpiLinha[]> {
  const out: KpiLinha[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('rs_linhas')
      .select('id, dados')
      .eq('aba_id', abaId)
      .is('deleted_at', null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data as KpiLinha[]));
    if (!data || data.length < 1000) return out;
    from += 1000;
  }
}

function pct(f: number | null): string {
  return f === null ? '—' : `${(f * 100).toFixed(1)}%`;
}

function num(n: number | null): string {
  return n === null ? '—' : n.toFixed(1);
}

async function calcularPlanilha(id: string, nome: string) {
  const { data: abas, error } = await supabase
    .from('rs_abas')
    .select('id, nome, colunas, ordem')
    .eq('planilha_id', id)
    .order('ordem', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const abasComLinhas = [];
  for (const aba of abas || []) {
    abasComLinhas.push({
      id: aba.id,
      nome: aba.nome,
      colunas: (aba.colunas as KpiColuna[]) ?? [],
      linhas: await linhasDaAba(aba.id),
    });
  }
  return calcularKpisPlanilha({ id, nome }, abasComLinhas);
}

async function main() {
  const todas = process.argv.includes('--todas');
  const { data: planilhas, error } = await supabase
    .from('rs_planilhas')
    .select('id, nome')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const alvo = todas ? planilhas || [] : (planilhas || []).slice(0, 1);
  for (const p of alvo) {
    const kpi = await calcularPlanilha(p.id, p.nome);
    console.log(`\n===== ${p.nome} =====`);
    for (const aba of kpi.abas) {
      console.log(
        `  aba "${aba.nome}" → tipo=${aba.tipo}, linhas=${aba.totalLinhas}`,
      );
      const v = aba.vagas ?? aba.substituicoes;
      if (v) {
        console.log(
          `    total=${v.total} status=${JSON.stringify(v.porStatus)} medidos=${v.medidos} noPrazo=${v.noPrazo} atrasadas=${v.atrasadas}`,
        );
        console.log(
          `    eficácia=${pct(v.taxaEficacia)} tempoMédio=${num(v.tempoMedioEnvio)}d antecipação=${num(v.antecipacaoMedia)}d`,
        );
        console.log(
          `    meses=${v.porMes.length} (último: ${JSON.stringify(v.porMes.at(-1))})`,
        );
        console.log(
          `    topClientes=${v.porCliente.slice(0, 3).map((c) => `${c.nome}:${c.total}`).join(', ')}`,
        );
        console.log(
          `    topFuncoes=${v.porFuncao.slice(0, 3).map((c) => `${c.nome}:${c.total}`).join(', ')}`,
        );
        if ('comSubstituicao' in v && v.comSubstituicao !== undefined) {
          console.log(`    comSubstituicao=${v.comSubstituicao}`);
        }
      }
      if (aba.retencao) {
        const r = aba.retencao;
        console.log(
          `    retenção geral=${pct(r.taxaRetencao)} colaboradores=${r.totalColaboradores} substituições=${r.totalSubstituicoes}`,
        );
        console.log(
          `    porCliente(3)=${r.porCliente.slice(0, 3).map((c) => `${c.cliente}:${pct(c.retencao)}`).join(', ')}`,
        );
      }
    }
    const c = kpi.consolidado;
    console.log(
      `\n  CONSOLIDADO: total=${c?.total} eficácia=${pct(c?.taxaEficacia ?? null)} tempoMédio=${num(c?.tempoMedioEnvio ?? null)}d`,
    );
    console.log(
      `  AVALIAÇÃO: nível=${kpi.avaliacao.nivel} meta=${kpi.avaliacao.metaDias}d`,
    );
  }
  console.log('\n✅ verify-rs-kpi ok');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
