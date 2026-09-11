/* QUARENTENA DOS LEGADOS — aplica contrato AGENTS.md nos casos confirmados pela varredura v2.
 * - Bucket A/A2/C não congelados: desvincula (colaborador_id=null) + identity_match='quarantine'
 *   + esocial_status='quarentena' (gt_documentos e espelho gt_documentos_aso).
 * - Bucket B (nome próprio no arquivo, sem CPF): mantém vínculo, corrige mentira legada
 *   identity_match 'match' -> 'unknown' (sem CPF extraído não há prova).
 * Idempotente. Backup já gravado por gt-risk-scan-v2.js. */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'gt-risk-scan-report-v2.json'), 'utf8'));

async function run() {
  const alvosQ = report.em_risco.filter(r => !r.frozen && (r.bucket.startsWith('A') || r.bucket === 'C_SEM_PROVA'));
  const alvosB = report.em_risco.filter(r => r.bucket === 'B_NOME_PROPRIO_SEM_CPF');
  console.log(`quarentena: ${alvosQ.length} | correcao identity_match (B): ${alvosB.length}`);
  const agora = new Date().toISOString();
  const log = { applied_at: agora, quarentena: [], identity_fix: [] };

  for (const r of alvosQ) {
    // 1) desvincular doc + marcar quarentena
    const { error: eDoc } = await supabase.from('gt_documentos').update({
      colaborador_id: null,
      identity_match: 'quarantine',
      comentario_revisao: `Quarentena automática (varredura legados ${agora.slice(0, 10)}): arquivo "${r.titulo}" não pôde ser provado como do colaborador ${r.colaborador_nome} — sem CPF extraído e nome do arquivo aponta para outra pessoa.`,
      updated_at: agora,
    }).eq('id', r.documento_id);
    if (eDoc) { console.error(`DOC FAIL ${r.documento_id}:`, eDoc.message); continue; }

    // 2) espelho ASO
    const { data: asoRow } = await supabase.from('gt_documentos_aso').select('id').eq('documento_id', r.documento_id).maybeSingle();
    if (asoRow) {
      const { error: eAso } = await supabase.from('gt_documentos_aso').update({
        colaborador_id: null,
        identity_match: 'quarantine',
        esocial_status: 'quarentena',
        updated_at: agora,
      }).eq('id', asoRow.id);
      if (eAso) console.error(`ASO FAIL ${r.documento_id}:`, eAso.message);
    } else {
      const { error: eIns } = await supabase.from('gt_documentos_aso').insert({
        documento_id: r.documento_id,
        identity_match: 'quarantine',
        esocial_status: 'quarentena',
      });
      if (eIns) console.error(`ASO INSERT FAIL ${r.documento_id}:`, eIns.message);
    }
    log.quarentena.push({ documento_id: r.documento_id, titulo: r.titulo, ex_colaborador: r.colaborador_nome });
    console.log(`QUARENTENA ok: ${r.documento_id.slice(0, 8)} "${r.titulo}" (era de ${r.colaborador_nome})`);
  }

  for (const r of alvosB) {
    if (r.doc_identity_match !== 'match') continue; // só corrige a mentira legada
    const { error } = await supabase.from('gt_documentos').update({
      identity_match: 'unknown',
      updated_at: agora,
    }).eq('id', r.documento_id).eq('identity_match', 'match'); // condicional = idempotente/seguro
    if (error) { console.error(`IDENT FIX FAIL ${r.documento_id}:`, error.message); continue; }
    // espelho ASO, se existir com 'match' sem cpf
    await supabase.from('gt_documentos_aso').update({ identity_match: 'unknown', updated_at: agora })
      .eq('documento_id', r.documento_id).eq('identity_match', 'match').is('cpf_documento', null);
    log.identity_fix.push({ documento_id: r.documento_id, titulo: r.titulo });
  }

  fs.writeFileSync(path.join(__dirname, 'gt-quarantine-applied.json'), JSON.stringify(log, null, 2));
  console.log(`\nConcluído: ${log.quarentena.length} em quarentena, ${log.identity_fix.length} identity_match corrigidos.`);
}
run().catch(e => { console.error(e); process.exit(1); });
