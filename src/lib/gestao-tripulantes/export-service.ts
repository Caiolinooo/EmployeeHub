import JSZip from 'jszip';
import { supabaseAdmin } from '@/lib/supabase';
import { getConfig, updateConfig } from '@/lib/gestao-tripulantes/config-service';

/**
 * Serviço de exportação organizada (zip) de documentos e dados do módulo
 * Gestão de Tripulantes.
 *
 * - Monta um .zip server-side com pasta por funcionário, documentos baixados
 *   do Supabase Storage no formato ORIGINAL (extensão/conteúdo preservados),
 *   e resumo JSON + CSV por funcionário (e um resumo geral).
 * - Hierarquia de pastas configurável via template com placeholders:
 *   {empresa} {centro_custo} {funcionario} {cpf} {cargo} {tipo_documento} {ano}
 * - Template persistido em gt_configuracoes.chave = 'gt_export_template'.
 */

export const GT_EXPORT_TEMPLATE_KEY = 'gt_export_template';

export const DEFAULT_EXPORT_TEMPLATE = 'empresa/centro_custo/funcionario/tipo_documento';

export const TEMPLATE_PLACEHOLDERS = [
  'empresa',
  'centro_custo',
  'funcionario',
  'cpf',
  'cargo',
  'tipo_documento',
  'ano',
] as const;

export const EXPORT_TEMPLATE_PRESETS: { id: string; label: string; template: string }[] = [
  { id: 'padrao', label: 'Empresa > Centro de Custo > Funcionário > Tipo', template: 'empresa/centro_custo/funcionario/tipo_documento' },
  { id: 'por_funcionario', label: 'Funcionário > Tipo', template: 'funcionario/tipo_documento' },
  { id: 'por_ano', label: 'Ano > Empresa > Funcionário', template: 'ano/empresa/funcionario' },
  { id: 'plano', label: 'Empresa > Funcionário > Ano > Tipo', template: 'empresa/funcionario/ano/tipo_documento' },
];

/** Limites anti-estouro-de-memória */
export const MAX_FUNCIONARIOS_PADRAO = 50;
export const MAX_FUNCIONARIOS_HARD = 200;
export const MAX_ARQUIVO_BYTES = 25 * 1024 * 1024; // 25 MB por arquivo individual
export const MAX_TOTAL_BYTES = 250 * 1024 * 1024; // 250 MB por requisição

const PLACEHOLDER_RE = /\{(empresa|centro_custo|funcionario|cpf|cargo|tipo_documento|ano)\}/g;

/** Remove caracteres inválidos em nomes de arquivo/pasta Windows. */
export function sanitizarNome(input: string | null | undefined, fallback = '_'): string {
  let s = (input ?? '').toString().normalize('NFC');
  s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, ''); // inválidos no Windows
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/[. ]+$/g, ''); // sem ponto/espaço no fim (Windows)
  s = s.replace(/^\.+/, '');
  if (!s) s = fallback;
  return s.slice(0, 100);
}

/** Valida/normaliza o template. Retorna template seguro (segmentos sanitizados). */
export function normalizarTemplate(template: string | null | undefined): {
  ok: boolean;
  template: string;
  erro?: string;
} {
  const raw = (template ?? '').trim() || DEFAULT_EXPORT_TEMPLATE;
  const segmentos = raw.split('/').map((s) => s.trim()).filter(Boolean);
  if (segmentos.length === 0) return { ok: false, template: DEFAULT_EXPORT_TEMPLATE, erro: 'Template vazio.' };
  if (segmentos.length > 6) return { ok: false, template: DEFAULT_EXPORT_TEMPLATE, erro: 'Máximo de 6 níveis de pasta.' };
  for (const seg of segmentos) {
    const placeholders = seg.match(PLACEHOLDER_RE);
    const resto = seg.replace(PLACEHOLDER_RE, '').replace(/[{}]/g, '');
    if (!placeholders || placeholders.length === 0) {
      if (sanitizarNome(resto) === '_') {
        return { ok: false, template: DEFAULT_EXPORT_TEMPLATE, erro: `Segmento "${seg}" não contém placeholder válido.` };
      }
      // texto literal é permitido como nível fixo (ex.: "Documentos")
      continue;
    }
    if (placeholders.length > 1 && resto.trim() !== '') {
      // ex.: "{funcionario}-{cpf}" — permitido
      continue;
    }
  }
  const temFuncionario = segmentos.some((s) => s.includes('{funcionario}') || s.includes('{cpf}'));
  if (!temFuncionario) {
    segmentos.push('{funcionario}');
  }
  return { ok: true, template: segmentos.join('/') };
}

export async function getExportTemplate(): Promise<string> {
  const res = await getConfig(GT_EXPORT_TEMPLATE_KEY);
  const valor = typeof res.data === 'string' ? res.data : null;
  return normalizarTemplate(valor).template;
}

export async function saveExportTemplate(template: string): Promise<{ success: boolean; template?: string; error?: string }> {
  const norm = normalizarTemplate(template);
  if (!norm.ok) return { success: false, error: norm.erro };
  const res = await updateConfig(GT_EXPORT_TEMPLATE_KEY, norm.template);
  if (!res.success) return { success: false, error: res.error };
  return { success: true, template: norm.template };
}

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface ColabRow {
  id: string;
  nome_completo: string;
  cpf?: string | null;
  matricula?: string | null;
  empresa_id?: string | null;
  centro_custo_id?: string | null;
  cargo_id?: string | null;
  empresa_nome?: string | null;
  centro_custo_nome?: string | null;
  cargo_nome?: string | null;
}

interface DocRow {
  id: string;
  colaborador_id: string;
  tipo_documento: string;
  subtipo?: string | null;
  titulo: string;
  numero_documento?: string | null;
  orgao_emissor?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  numero_rastreio?: string | null;
  status_validacao?: string | null;
  arquivo_path?: string | null;
  arquivo_url?: string | null;
  arquivo_tamanho_bytes?: number | null;
  created_at?: string | null;
}

function extDePath(path: string): string {
  const base = path.split('/').pop() || path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  const ext = base.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? `.${ext}` : '';
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------------------------------------------------------------------
// Consulta de funcionários + documentos
// ---------------------------------------------------------------------------

export interface ExportFilters {
  /** ids ou nomes (parciais), separados por vírgula */
  funcionarios?: string[];
  empresa?: string; // id ou nome (parcial)
  centroCusto?: string; // id ou nome (parcial)
}

async function carregarLookups(): Promise<{
  empresas: Map<string, string>;
  centros: Map<string, string>;
  cargos: Map<string, string>;
}> {
  const [emp, cen, car] = await Promise.all([
    supabaseAdmin.from('gt_empresas').select('id, nome'),
    supabaseAdmin.from('gt_centros_custo').select('id, nome'),
    supabaseAdmin.from('gt_cargos').select('id, nome'),
  ]);
  const map = <T extends { id: string; nome?: string | null }>(rows: T[] | null | undefined, nameKey = 'nome') => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) m.set(r.id, (r as Record<string, string | null | undefined>)[nameKey] || '');
    return m;
  };
  return {
    empresas: map(emp.data),
    centros: map(cen.data),
    cargos: map(car.data),
  };
}

export async function buscarColaboradoresFiltrados(
  filters: ExportFilters
): Promise<{ success: boolean; data?: ColabRow[]; error?: string }> {
  try {
    const lookups = await carregarLookups();

    let query = supabaseAdmin
      .from('gt_colaboradores')
      .select('id, nome_completo, cpf, matricula, empresa_id, centro_custo_id, cargo_id')
      .is('deleted_at', null)
      .order('nome_completo');

    if (filters.funcionarios?.length) {
      const ids: string[] = [];
      const nomes: string[] = [];
      for (const f of filters.funcionarios.map((s) => s.trim()).filter(Boolean)) {
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        (uuidRe.test(f) ? ids : nomes).push(f);
      }
      if (ids.length && nomes.length) {
        query = query.or(`id.in.(${ids.join(',')}),or(${nomes.map((n) => `nome_completo.ilike.%${n}%`).join(',')})`);
      } else if (ids.length) {
        query = query.in('id', ids);
      } else if (nomes.length) {
        query = query.or(nomes.map((n) => `nome_completo.ilike.%${n}%`).join(','));
      }
    }

    const resolveId = (param: string | undefined, lookup: Map<string, string>): string[] | null => {
      if (!param) return null;
      const p = param.trim();
      if (lookup.has(p)) return [p];
      const needle = p.toLowerCase();
      const ids = [...lookup.entries()]
        .filter(([, nome]) => nome.toLowerCase().includes(needle))
        .map(([id]) => id);
      return ids;
    };

    const empIds = resolveId(filters.empresa, lookups.empresas);
    if (empIds) {
      if (empIds.length === 0) return { success: true, data: [] };
      query = query.in('empresa_id', empIds);
    }
    const cenIds = resolveId(filters.centroCusto, lookups.centros);
    if (cenIds) {
      if (cenIds.length === 0) return { success: true, data: [] };
      query = query.in('centro_custo_id', cenIds);
    }

    const { data, error } = await query.limit(MAX_FUNCIONARIOS_HARD * 2);
    if (error) return { success: false, error: error.message };

    const rows: ColabRow[] = (data ?? []).map((c: any) => ({
      ...c,
      empresa_nome: c.empresa_id ? lookups.empresas.get(c.empresa_id) || null : null,
      centro_custo_nome: c.centro_custo_id ? lookups.centros.get(c.centro_custo_id) || null : null,
      cargo_nome: c.cargo_id ? lookups.cargos.get(c.cargo_id) || null : null,
    }));
    return { success: true, data: rows };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao buscar colaboradores' };
  }
}

export async function buscarDocumentos(colaboradorIds: string[]): Promise<DocRow[]> {
  const all: DocRow[] = [];
  const CHUNK = 100;
  for (let i = 0; i < colaboradorIds.length; i += CHUNK) {
    const chunk = colaboradorIds.slice(i, i + CHUNK);
    const { data, error } = await supabaseAdmin
      .from('gt_documentos')
      .select(
        'id, colaborador_id, tipo_documento, subtipo, titulo, numero_documento, orgao_emissor, data_emissao, data_validade, numero_rastreio, status_validacao, arquivo_path, arquivo_url, arquivo_tamanho_bytes, created_at'
      )
      .in('colaborador_id', chunk)
      .is('deleted_at', null)
      .order('data_emissao', { ascending: true });
    if (!error && data) all.push(...(data as DocRow[]));
  }
  return all;
}

// ---------------------------------------------------------------------------
// Montagem do zip
// ---------------------------------------------------------------------------

export interface BuildZipOptions {
  template: string;
  maxFuncionarios?: number;
}

export interface BuildZipResult {
  buffer: Buffer;
  totalFuncionarios: number;
  totalDocumentos: number;
  avisos: string[];
}

function preencherTemplate(
  template: string,
  vars: Partial<Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>>,
  docVars?: Partial<Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>>
): string[] {
  const merged = { ...vars, ...(docVars ?? {}) };
  return template.split('/').map((seg) =>
    sanitizarNome(seg.replace(PLACEHOLDER_RE, (_m, key) => merged[key as keyof typeof merged] || '_'))
  );
}

function linhasResumoDoc(d: DocRow): Record<string, string> {
  return {
    tipo_documento: d.tipo_documento,
    subtipo: d.subtipo || '',
    titulo: d.titulo,
    numero_documento: d.numero_documento || '',
    orgao_emissor: d.orgao_emissor || '',
    data_emissao: d.data_emissao || '',
    data_validade: d.data_validade || '',
    numero_rastreio: d.numero_rastreio || '',
    status_validacao: d.status_validacao || '',
    possui_arquivo: d.arquivo_path ? 'sim' : 'nao',
  };
}

const RESUMO_DOC_HEADERS = [
  'tipo_documento', 'subtipo', 'titulo', 'numero_documento', 'orgao_emissor',
  'data_emissao', 'data_validade', 'numero_rastreio', 'status_validacao', 'possui_arquivo',
];

function csvFromDocs(docs: DocRow[]): string {
  const lines = [RESUMO_DOC_HEADERS.join(';')];
  for (const d of docs) {
    const row = linhasResumoDoc(d);
    lines.push(RESUMO_DOC_HEADERS.map((h) => csvEscape(row[h])).join(';'));
  }
  return '\uFEFF' + lines.join('\r\n');
}

export async function buildExportZip(
  filters: ExportFilters,
  options: BuildZipOptions
): Promise<
  | { success: true; result: BuildZipResult }
  | { success: false; error: string; status?: number }
> {
  const maxFunc = Math.min(
    Math.max(options.maxFuncionarios ?? MAX_FUNCIONARIOS_PADRAO, 1),
    MAX_FUNCIONARIOS_HARD
  );
  const normTpl = normalizarTemplate(options.template);

  const colRes = await buscarColaboradoresFiltrados(filters);
  if (!colRes.success) return { success: false, error: colRes.error || 'Erro ao buscar colaboradores' };
  let colaboradores = colRes.data ?? [];

  const avisos: string[] = [];
  if (colaboradores.length === 0) {
    return { success: false, error: 'Nenhum funcionário encontrado para os filtros informados.', status: 404 };
  }
  if (colaboradores.length > maxFunc) {
    return {
      success: false,
      status: 413,
      error: `${colaboradores.length} funcionários correspondem aos filtros — acima do limite de ${maxFunc} por exportação. Refine os filtros (nome, empresa ou centro de custo) ou aumente o limite via parâmetro "limite" (máximo ${MAX_FUNCIONARIOS_HARD}).`,
    };
  }

  const docs = await buscarDocumentos(colaboradores.map((c) => c.id));
  const docsPorColab = new Map<string, DocRow[]>();
  for (const d of docs) {
    const arr = docsPorColab.get(d.colaborador_id) || [];
    arr.push(d);
    docsPorColab.set(d.colaborador_id, arr);
  }

  const zip = new JSZip();
  const anoAtual = String(new Date().getFullYear());
  const usadosGlobais = new Set<string>();
  let totalDocsComArquivo = 0;
  let totalBytes = 0;
  const resumoGeral: Record<string, unknown>[] = [];

  for (const colab of colaboradores) {
    const baseVars = {
      empresa: sanitizarNome(colab.empresa_nome, 'Sem_Empresa').replace(/\s/g, '_'),
      centro_custo: sanitizarNome(colab.centro_custo_nome, 'Sem_CC').replace(/\s/g, '_'),
      funcionario: sanitizarNome(colab.nome_completo, 'Sem_Nome').replace(/\s/g, '_'),
      cpf: sanitizarNome((colab.cpf || '').replace(/\D/g, ''), 'Sem_CPF') || 'Sem_CPF',
      cargo: sanitizarNome(colab.cargo_nome, 'Sem_Cargo').replace(/\s/g, '_'),
      ano: anoAtual,
    };

    const docsColab = docsPorColab.get(colab.id) || [];

    // --- resumo JSON + CSV por funcionário -------------------------------
    const resumoJson = {
      matricula: colab.matricula || null,
      cpf: colab.cpf || null,
      cargo: colab.cargo_nome || null,
      empresa: colab.empresa_nome || null,
      centro_de_custo: colab.centro_custo_nome || null,
      total_documentos: docsColab.length,
      documentos: docsColab.map(linhasResumoDoc),
      gerado_em: new Date().toISOString(),
    };
    const csvContent = csvFromDocs(docsColab);

    // Pasta-base do funcionário: prefixo do template até o nível que contém
    // {funcionario}; se não houver, o último nível já é {funcionario}
    // (garantido por normalizarTemplate).
    const segsBase = normTpl.template.split('/');
    const idxFunc = Math.max(segsBase.findIndex((s) => s.includes('{funcionario}')), 0);
    const pastaFuncionario = preencherTemplate(segsBase.slice(0, idxFunc + 1).join('/'), baseVars).join('/');

    zip.file(`${pastaFuncionario}/resumo.json`, JSON.stringify(resumoJson, null, 2));
    zip.file(`${pastaFuncionario}/resumo.csv`, csvContent);

    // --- documentos --------------------------------------------------------
    const nomesUsados = new Set<string>();
    for (const d of docsColab) {
      const docVars: Partial<Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>> = {};
      if (normTpl.template.split('/').some((s) => s.includes('{tipo_documento}')) || true) {
        docVars.tipo_documento = sanitizarNome(d.tipo_documento, 'documento').replace(/\s/g, '_');
        docVars.ano = d.data_emissao ? d.data_emissao.slice(0, 4) : d.created_at ? d.created_at.slice(0, 4) : anoAtual;
      }
      const dirSegs = preencherTemplate(normTpl.template, baseVars, docVars).slice(0, -1);
      const dirPath = dirSegs.join('/');

      if (!d.arquivo_path) {
        continue;
      }

      const nomeBase = sanitizarNome(
        [d.numero_rastreio || d.numero_documento, d.titulo].filter(Boolean).join(' - ') || d.tipo_documento
      ).replace(/\s/g, '_');
      const ext = extDePath(d.arquivo_path);
      let nomeArquivo = `${nomeBase}${ext}`;
      let n = 2;
      while (nomesUsados.has(nomeArquivo)) {
        nomeArquivo = `${nomeBase}_${n++}${ext}`;
      }
      nomesUsados.add(nomeArquivo);

      if (d.arquivo_tamanho_bytes && d.arquivo_tamanho_bytes > MAX_ARQUIVO_BYTES) {
        avisos.push(`Arquivo ignorado (>25MB): ${colab.nome_completo} / ${d.titulo}`);
        continue;
      }
      if (totalBytes + (d.arquivo_tamanho_bytes || 0) > MAX_TOTAL_BYTES) {
        avisos.push(`Limite de ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB atingido — exportação truncada.`);
        break;
      }

      try {
        const { data: blob, error: dlErr } = await supabaseAdmin.storage
          .from('gestao-tripulantes-documentos')
          .download(d.arquivo_path);
        if (dlErr || !blob) {
          avisos.push(`Falha ao baixar: ${colab.nome_completo} / ${d.titulo}: ${dlErr?.message || 'sem conteúdo'}`);
          continue;
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        zip.file(`${dirPath}/${nomeArquivo}`, buf, { binary: true });
        totalBytes += buf.length;
        totalDocsComArquivo++;
      } catch (e) {
        avisos.push(`Erro inesperado baixando ${d.arquivo_path}: ${e instanceof Error ? e.message : e}`);
      }
    }

    resumoGeral.push({
      matricula: colab.matricula || null,
      cpf: colab.cpf || null,
      nome: colab.nome_completo,
      cargo: colab.cargo_nome || null,
      empresa: colab.empresa_nome || null,
      centro_de_custo: colab.centro_custo_nome || null,
      pasta_zip: pastaFuncionario,
      total_documentos: docsColab.length,
    });
  }

  // --- resumo geral na raiz do zip -----------------------------------------
  zip.file('_export/resumo_geral.json', JSON.stringify({ gerado_em: new Date().toISOString(), filtros: filters, funcionarios: resumoGeral }, null, 2));
  const gcsv = ['matricula;cpf;nome;cargo;empresa;centro_de_custo;pasta_zip;total_documentos'];
  for (const r of resumoGeral) {
    gcsv.push([r.matricula, r.cpf, r.nome, r.cargo, r.empresa, r.centro_de_custo, r.pasta_zip, r.total_documentos].map(csvEscape).join(';'));
  }
  zip.file('_export/resumo_geral.csv', '\uFEFF' + gcsv.join('\r\n'));
  if (avisos.length) {
    zip.file('_export/avisos.txt', avisos.join('\n'));
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 3 }, // leve: a maioria dos docs já é comprimida (pdf)
  });

  return {
    success: true,
    result: {
      buffer,
      totalFuncionarios: colaboradores.length,
      totalDocumentos: totalDocsComArquivo,
      avisos,
    },
  };
}

/** Preview da árvore de pastas sem baixar arquivos do Storage. */
export async function previewExportTree(
  filters: ExportFilters,
  template: string
): Promise<
  | {
      success: true;
      template: string;
      total_funcionarios: number;
      total_documentos: number;
      total_sem_arquivo: number;
      tree: { path: string; arquivos: string[] }[];
      avisos: string[];
    }
  | { success: false; error: string; status?: number }
> {
  const normTpl = normalizarTemplate(template);
  const colRes = await buscarColaboradoresFiltrados(filters);
  if (!colRes.success) return { success: false, error: colRes.error || 'Erro' };
  const colaboradores = (colRes.data ?? []).slice(0, MAX_FUNCIONARIOS_HARD);
  if (colaboradores.length === 0) {
    return { success: false, error: 'Nenhum funcionário encontrado para os filtros informados.', status: 404 };
  }

  const docs = await buscarDocumentos(colaboradores.map((c) => c.id));
  const docsPorColab = new Map<string, DocRow[]>();
  for (const d of docs) {
    const arr = docsPorColab.get(d.colaborador_id) || [];
    arr.push(d);
    docsPorColab.set(d.colaborador_id, arr);
  }

  const anoAtual = String(new Date().getFullYear());
  const treeMap = new Map<string, Set<string>>();
  let totalDocumentos = 0;
  let totalSemArquivo = 0;
  const avisos: string[] = [];

  for (const colab of colaboradores) {
    const baseVars = {
      empresa: sanitizarNome(colab.empresa_nome, 'Sem_Empresa').replace(/\s/g, '_'),
      centro_custo: sanitizarNome(colab.centro_custo_nome, 'Sem_CC').replace(/\s/g, '_'),
      funcionario: sanitizarNome(colab.nome_completo, 'Sem_Nome').replace(/\s/g, '_'),
      cpf: (colab.cpf || '').replace(/\D/g, '') || 'Sem_CPF',
      cargo: sanitizarNome(colab.cargo_nome, 'Sem_Cargo').replace(/\s/g, '_'),
      ano: anoAtual,
    };
    const docsColab = docsPorColab.get(colab.id) || [];
    const segsBase = normTpl.template.split('/');
    const idxFunc = Math.max(segsBase.findIndex((s) => s.includes('{funcionario}')), 0);
    const pastaFuncionario = preencherTemplate(segsBase.slice(0, idxFunc + 1).join('/'), baseVars).join('/');

    const set = treeMap.get(pastaFuncionario) || new Set<string>();
    set.add('resumo.json');
    set.add('resumo.csv');
    treeMap.set(pastaFuncionario, set);

    const nomesUsados = new Set<string>(['resumo.json', 'resumo.csv']);
    for (const d of docsColab) {
      totalDocumentos++;
      const docVars: Partial<Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>> = {
        tipo_documento: sanitizarNome(d.tipo_documento, 'documento').replace(/\s/g, '_'),
        ano: d.data_emissao ? d.data_emissao.slice(0, 4) : d.created_at ? d.created_at.slice(0, 4) : anoAtual,
      };
      const dirSegs = preencherTemplate(normTpl.template, baseVars, docVars).slice(0, -1);
      const dirPath = dirSegs.join('/');
      if (!d.arquivo_path) {
        totalSemArquivo++;
        continue;
      }
      const setDir = treeMap.get(dirPath) || new Set<string>();
      const nomeBase = sanitizarNome(
        [d.numero_rastreio || d.numero_documento, d.titulo].filter(Boolean).join(' - ') || d.tipo_documento
      ).replace(/\s/g, '_');
      const ext = extDePath(d.arquivo_path);
      let nome = `${nomeBase}${ext}`;
      let n = 2;
      while (setDir.has(nome)) nome = `${nomeBase}_${n++}${ext}`;
      setDir.add(nome);
      treeMap.set(dirPath, setDir);
    }
    void nomesUsados;
  }

  if (colaboradores.length >= MAX_FUNCIONARIOS_HARD) {
    avisos.push(`Preview limitado aos primeiros ${MAX_FUNCIONARIOS_HARD} funcionários.`);
  }

  const tree = [...treeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, arquivos]) => ({ path, arquivos: [...arquivos].sort() }));

  return {
    success: true,
    template: normTpl.template,
    total_funcionarios: colaboradores.length,
    total_documentos: totalDocumentos,
    total_sem_arquivo: totalSemArquivo,
    tree,
    avisos,
  };
}
