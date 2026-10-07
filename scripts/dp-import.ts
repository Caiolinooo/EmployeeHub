#!/usr/bin/env npx tsx
/**
 * DP Import — Mapeamento inteligente de pastas do fileserver (DATA-ABZ) → gt_documentos
 *
 * Varre a árvore de Funcionários do DP ("5. DP/ABZ Serviços/3 - Funcionários/.../Ativos"),
 * reconhece pastas de colaborador no padrão "Nome Completo - Cargo - Matrícula",
 * casa com gt_colaboradores (matrícula exata → nome normalizado), classifica cada
 * arquivo pela subpasta+nome, sobe para o bucket gestao-tripulantes-documentos e
 * cria a linha em gt_documentos (origem 'importado') respeitando o anti-duplicata
 * (arquivo_hash → path → (colab,tipo,titulo,num)). Em --apply, roda o MESMO fluxo
 * de OCR da rota /documentos/[id]/ocr (Tesseract local → regex mod-11 → gate de
 * identidade por CPF → quarentena em dúvida → persistirCamposOcrDocumento).
 *
 * Uso:
 *   npm run dp:import                      # DRY-RUN (padrão): scan + match + classificação, relatório JSON
 *   npm run dp:import -- --apply           # grava de fato (upload + insert + OCR)
 *   npm run dp:import -- --apply --sem-ocr # grava sem rodar OCR
 *   npm run dp:import -- --limit=5         # processa no máx. 5 pastas de colaborador
 *   npm run dp:import -- --max-arquivos=40 # teto global de arquivos gravados (apply)
 *   npm run dp:import -- --filtro=silva    # só pastas de colaborador cujo nome contenha "silva"
 *   npm run dp:import -- --saida=out.json  # caminho do relatório (default scripts/out/dp-import-<ts>.json)
 *   npm run dp:import -- --excluir="ABZ - Base X"  # poda ramo (relativo à raiz de scan); acumulável
 *   npm run dp:import -- --permite-fallback-nome   # LEGADO: match por nome mesmo com matrícula não-casada
 *
 * Regras de segurança (2026-10):
 *   - Kill-switch: gt_configuracoes.dp_import_enabled = false bloqueia --apply.
 *   - Conexão is_active = false bloqueia --apply.
 *   - Pasta com matrícula que não casa NUNCA cai para match por nome → quarentena_match.
 *   - Matrícula-só-dígitos com 2+ colaboradores = ambíguo (nunca "primeiro vence").
 *   - Ramos em smb_connections.excluded_paths (ou --excluir) são podados do scan.
 *
 * Pré-requisitos: sessão SMB ativa (New-SmbMapping persistente — ver skill
 * painel-abz-smb-data-abz) e .env.local com NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function argFlag(nome: string): boolean {
  return process.argv.includes(`--${nome}`);
}
function argValor(nome: string): string | null {
  const hit = process.argv.find(a => a.startsWith(`--${nome}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}
function argValores(nome: string): string[] {
  return process.argv
    .filter(a => a.startsWith(`--${nome}=`))
    .map(a => a.split('=').slice(1).join('='))
    .filter(Boolean);
}

const APLICAR = argFlag('apply');
const SEM_OCR = argFlag('sem-ocr');
const PERMITE_FALLBACK_NOME = argFlag('permite-fallback-nome'); // legado: match por nome mesmo com matrícula
const EXCLUIR_CLI = argValores('excluir'); // caminhos relativos a podar (além dos do banco)
const LIMIT_PASTAS = Number(argValor('limit') || 0) || 0;
const MAX_ARQUIVOS = Number(argValor('max-arquivos') || 0) || 0;
const FILTRO_PASTA = (argValor('filtro') || '').toLowerCase().trim();
const CONEXAO_ID = argValor('conexao') || 'b404e324-b9b3-452d-a6ac-9fbace6a00ea';
const SAIDA = argValor('saida') || path.resolve(
  process.cwd(),
  'scripts',
  'out',
  `dp-import-${new Date().toISOString().replace(/[:T]/g, '').split('.')[0]}.json`
);

const BUCKET = 'gestao-tripulantes-documentos';
const RAIZ_FUNCIONARIOS = path.join('5. DP', 'ABZ Serviços', '3 - Funcionários');
const PROFUNDIDADE_MAX_SCAN = 9;
const PROFUNDIDADE_MAX_ARQUIVOS = 4;
const TAMANHO_MAX_ARQUIVO = 20 * 1024 * 1024;
const EXTENSOES_OK: Record<string, true> = { '.pdf': true, '.jpg': true, '.jpeg': true, '.png': true, '.webp': true };
const ARQUIVOS_IGNORADOS: Record<string, true> = { 'thumbs.db': true, 'desktop.ini': true, '.ds_store': true };

// ---------------------------------------------------------------------------
// Normalização / parsing
// ---------------------------------------------------------------------------
function norm(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

interface PastaColaborador {
  caminhoAbs: string;
  caminhoRel: string;
  nomePasta: string;
  nome: string;
  cargo: string;
  matricula: string;
}

/** "Nome Completo - Cargo - Matrícula[_extra]" → partes. Retorna null se não parecer pasta de pessoa. */
function parsePastaColaborador(nomePasta: string): { nome: string; cargo: string; matricula: string } | null {
  const partes = nomePasta.split(' - ').map(p => p.trim()).filter(Boolean);
  if (partes.length < 3) return null;
  const ultima = partes[partes.length - 1];
  // matrícula: token alfanum curto, opcional sufixo "_data"/"_obs"
  const m = ultima.match(/^([A-Za-z0-9]{2,20})(?:_.*)?$/);
  if (!m) return null;
  const matricula = m[1];
  // nome precisa ter pelo menos nome+sobrenome e não ser palavra estrutural
  const nome = partes[0];
  if (nome.length < 5 || !nome.includes(' ')) return null;
  if (/^(ativos|desligados|clientes|base|offshore|onshore|arquivo|outros)$/i.test(nome)) return null;
  const cargo = partes.slice(1, -1).join(' - ');
  return { nome, cargo, matricula };
}

// ---------------------------------------------------------------------------
// Classificação de tipo_documento (subpasta + nome do arquivo)
// ---------------------------------------------------------------------------
type Classificacao = { tipo: string; subtipo?: string; motivo: string } | { skip: true; motivo: string };

// Tipos canônicos pós-expansão 2026-10 (pessoal/contratual/demissional/ferias/ponto)
const MAPA_SUBPASTA: Record<string, { tipo: string; subtipo?: string }> = {
  'documentos pessoais': { tipo: 'pessoal' },
  'documentos contratuais': { tipo: 'contratual' },
  'documentos medicos': { tipo: 'aso' },
  'certificados': { tipo: 'treinamento' },
  'hse': { tipo: 'treinamento' },
  'demissional': { tipo: 'demissional' },
  'desligamento': { tipo: 'demissional' },
  'rescisao': { tipo: 'demissional' },
  'ferias': { tipo: 'ferias' },
  'outros': { tipo: 'outro' },
};

function classificarArquivo(subpasta: string, nomeArquivo: string): Classificacao {
  const s = norm(subpasta);
  const f = norm(nomeArquivo.replace(/\.[^.]+$/, ''));

  if (s === 'ponto' || s.startsWith('ponto ')) {
    return { skip: true, motivo: 'subpasta Ponto (frequência, não prontuário GT)' };
  }

  // Sinais fortes no nome do arquivo vencem a subpasta.
  // Tipos civis viram 'pessoal' + subtipo (modelo novo); OCR usa o subtipo.
  const regrasNome: Array<[RegExp, { tipo: string; subtipo?: string }]> = [
    [/passaport/, { tipo: 'passaporte' }],
    [/\bcnh\b|habilitacao/, { tipo: 'pessoal', subtipo: 'cnh' }],
    [/reservista/, { tipo: 'pessoal', subtipo: 'reservista' }],
    [/titulo.{0,3}eleitor/, { tipo: 'pessoal', subtipo: 'titulo_eleitor' }],
    [/\bctps\b|carteira de trabalho/, { tipo: 'pessoal', subtipo: 'ctps' }],
    [/certidao.{0,3}nascimento/, { tipo: 'pessoal', subtipo: 'certidao_nascimento' }],
    [/certidao.{0,3}casamento/, { tipo: 'pessoal', subtipo: 'certidao_casamento' }],
    [/\baso\b|admissional|periodico|mudanca.{0,3}funcao|exame ocupacional/, { tipo: 'aso' }],
    [/\bdemissional\b/, { tipo: 'aso', subtipo: 'demissional' }],
    [/laudo/, { tipo: 'laudo' }],
    [/contrato/, { tipo: 'contratual' }],
    [/\btrct\b|aviso.{0,3}previo|pedido.{0,3}desligamento|seguro.{0,3}desemprego|fgts rescisorio/, { tipo: 'demissional' }],
    [/aviso.{0,3}ferias|recibo.{0,3}ferias|formulario.{0,3}ferias/, { tipo: 'ferias' }],
    [/\brg\b|registro geral/, { tipo: 'pessoal', subtipo: 'rg' }],
    [/\bcpf\b/, { tipo: 'pessoal', subtipo: 'cpf' }],
    [/nr ?\d+|cbsp|huet|caerf|cess|tbs|stcw|certificado/, { tipo: 'treinamento' }],
  ];
  for (const [re, cls] of regrasNome) {
    if (re.test(f)) return { ...cls, motivo: `nome do arquivo (${re.source})` };
  }

  if (MAPA_SUBPASTA[s]) {
    return { ...MAPA_SUBPASTA[s], motivo: `subpasta "${subpasta}"` };
  }
  return { tipo: 'outro', motivo: 'fallback (subpasta desconhecida)' };
}

// ---------------------------------------------------------------------------
// Match com gt_colaboradores
// ---------------------------------------------------------------------------
interface ColabMin {
  id: string;
  nome_completo: string | null;
  cpf: string | null;
  matricula: string | null;
}

type MatchResult =
  | { status: 'matricula' | 'nome'; colab: ColabMin }
  | { status: 'ambiguo'; candidatos: ColabMin[] }
  | { status: 'quarentena'; motivo: string }
  | { status: 'nao_encontrado' };

function montarIndices(colabs: ColabMin[]) {
  const porMatricula = new Map<string, ColabMin>();
  const porMatriculaDigitos = new Map<string, ColabMin[]>();
  const porNome = new Map<string, ColabMin[]>();
  for (const c of colabs) {
    const mat = (c.matricula || '').trim();
    if (mat) {
      porMatricula.set(mat.toLowerCase(), c);
      const dig = mat.replace(/\D/g, '');
      if (dig) {
        const arr = porMatriculaDigitos.get(dig) || [];
        arr.push(c);
        porMatriculaDigitos.set(dig, arr);
      }
    }
    const n = norm(c.nome_completo || '');
    if (n) {
      const arr = porNome.get(n) || [];
      arr.push(c);
      porNome.set(n, arr);
    }
  }
  return { porMatricula, porMatriculaDigitos, porNome };
}

/**
 * Regra de ouro (2026-10): pasta COM matrícula que não casa NUNCA cai para
 * match por nome — era o vetor de documento gravado no colaborador errado.
 * Vai para quarentena para triagem manual. O fallback por nome só vale para
 * pasta sem matrícula parseável... que hoje nem vira pasta de colaborador —
 * mantido apenas via flag explícita --permite-fallback-nome.
 */
function casarColaborador(
  pasta: PastaColaborador,
  idx: ReturnType<typeof montarIndices>,
  permiteFallbackNome = false
): MatchResult {
  const mat = pasta.matricula.trim().toLowerCase();
  if (mat) {
    const porMat = idx.porMatricula.get(mat);
    if (porMat) return { status: 'matricula', colab: porMat };
    const dig = pasta.matricula.replace(/\D/g, '');
    if (dig) {
      const porDig = idx.porMatriculaDigitos.get(dig) || [];
      if (porDig.length === 1) return { status: 'matricula', colab: porDig[0] };
      if (porDig.length > 1) return { status: 'ambiguo', candidatos: porDig };
    }
    if (!permiteFallbackNome) {
      return {
        status: 'quarentena',
        motivo: `matrícula "${pasta.matricula}" sem correspondente em gt_colaboradores (fallback por nome desabilitado)`,
      };
    }
  }
  const n = norm(pasta.nome);
  const porNome = idx.porNome.get(n);
  if (porNome && porNome.length === 1) return { status: 'nome', colab: porNome[0] };
  if (porNome && porNome.length > 1) return { status: 'ambiguo', candidatos: porNome };
  return { status: 'nao_encontrado' };
}

// ---------------------------------------------------------------------------
// Scan do filesystem (UNC)
// ---------------------------------------------------------------------------
async function listarDirs(abs: string): Promise<fs.Dirent[]> {
  try {
    return await fs.promises.readdir(abs, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Pastas estruturais que podem conter colaboradores — qualquer outra é podada. */
const PASTA_ESTRUTURAL: RegExp[] = [
  /^abz servicos/i,
  /^clientes$/i,
  /^abz - /i,
  /^(\d+ - )?ativos$/i,
  /^(base|offshore|onshore|administrativo)$/i,
];

function ehPastaEstrutural(nome: string): boolean {
  return PASTA_ESTRUTURAL.some(re => re.test(norm(nome)));
}

/** Prefix match case-insensitive (normalizado) de caminho relativo contra exclusões. */
function caminhoExcluido(relNorm: string, exclusoes: string[]): boolean {
  return exclusoes.some(ex => relNorm === ex || relNorm.startsWith(`${ex}/`));
}

/**
 * BFS paralelo (pool de workers) pela árvore de Funcionários, descendo APENAS
 * em pastas estruturais. Pasta de pessoa só é aceita sob um ramo "Ativos".
 * `exclusoes` poda ramos inteiros (ex.: bases restritas) — prefix match.
 * Early-exit quando `limite` > 0 e já há pastas suficientes (uso em smoke sem --filtro).
 */
async function escanearPastasColaboradores(raizAbs: string, limite = 0, exclusoes: string[] = []): Promise<PastaColaborador[]> {
  const encontradas: PastaColaborador[] = [];
  const fila: Array<{ abs: string; rel: string; depth: number }> = [
    { abs: raizAbs, rel: '', depth: 0 },
  ];
  let processados = 0;
  let atingiuLimite = false;
  let podadas = 0;

  async function worker() {
    while (fila.length > 0 && !atingiuLimite) {
      const item = fila.shift();
      if (!item) break;
      const { abs, rel, depth } = item;
      if (depth > PROFUNDIDADE_MAX_SCAN) continue;
      const entradas = await listarDirs(abs);
      processados++;
      if (processados % 40 === 0) {
        console.log(`[dp-import] ...scan: ${processados} diretórios, ${encontradas.length} pastas de colaborador`);
      }
      for (const e of entradas) {
        if (!e.isDirectory()) continue;
        const filhoAbs = path.join(abs, e.name);
        const filhoRel = rel ? `${rel}/${e.name}` : e.name;
        const filhoRelNorm = norm(filhoRel);
        if (exclusoes.length > 0 && caminhoExcluido(filhoRelNorm, exclusoes)) {
          podadas++;
          if (podadas <= 20) console.log(`[dp-import] EXCL pasta podada: ${filhoRel}`);
          continue;
        }
        const parse = parsePastaColaborador(e.name);
        if (parse && /(^|\/)ativos(\/|$)/i.test(filhoRelNorm)) {
          encontradas.push({ caminhoAbs: filhoAbs, caminhoRel: filhoRel, nomePasta: e.name, ...parse });
          if (limite > 0 && encontradas.length >= limite) {
            atingiuLimite = true;
            break;
          }
          continue; // não desce dentro de pasta de colaborador
        }
        if (ehPastaEstrutural(e.name)) {
          fila.push({ abs: filhoAbs, rel: filhoRel, depth: depth + 1 });
        }
      }
    }
  }

  const WORKERS = 8;
  await Promise.all(Array.from({ length: WORKERS }, () => worker()));
  if (podadas > 0) console.log(`[dp-import] Pastas podadas por exclusão: ${podadas}`);
  return encontradas;
}

interface ArquivoEncontrado {
  abs: string;
  rel: string;          // relativo à pasta do colaborador
  subpasta: string;     // 1º nível sob a pasta do colaborador ('' se solto)
  nome: string;
  tamanho: number;
}

async function listarArquivosColaborador(pasta: PastaColaborador): Promise<ArquivoEncontrado[]> {
  const arquivos: ArquivoEncontrado[] = [];
  const fila: Array<{ abs: string; rel: string; depth: number }> = [
    { abs: pasta.caminhoAbs, rel: '', depth: 0 },
  ];
  while (fila.length > 0) {
    const { abs, rel, depth } = fila.shift()!;
    if (depth > PROFUNDIDADE_MAX_ARQUIVOS) continue;
    let entradas: fs.Dirent[] = [];
    try {
      entradas = await fs.promises.readdir(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      const filhoAbs = path.join(abs, e.name);
      const filhoRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        fila.push({ abs: filhoAbs, rel: filhoRel, depth: depth + 1 });
        continue;
      }
      if (!e.isFile()) continue;
      const nomeLower = e.name.toLowerCase();
      if (ARQUIVOS_IGNORADOS[nomeLower] || nomeLower.startsWith('~$')) continue;
      const ext = path.extname(nomeLower);
      if (!EXTENSOES_OK[ext]) continue;
      let tamanho = 0;
      try {
        tamanho = (await fs.promises.stat(filhoAbs)).size;
      } catch {
        continue;
      }
      if (tamanho <= 0 || tamanho > TAMANHO_MAX_ARQUIVO) continue;
      arquivos.push({
        abs: filhoAbs,
        rel: filhoRel,
        subpasta: rel ? rel.split('/')[0] : '',
        nome: e.name,
        tamanho,
      });
    }
  }
  return arquivos;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
interface RelatorioArquivo {
  arquivo: string;
  tipo: string | null;
  classificacao: string;
  acao: 'importado' | 'mesclado' | 'ja_existia' | 'skip' | 'erro' | 'simulado';
  documento_id?: string;
  ocr?: 'concluido' | 'erro' | 'pulado' | 'simulado';
  identity_match?: string | null;
  erro?: string;
}
interface RelatorioPasta {
  pasta: string;
  nome_parse: string;
  cargo_parse: string;
  matricula_parse: string;
  match: string;
  colaborador_id?: string;
  colaborador_nome?: string;
  arquivos: RelatorioArquivo[];
}

async function main() {
  const inicio = Date.now();
  console.log(`[dp-import] Modo: ${APLICAR ? 'APPLY (grava no banco/storage)' : 'DRY-RUN (simulação)'}${SEM_OCR ? ' | sem OCR' : ''}`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  }

  // Imports pesados SÓ depois do dotenv (supabaseAdmin lê env no module load)
  const { supabaseAdmin } = await import('@/lib/supabase');
  const integrity = await import('@/lib/gestao-tripulantes/documento-integrity');
  const ocrLib = SEM_OCR ? null : await import('@/lib/ocr');
  const ocrGt = SEM_OCR ? null : await import('@/lib/gestao-tripulantes/ocr-processor');

  // 0) Kill-switch de pausa (gt_configuracoes.dp_import_enabled = false)
  const { getConfig } = await import('@/lib/gestao-tripulantes/config-service');
  const cfgHabilitado = await getConfig('dp_import_enabled');
  if (cfgHabilitado.success && cfgHabilitado.data === false) {
    const msg = '[dp-import] PAUSADO: gt_configuracoes.dp_import_enabled = false.';
    if (APLICAR) {
      console.error(`${msg} Abortando --apply (robô em pausa até correção do matching).`);
      process.exit(2);
    }
    console.warn(`${msg} Prosseguindo apenas em DRY-RUN.`);
  }

  // 1) Conexão SMB → raiz UNC
  const { data: conexao, error: errCon } = await supabaseAdmin
    .from('smb_connections')
    .select('id, name, local_path, base_path, is_active, excluded_paths')
    .eq('id', CONEXAO_ID)
    .maybeSingle();
  if (errCon || !conexao?.local_path) {
    throw new Error(`Conexão SMB ${CONEXAO_ID} não encontrada ou sem local_path`);
  }
  if (conexao.is_active === false) {
    const msg = '[dp-import] Conexão SMB com is_active=false (pausada).';
    if (APLICAR) {
      console.error(`${msg} Abortando --apply.`);
      process.exit(2);
    }
    console.warn(`${msg} Prosseguindo apenas em DRY-RUN.`);
  }
  const raizUnc = String(conexao.local_path).replace(/[\\/]+$/, '');
  const raizScan = path.join(raizUnc, RAIZ_FUNCIONARIOS);
  console.log(`[dp-import] Raiz de scan: ${raizScan}`);

  // Exclusões de ramos (bases/pastas restritas): banco (excluded_paths) + CLI.
  // Aceita caminho relativo ao local_path OU à raiz de Funcionários (prefixo removido).
  const prefixoRaiz = norm(RAIZ_FUNCIONARIOS.replace(/[\\/]+/g, '/')) + '/';
  const exclBanco: string[] = Array.isArray(conexao.excluded_paths) ? conexao.excluded_paths.map(String) : [];
  const exlusoes = [...exclBanco, ...EXCLUIR_CLI]
    .map(e => norm(e.replace(/^[\\/]+|[\\/]+$/g, '').replace(/[\\/]+/g, '/')))
    .map(e => (e.startsWith(prefixoRaiz) ? e.slice(prefixoRaiz.length) : e))
    .filter(Boolean);
  if (exlusoes.length > 0) {
    console.log(`[dp-import] Exclusões ativas (${exlusoes.length}): ${exlusoes.join(' | ')}`);
  }

  // 2) Carregar colaboradores (paginado — PostgREST trunca em 1000)
  const colabs: ColabMin[] = [];
  const PAG = 1000;
  for (let from = 0; ; from += PAG) {
    const { data, error } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id, nome_completo, cpf, matricula')
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .range(from, from + PAG - 1);
    if (error) throw new Error(`Erro lendo gt_colaboradores: ${error.message}`);
    colabs.push(...(data || []));
    if (!data || data.length < PAG) break;
  }
  console.log(`[dp-import] Colaboradores carregados: ${colabs.length}`);
  const indices = montarIndices(colabs);

  // 3) Scan das pastas de colaborador (early-exit no limit quando não há --filtro)
  const pastas = await escanearPastasColaboradores(raizScan, FILTRO_PASTA ? 0 : LIMIT_PASTAS, exlusoes);
  console.log(`[dp-import] Pastas de colaborador encontradas: ${pastas.length}`);

  let selecionadas = pastas;
  if (FILTRO_PASTA) {
    selecionadas = selecionadas.filter(p => norm(p.nomePasta).includes(norm(FILTRO_PASTA)));
    console.log(`[dp-import] Filtro "${FILTRO_PASTA}": ${selecionadas.length} pastas`);
  }
  if (LIMIT_PASTAS > 0) selecionadas = selecionadas.slice(0, LIMIT_PASTAS);

  // 4) Processar
  const relatorio: RelatorioPasta[] = [];
  const naoEncontradas: Array<{ pasta: string; nome: string; matricula: string }> = [];
  const ambiguas: Array<{ pasta: string; nome: string; candidatos: number }> = [];
  const quarentenaMatch: Array<{ pasta: string; nome: string; matricula: string; motivo: string }> = [];
  let arquivosGravados = 0;
  const totais = {
    pastas: 0, matchMatricula: 0, matchNome: 0, ambiguas: 0, naoEncontradas: 0, quarentenaMatch: 0,
    arquivos: 0, importados: 0, mesclados: 0, jaExistiam: 0, skips: 0, erros: 0,
    ocrConcluido: 0, ocrErro: 0, quarentena: 0,
  };

  for (const pasta of selecionadas) {
    totais.pastas++;
    const match = casarColaborador(pasta, indices, PERMITE_FALLBACK_NOME);
    const relPasta: RelatorioPasta = {
      pasta: pasta.caminhoRel,
      nome_parse: pasta.nome,
      cargo_parse: pasta.cargo,
      matricula_parse: pasta.matricula,
      match: match.status,
      arquivos: [],
    };

    if (match.status === 'quarentena') {
      totais.quarentenaMatch++;
      quarentenaMatch.push({ pasta: pasta.caminhoRel, nome: pasta.nome, matricula: pasta.matricula, motivo: match.motivo });
      console.warn(`[dp-import] QUARENTENA ${pasta.nomePasta} → ${match.motivo}`);
      relatorio.push(relPasta);
      continue;
    }
    if (match.status === 'nao_encontrado') {
      totais.naoEncontradas++;
      naoEncontradas.push({ pasta: pasta.caminhoRel, nome: pasta.nome, matricula: pasta.matricula });
      relatorio.push(relPasta);
      continue;
    }
    if (match.status === 'ambiguo') {
      totais.ambiguas++;
      ambiguas.push({ pasta: pasta.caminhoRel, nome: pasta.nome, candidatos: match.candidatos.length });
      relatorio.push(relPasta);
      continue;
    }

    const colab = match.colab;
    if (match.status === 'matricula') totais.matchMatricula++; else totais.matchNome++;
    relPasta.colaborador_id = colab.id;
    relPasta.colaborador_nome = colab.nome_completo || undefined;

    const arquivos = await listarArquivosColaborador(pasta);
    const profileCpf = (colab.cpf || '').replace(/\D/g, '') || null;

    for (const arq of arquivos) {
      if (APLICAR && MAX_ARQUIVOS > 0 && arquivosGravados >= MAX_ARQUIVOS) break;
      totais.arquivos++;
      const cls = classificarArquivo(arq.subpasta, arq.nome);
      const relArq: RelatorioArquivo = {
        arquivo: arq.rel,
        tipo: 'skip' in cls ? null : cls.tipo,
        classificacao: cls.motivo,
        acao: 'simulado',
      };
      relPasta.arquivos.push(relArq);

      if ('skip' in cls) {
        relArq.acao = 'skip';
        totais.skips++;
        continue;
      }
      const tipo = cls.tipo;
      const subtipo = 'subtipo' in cls ? cls.subtipo || null : null;
      const titulo = arq.nome.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim().slice(0, 180) || 'Documento';

      if (!APLICAR) continue; // dry-run: só reporta classificação

      try {
        const buffer = await fs.promises.readFile(arq.abs);
        const mime = integrity.resolverMimeArquivo(arq.nome, '', buffer);
        if (!mime) {
          relArq.acao = 'erro';
          relArq.erro = 'MIME não permitido';
          totais.erros++;
          continue;
        }
        const hash = integrity.calcularArquivoHash(buffer);

        const duplicado = await integrity.buscarDuplicado({
          colaborador_id: colab.id,
          tipo_documento: tipo,
          titulo,
          arquivo_hash: hash,
        });

        if (duplicado && duplicado.arquivo_hash === hash) {
          relArq.acao = 'ja_existia';
          relArq.documento_id = duplicado.id;
          totais.jaExistiam++;
          continue;
        }

        const ext = path.extname(arq.nome).slice(1) || 'pdf';
        const filePath = `gestao-tripulantes/${colab.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(filePath, buffer, { contentType: mime, upsert: false });
        if (upErr) throw new Error(`storage: ${upErr.message}`);
        const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
        const arquivo_url = urlData?.publicUrl || '';

        let documentoId: string;
        if (duplicado) {
          // merge: atualiza a linha existente com o novo arquivo
          const { error: updErr } = await supabaseAdmin
            .from('gt_documentos')
            .update({
              arquivo_path: filePath,
              arquivo_url,
              arquivo_tamanho_bytes: arq.tamanho,
              arquivo_tipo: mime,
              arquivo_hash: hash,
              updated_at: new Date().toISOString(),
            })
            .eq('id', duplicado.id);
          if (updErr) throw new Error(`update duplicado: ${updErr.message}`);
          documentoId = duplicado.id;
          relArq.acao = 'mesclado';
          totais.mesclados++;
        } else {
          const numero_rastreio = await integrity.garantirNumeroRastreioUnico(tipo, colab.cpf);
          const { data: doc, error: insErr } = await supabaseAdmin
            .from('gt_documentos')
            .insert({
              colaborador_id: colab.id,
              tipo_documento: tipo,
              subtipo,
              titulo,
              descricao: `Importado do fileserver: ${pasta.caminhoRel}/${arq.rel}`,
              arquivo_url,
              arquivo_path: filePath,
              arquivo_tamanho_bytes: arq.tamanho,
              arquivo_tipo: mime,
              arquivo_hash: hash,
              numero_rastreio,
              origem: 'importado',
              ocr_status: 'pendente',
              status_validacao: integrity.calcularStatusValidacaoPorValidade(null, { tipoDocumento: tipo }),
              notificado_vencimento: false,
              status_revisao: 'nao_necessita',
              identity_match: 'unknown',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (insErr) {
            await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
            throw new Error(`insert: ${insErr.message}`);
          }
          documentoId = doc.id;
          relArq.acao = 'importado';
          totais.importados++;
        }
        arquivosGravados++;
        relArq.documento_id = documentoId;

        // ---- OCR (mesmo fluxo da rota /documentos/[id]/ocr) ---------------
        if (SEM_OCR || !ocrLib || !ocrGt) {
          relArq.ocr = 'pulado';
        } else {
          try {
            await supabaseAdmin
              .from('gt_documentos')
              .update({ ocr_status: 'processando', updated_at: new Date().toISOString() })
              .eq('id', documentoId);

            const result = await ocrLib.processarDocumentoOCR(
              arquivo_url,
              integrity.tipoParaOcr(tipo, subtipo) as import('@/types/ocr').OCRTipoDocumento,
              profileCpf
            );
            if (!result.success || !result.data) {
              throw new Error(result.error || 'Falha no OCR');
            }

            await supabaseAdmin
              .from('gt_documentos')
              .update({
                ocr_status: 'concluido',
                ocr_texto: result.data.texto,
                ocr_dados_extraidos: result.data.dadosExtraidos,
                ocr_data: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', documentoId);

            if (tipo === 'aso') {
              await ocrGt.extrairDadosASODoTexto(
                documentoId,
                result.data.texto,
                result.data.dadosExtraidos,
                colab.id,
                null
              );
              const { data: asoRow } = await supabaseAdmin
                .from('gt_documentos_aso')
                .select('identity_match')
                .eq('documento_id', documentoId)
                .maybeSingle();
              if (asoRow?.identity_match) {
                await supabaseAdmin
                  .from('gt_documentos')
                  .update({ identity_match: asoRow.identity_match, updated_at: new Date().toISOString() })
                  .eq('id', documentoId);
                relArq.identity_match = asoRow.identity_match;
              }
              await ocrGt.persistirCamposOcrDocumento(documentoId, 'aso', result.data.dadosExtraidos, result.data.texto);
            } else {
              const gate = await ocrGt.aplicarGateIdentidadeDocumento(
                documentoId,
                result.data.texto,
                result.data.dadosExtraidos,
                colab.id
              );
              relArq.identity_match = gate.identityMatch;
            }

            relArq.ocr = 'concluido';
            totais.ocrConcluido++;
            if (relArq.identity_match === 'quarantine') totais.quarentena++;
          } catch (ocrErr) {
            const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
            await supabaseAdmin
              .from('gt_documentos')
              .update({ ocr_status: 'erro', ocr_erro: msg.slice(0, 500), updated_at: new Date().toISOString() })
              .eq('id', documentoId);
            relArq.ocr = 'erro';
            relArq.erro = `OCR: ${msg.slice(0, 200)}`;
            totais.ocrErro++;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        relArq.acao = 'erro';
        relArq.erro = msg.slice(0, 300);
        totais.erros++;
      }
    }

    relatorio.push(relPasta);
    const ok = relPasta.arquivos.filter(a => a.acao === 'importado' || a.acao === 'mesclado').length;
    console.log(
      `[dp-import] ${match.status === 'matricula' ? 'MAT' : 'NOM'} ${pasta.nome} (${pasta.matricula}) → ${colab.nome_completo} | arquivos: ${arquivos.length}, gravados: ${ok}`
    );
  }

  // 5) Relatório
  const resumo = {
    gerado_em: new Date().toISOString(),
    modo: APLICAR ? 'apply' : 'dry-run',
    sem_ocr: SEM_OCR,
    permite_fallback_nome: PERMITE_FALLBACK_NOME,
    exclusoes: exlusoes,
    duracao_ms: Date.now() - inicio,
    conexao_id: CONEXAO_ID,
    raiz_scan: raizScan,
    colaboradores_base: colabs.length,
    pastas_encontradas: pastas.length,
    pastas_processadas: selecionadas.length,
    totais,
    quarentena_match: quarentenaMatch,
    nao_encontradas: naoEncontradas,
    ambiguas,
    pastas: relatorio,
  };

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(resumo, null, 2), 'utf8');

  // CSV de triagem da quarentena de match (matrícula sem correspondente)
  if (quarentenaMatch.length > 0) {
    const csvPath = SAIDA.replace(/\.json$/i, '.quarentena.csv');
    const linhas = ['pasta;nome_parse;matricula_parse;motivo'];
    for (const q of quarentenaMatch) {
      linhas.push([q.pasta, q.nome, q.matricula, q.motivo].map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'));
    }
    fs.writeFileSync(csvPath, linhas.join('\n'), 'utf8');
    console.log(`[dp-import] CSV de quarentena: ${csvPath}`);
  }

  console.log('\n===== RESUMO dp-import =====');
  console.log(`Modo: ${APLICAR ? 'APPLY' : 'DRY-RUN'} | Pastas: ${totais.pastas} (matrícula: ${totais.matchMatricula}, nome: ${totais.matchNome}, ambíguas: ${totais.ambiguas}, quarentena-match: ${totais.quarentenaMatch}, não encontradas: ${totais.naoEncontradas})`);
  console.log(`Arquivos: ${totais.arquivos} | importados: ${totais.importados} | mesclados: ${totais.mesclados} | já existiam: ${totais.jaExistiam} | skips: ${totais.skips} | erros: ${totais.erros}`);
  if (APLICAR && !SEM_OCR) {
    console.log(`OCR: ${totais.ocrConcluido} concluído, ${totais.ocrErro} erro | quarentena: ${totais.quarentena}`);
  }
  console.log(`Relatório: ${SAIDA}`);
}

main().catch(err => {
  console.error('[dp-import] ERRO FATAL:', err);
  process.exit(1);
});
