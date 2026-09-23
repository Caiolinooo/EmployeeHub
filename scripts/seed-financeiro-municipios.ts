/**
 * Seed do registry de municípios (fin_municipios) a partir da API pública do IBGE.
 * Fonte: https://servicodados.ibge.gov.br/api/v1/localidades/municipios
 * Fallback offline: scripts/data/fin-municipios-ibge.json (lista já cacheada).
 *
 * Upsert NÃO destrutivo: (codigo_ibge, nome, uf) são atualizados; NUNCA sobrescreve
 * provider_sugerido / wsdl_url / ambiente_urls editados no admin (§2.4 do design).
 *
 * Uso:
 *   npx tsx scripts/seed-financeiro-municipios.ts              # aplica o seed
 *   npx tsx scripts/seed-financeiro-municipios.ts --verificar  # aplica + verifica → FIN_SEED_MUNICIPIOS_OK
 */
import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface MunicipioIbge {
  codigo_ibge: string;
  nome: string;
  uf: string;
  uf_nome?: string;
}

const MACAE_IBGE = '3302403';
const MINIMO_MUNICIPIOS = 5570; // Brasil tem 5.570 municípios (IBGE)
const CHUNK = 500;

function loadEnvFiles(): Record<string, string> {
  const files = ['.env.local', '.env', '.env.production'];
  const env: Record<string, string> = {};
  for (const f of files) {
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

async function buscarIbge(): Promise<MunicipioIbge[]> {
  const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as Array<{
      id: number;
      nome: string;
      microrregiao?: { mesorregiao?: { UF?: { sigla?: string; nome?: string } } };
    }>;
    const lista = raw.map((m) => ({
      codigo_ibge: String(m.id),
      nome: m.nome,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla || '',
      uf_nome: m.microrregiao?.mesorregiao?.UF?.nome || '',
    }));
    if (lista.some((m) => !m.uf)) throw new Error('resposta IBGE sem UF em algum item');
    console.log(`IBGE API: ${lista.length} municípios`);
    return lista;
  } catch (e) {
    console.log(`IBGE API falhou (${(e as Error).message}) — usando cache local.`);
    const cachePath = path.join(__dirname, 'data', 'fin-municipios-ibge.json');
    const lista = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as MunicipioIbge[];
    console.log(`Cache local: ${lista.length} municípios`);
    return lista;
  }
}

function criarCliente(): SupabaseClient {
  const env = loadEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Erro: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsertMunicipios(supabase: SupabaseClient, lista: MunicipioIbge[]): Promise<number> {
  const validos = lista.filter((m) => {
    if (m.codigo_ibge && /^[A-Z]{2}$/.test(m.uf || '')) return true;
    console.warn(`  Ignorado (UF inválida): ${JSON.stringify(m)}`);
    return false;
  });
  let gravados = 0;
  for (let i = 0; i < validos.length; i += CHUNK) {
    const chunk = validos.slice(i, i + CHUNK).map((m) => ({
      codigo_ibge: m.codigo_ibge,
      nome: m.nome,
      uf: m.uf,
    }));
    // ON CONFLICT atualiza SOMENTE nome/uf/atualizado_em — provider_sugerido,
    // wsdl_url e ambiente_urls nunca são sobrescritos (edits do admin preservados).
    const { error } = await supabase
      .from('fin_municipios')
      .upsert(chunk, {
        onConflict: 'codigo_ibge',
        ignoreDuplicates: false,
      });
    if (error) throw new Error(`upsert chunk ${i}: ${error.message}`);
    gravados += chunk.length;
    if ((i / CHUNK) % 4 === 3) console.log(`  ...${gravados}/${lista.length}`);
  }
  return gravados;
}

async function main() {
  const verificar = process.argv.includes('--verificar');
  const supabase = criarCliente();

  const lista = await buscarIbge();
  if (lista.length < MINIMO_MUNICIPIOS) {
    console.error(`FIN_SEED_MUNICIPIOS_FAIL: lista com ${lista.length} municípios (< ${MINIMO_MUNICIPIOS})`);
    process.exit(1);
  }

  const gravados = await upsertMunicipios(supabase, lista);
  console.log(`Upsert concluído: ${gravados} municípios enviados`);

  if (!verificar) {
    console.log('FIN_SEED_MUNICIPIOS_OK (sem --verificar: verificação não executada)');
    return;
  }

  // --verificar: count total >= 5570 e Macaé presente.
  const { count, error: countError } = await supabase
    .from('fin_municipios')
    .select('codigo_ibge', { count: 'exact', head: true });
  if (countError) {
    console.error(`FIN_SEED_MUNICIPIOS_FAIL: ${countError.message}`);
    process.exit(1);
  }
  const { data: macae, error: macaeError } = await supabase
    .from('fin_municipios')
    .select('codigo_ibge, nome, uf')
    .eq('codigo_ibge', MACAE_IBGE)
    .maybeSingle();
  if (macaeError) {
    console.error(`FIN_SEED_MUNICIPIOS_FAIL: ${macaeError.message}`);
    process.exit(1);
  }

  if ((count ?? 0) < MINIMO_MUNICIPIOS) {
    console.error(`FIN_SEED_MUNICIPIOS_FAIL: count=${count} (< ${MINIMO_MUNICIPIOS})`);
    process.exit(1);
  }
  if (!macae) {
    console.error(`FIN_SEED_MUNICIPIOS_FAIL: Macaé ${MACAE_IBGE} ausente`);
    process.exit(1);
  }

  console.log(`Verificação: count=${count} (>= ${MINIMO_MUNICIPIOS}); Macaé=${JSON.stringify(macae)}`);
  console.log('FIN_SEED_MUNICIPIOS_OK');
}

main().catch((e) => {
  console.error('FIN_SEED_MUNICIPIOS_FAIL:', e);
  process.exit(1);
});
