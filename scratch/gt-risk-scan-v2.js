/* VARREDURA DE RISCO v2 + BACKUP — documentos vinculados sem prova real de identidade.
 * Prova de identidade = gt_documentos_aso.cpf_documento == cpf do colaborador vinculado.
 * identity_match='match' em gt_documentos é valor legado NÃO confiável.
 * Read-only: grava apenas relatório + backup JSON em scratch/. */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STOP = new Set(['aso', 'atestado', 'de', 'da', 'do', 'dos', 'das', 'e', 'exame', 'ocupacional', 'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'pt', 'en', 'rotated']);
const TIPOS_COM_CPF = ['aso', 'passaporte', 'cnh', 'ctps', 'titulo_eleitor', 'reservista', 'certidao_nascimento', 'certidao_casamento', 'documento_pessoal'];

function norm(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function tokens(s) {
  return norm(s).replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(t => t.length >= 3 && !STOP.has(t));
}
function extractNamePart(title, filePath) {
  let base = (title && title.trim()) || path.basename(filePath || '');
  base = base.replace(/\.(pdf|docx?|jpe?g|png)$/i, '');
  const m = base.match(/^(?:ASO|ATESTADO|EXAME|CERTIFICADO|TREINAMENTO|PASSAPORTE|CNH)\s*\S{0,12}\s*[-–:]?\s*(.+)$/i);
  return (m ? m[1] : base).trim();
}
const digits = s => (s || '').replace(/\D/g, '');

async function fetchAll(table, select) {
  const all = []; let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function run() {
  const [colabs, docs, asos] = await Promise.all([
    fetchAll('gt_colaboradores', 'id, nome_completo, cpf, deleted_at'),
    fetchAll('gt_documentos', 'id, colaborador_id, tipo_documento, titulo, numero_rastreio, arquivo_path, arquivo_hash, ocr_status, ocr_dados_extraidos, identity_match, origem, created_at, updated_at, esocial_dummy_x, deleted_at').catch(() =>
      fetchAll('gt_documentos', 'id, colaborador_id, tipo_documento, titulo, numero_rastreio, arquivo_path, arquivo_hash, ocr_status, ocr_dados_extraidos, identity_match, origem, created_at, updated_at, deleted_at')),
    fetchAll('gt_documentos_aso', 'id, documento_id, colaborador_id, cpf_documento, identity_match, esocial_status'),
  ]);

  const colabById = new Map(colabs.map(c => [c.id, c]));
  const asoByDoc = new Map(asos.map(a => [a.documento_id, a]));
  const colabIdx = colabs.filter(c => c.nome_completo && !c.deleted_at).map(c => ({ ...c, tk: new Set(tokens(c.nome_completo)) }));

  const vivos = docs.filter(d => !d.deleted_at);
  const risco = [];
  for (const d of vivos) {
    if (!TIPOS_COM_CPF.includes(d.tipo_documento)) continue;
    if (d.origem === 'mio') continue; // MIO é read-only
    if (!d.colaborador_id) continue;
    const colab = colabById.get(d.colaborador_id);
    if (!colab) continue;
    const aso = asoByDoc.get(d.id);
    // prova real: cpf extraído e igual ao do perfil
    const cpfDoc = digits(aso?.cpf_documento || d.ocr_dados_extraidos?.cpf || '');
    const cpfPerfil = digits(colab.cpf);
    const provado = cpfDoc.length === 11 && cpfPerfil.length === 11 && cpfDoc === cpfPerfil;
    if (provado) continue;

    // ASO já enviado/processado → identidade congelada por contrato; não mexer
    const esoc = aso?.esocial_status || null;
    const frozen = esoc && !['nao_enviado'].includes(esoc);

    const namePart = extractNamePart(d.titulo, d.arquivo_path);
    const nameTk = [...new Set(tokens(namePart))];
    const colabTk = new Set(tokens(colab.nome_completo));
    const overlap = nameTk.filter(t => colabTk.has(t));

    let other = null, bestScore = 0;
    if (nameTk.length >= 2 && overlap.length < 2) {
      for (const c of colabIdx) {
        if (c.id === d.colaborador_id) continue;
        if (norm(c.nome_completo) === norm(colab.nome_completo)) continue; // registro duplicado do MESMO colaborador
        const hit = nameTk.filter(t => c.tk.has(t)).length;
        const score = hit / Math.max(nameTk.length, c.tk.size);
        if (hit >= 2 && score > bestScore) { bestScore = score; other = c; }
      }
    }

    let bucket;
    if (overlap.length >= 2) bucket = 'B_NOME_PROPRIO_SEM_CPF';
    else if (other) bucket = 'A_NOME_DE_OUTRA_PESSOA';
    else if (overlap.length === 0 && nameTk.length >= 2) bucket = 'A2_TOKENS_ZERADOS';
    else bucket = 'C_SEM_PROVA';

    risco.push({
      documento_id: d.id, aso_row_id: aso?.id || null,
      tipo_documento: d.tipo_documento, titulo: d.titulo, arquivo_path: d.arquivo_path,
      colaborador_id: d.colaborador_id, colaborador_nome: colab.nome_completo, colaborador_cpf: digits(colab.cpf),
      doc_identity_match: d.identity_match, aso_identity_match: aso?.identity_match ?? null,
      aso_cpf_documento: aso?.cpf_documento ?? null, esocial_status: esoc,
      ocr_status: d.ocr_status, frozen,
      nome_extraido_do_arquivo: namePart,
      parece_outro_colaborador: other ? { id: other.id, nome: other.nome_completo, score: Number(bestScore.toFixed(2)) } : null,
      bucket,
    });
  }
  risco.sort((a, b) => a.bucket.localeCompare(b.bucket));

  // duplicados: mesmo colaborador+tipo+título normalizado
  const groups = new Map();
  for (const d of vivos) {
    const key = `${d.colaborador_id || 'ORFAO'}::${d.tipo_documento}::${(d.titulo || '').toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ documento_id: d.id, titulo: d.titulo, created_at: d.created_at, colaborador: d.colaborador_id ? colabById.get(d.colaborador_id)?.nome_completo : null });
  }
  const duplicados = [...groups.values()].filter(g => g.length > 1);

  const totals = {
    documentos_vivos: vivos.length,
    tipos_com_cpf_vinculados_sem_prova: risco.length,
    bucket_A_outra_pessoa: risco.filter(r => r.bucket.startsWith('A')).length,
    bucket_B_nome_proprio_sem_cpf: risco.filter(r => r.bucket === 'B_NOME_PROPRIO_SEM_CPF').length,
    bucket_C_sem_prova: risco.filter(r => r.bucket === 'C_SEM_PROVA').length,
    grupos_duplicados: duplicados.length,
    linhas_duplicadas_excedentes: duplicados.reduce((a, g) => a + g.length - 1, 0),
  };

  // BACKUP: estado atual de todas as linhas candidatas a quarentena (A/A2/C não congelados)
  const alvosQuarentena = risco.filter(r => r.bucket.startsWith('A') && !r.frozen || r.bucket === 'C_SEM_PROVA' && !r.frozen);
  const ids = alvosQuarentena.map(r => r.documento_id);
  const backup = {
    generated_at: new Date().toISOString(),
    alvos: ids,
    gt_documentos: (await Promise.all(ids.map(id => supabase.from('gt_documentos').select('*').eq('id', id).maybeSingle()))).map(x => x.data).filter(Boolean),
    gt_documentos_aso: (await Promise.all(ids.map(id => supabase.from('gt_documentos_aso').select('*').eq('documento_id', id).maybeSingle()))).map(x => x.data).filter(Boolean),
  };
  const backupPath = path.join(__dirname, `backup-gt-quarantine-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  fs.writeFileSync(path.join(__dirname, 'gt-risk-scan-report-v2.json'), JSON.stringify({ generated_at: new Date().toISOString(), totals, em_risco: risco, duplicados }, null, 2));

  console.log(JSON.stringify(totals));
  console.log('\n--- EM RISCO (por bucket) ---');
  risco.forEach(r => console.log(`${r.bucket} | ${r.documento_id.slice(0,8)} | ${r.titulo} => ${r.colaborador_nome}${r.frozen ? ' [CONGELADO]' : ''}${r.parece_outro_colaborador ? ' -> ' + r.parece_outro_colaborador.nome : ''} | match=${r.doc_identity_match}/${r.aso_identity_match}`));
  console.log(`\nBackup (${backup.alvos.length} linhas): ${backupPath}`);
}
run().catch(e => { console.error(e); process.exit(1); });
