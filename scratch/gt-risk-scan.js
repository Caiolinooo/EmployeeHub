/* VARREDURA DE RISCO — documentos vinculados a colaborador sem prova de identidade.
 * Read-only. Saída: scratch/gt-risk-scan-report.json + resumo no stdout. */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STOP = new Set(['aso', 'atestado', 'de', 'da', 'do', 'dos', 'das', 'e', 'exame', 'ocupacional', 'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']);

function tokens(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(t => t.length >= 3 && !STOP.has(t));
}

// extrai possível nome de pessoa do título/arquivo: remove prefixo de tipo e extensão
function extractNamePart(title, filePath) {
  let base = (title && title.trim()) || path.basename(filePath || '');
  base = base.replace(/\.(pdf|docx?|jpe?g|png)$/i, '');
  // remove prefixes comuns: "ASO - ", "ASO ", "Atestado ... - "
  const m = base.match(/^(?:ASO|ATESTADO|EXAME|CERTIFICADO|TREINAMENTO|PASSAPORTE|CNH)\s*(?:\S{0,12})?\s*[-–:]?\s*(.+)$/i);
  const rest = m ? m[1] : base;
  return rest.trim();
}

async function run() {
  const [{ data: colabs }, { data: docs }, { data: asos }] = await Promise.all([
    supabase.from('gt_colaboradores').select('id, nome_completo, cpf, deleted_at'),
    supabase.from('gt_documentos').select('id, colaborador_id, tipo_documento, titulo, numero_documento, arquivo_path, arquivo_hash, ocr_status, identity_match, quarentena_dummy_missing, created_at, deleted_at').then(r => r.error
      ? supabase.from('gt_documentos').select('id, colaborador_id, tipo_documento, titulo, numero_documento, arquivo_path, arquivo_hash, ocr_status, identity_match, created_at, deleted_at')
      : r),
    supabase.from('gt_documentos_aso').select('id, documento_id, colaborador_id, cpf_documento, identity_match, esocial_status'),
  ]);
  if (!colabs || !docs || !asos) { console.error('fetch fail'); process.exit(1); }

  const colabById = new Map(colabs.map(c => [c.id, c]));
  const asoByDoc = new Map(asos.map(a => [a.documento_id, a]));

  // índice de nomes de colaboradores para detectar "o nome do arquivo é OUTRO colaborador"
  const colabTokens = colabs.filter(c => c.nome_completo).map(c => ({ id: c.id, nome: c.nome_completo, tk: new Set(tokens(c.nome_completo)) }));

  const results = [];
  for (const d of docs) {
    if (d.deleted_at) continue;
    const isASO = /aso/i.test(d.tipo_documento || '');
    const aso = asoByDoc.get(d.id);
    if (isASO && !aso) continue;
    const docMatch = d.identity_match;
    const asoMatch = aso ? aso.identity_match : undefined;
    const cpfDoc = aso ? aso.cpf_documento : null;
    const matchVals = [docMatch, asoMatch].filter(v => v !== null && v !== undefined);
    const unproven = matchVals.length === 0 || matchVals.every(v => v === 'unknown' || v === null);

    const colab = d.colaborador_id ? colabById.get(d.colaborador_id) : null;
    const namePart = extractNamePart(d.titulo, d.arquivo_path);
    const nameTk = tokens(namePart);
    const colabTk = colab ? new Set(tokens(colab.nome_completo)) : new Set();
    const overlap = nameTk.filter(t => colabTk.has(t));

    // outro colaborador cujo nome cobre os tokens do arquivo?
    let otherColab = null, bestScore = 0;
    if (nameTk.length >= 2) {
      for (const c of colabTokens) {
        if (colab && c.id === colab.id) continue;
        const hit = nameTk.filter(t => c.tk.has(t)).length;
        const score = hit / Math.max(nameTk.length, c.tk.size);
        if (hit >= 2 && score > bestScore) { bestScore = score; otherColab = c; }
      }
    }
    const differentPersonHint = colab && nameTk.length >= 2 && overlap.length === 0;

    if (!(d.colaborador_id && unproven && !cpfDoc && (differentPersonHint || otherColab))) continue;

    results.push({
      documento_id: d.id,
      tipo_documento: d.tipo_documento,
      titulo: d.titulo,
      arquivo_path: d.arquivo_path,
      arquivo_hash: d.arquivo_hash,
      colaborador_id: d.colaborador_id,
      colaborador_nome: colab ? colab.nome_completo : null,
      colaborador_cpf: colab ? colab.cpf : null,
      doc_identity_match: docMatch,
      aso_identity_match: asoMatch,
      aso_cpf_documento: cpfDoc,
      aso_esocial_status: aso ? aso.esocial_status : null,
      ocr_status: d.ocr_status,
      nome_extraido_do_arquivo: namePart,
      tokens_arquivo: nameTk,
      overlap_com_colaborador: overlap,
      parece_outro_colaborador: otherColab ? { id: otherColab.id, nome: otherColab.nome, score: Number(bestScore.toFixed(2)) } : null,
      sinal: otherColab ? 'NOME_ARQUIVO_=_OUTRO_COLABORADOR' : 'NOME_ARQUIVO_NAO_BATE_COM_COLABORADOR',
    });
  }

  // duplicados: mesmo hash ou mesmo path em múltiplas linhas vivas
  const byHash = new Map(), byPath = new Map();
  for (const d of docs) {
    if (d.deleted_at) continue;
    if (d.arquivo_hash) { if (!byHash.has(d.arquivo_hash)) byHash.set(d.arquivo_hash, []); byHash.get(d.arquivo_hash).push(d); }
    if (d.arquivo_path) { if (!byPath.has(d.arquivo_path)) byPath.set(d.arquivo_path, []); byPath.get(d.arquivo_path).push(d); }
  }
  const duplicates = [];
  for (const [, group] of [...byHash, ...byPath]) {
    if (group.length < 2) continue;
    if (group[0].arquivo_hash && duplicates.some(x => x.key === group[0].arquivo_hash)) continue;
    duplicates.push({
      key: group[0].arquivo_hash || group[0].arquivo_path,
      key_kind: group[0].arquivo_hash ? 'arquivo_hash' : 'arquivo_path',
      rows: group.map(g => ({
        documento_id: g.id, titulo: g.titulo, colaborador_id: g.colaborador_id,
        colaborador_nome: g.colaborador_id ? (colabById.get(g.colaborador_id)?.nome_completo ?? null) : null,
        created_at: g.created_at,
      })),
    });
  }

  const report = {
    generated_at: new Date().toISOString(),
    totals: {
      colaboradores: colabs.length,
      documentos_vivos: docs.filter(d => !d.deleted_at).length,
      asos: asos.length,
      em_risco: results.length,
      grupos_duplicados: duplicates.length,
    },
    em_risco: results,
    duplicados: duplicates,
  };
  fs.writeFileSync(path.join(__dirname, 'gt-risk-scan-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.totals));
  console.log('\n--- EM RISCO ---');
  results.forEach(r => console.log(`${r.documento_id} | ${r.titulo} -> perfil ${r.colaborador_nome} | match=${r.aso_identity_match}/${r.doc_identity_match} | cpf_doc=${r.aso_cpf_documento} | esoc=${r.aso_esocial_status} | ${r.sinal}${r.parece_outro_colaborador ? ' (' + r.parece_outro_colaborador.nome + ')' : ''}`));
  console.log('\n--- DUPLICADOS ---');
  duplicates.forEach(g => console.log(`${g.key_kind} ${g.key.slice(0, 20)}... x${g.rows.length}: ${g.rows.map(r => `${r.titulo} @ ${r.colaborador_nome}`).join(' | ')}`));
}
run().catch(e => { console.error(e); process.exit(1); });
