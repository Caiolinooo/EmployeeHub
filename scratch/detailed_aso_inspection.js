const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Check colaboradores (including deleted if any)
  const { data: allColabs } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, deleted_at');

  const colabMap = new Map(allColabs.map(c => [c.id, c]));

  // Get all ASOs from gt_documentos
  const { data: docAsos } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('tipo_documento', 'aso')
    .order('created_at', { ascending: true });

  const { data: asoMeta } = await supabase
    .from('gt_documentos_aso')
    .select('*');
  const metaMap = new Map(asoMeta.map(m => [m.documento_id, m]));

  const { data: esocialEvents } = await supabase
    .from('esocial_eventos')
    .select('*')
    .eq('evento_codigo', 'S-2220');

  console.log(`Total ASO docs in gt_documentos: ${docAsos.length}`);
  console.log(`Total gt_documentos_aso: ${asoMeta.length}`);

  // Group by collaborator
  const byColab = new Map();
  for (const doc of docAsos) {
    const cid = doc.colaborador_id || 'NULL_COLAB';
    if (!byColab.has(cid)) byColab.set(cid, []);
    byColab.get(cid).push({
      ...doc,
      meta: metaMap.get(doc.id) || null
    });
  }

  console.log(`\nCollaborators with ASOs: ${byColab.size}`);

  let totalDuplicatasDetectadas = 0;
  let totalAsosUnicosLegitimos = 0;

  for (const [cid, docs] of byColab.entries()) {
    const colab = colabMap.get(cid);
    const colabName = colab ? `${colab.nome_completo} (${colab.cpf})` : `ORPHAN / UNASSIGNED (${cid})`;
    
    console.log(`\n======================================================`);
    console.log(`Colaborador: ${colabName} - Total ASO docs: ${docs.length}`);
    console.log(`======================================================`);

    // Group docs for this collaborator to identify distinct historical exams vs duplicates
    // An ASO is a distinct exam if it has different (data_realizacao/data_emissao, data_validade, or tipo_exame with different dates)
    // Same exam = same date of realizacao/emissao & same validity (or null) & same doctor/clinic or same file url/title
    const examGroups = new Map();

    docs.forEach(d => {
      const dataRealiz = d.meta?.data_realizacao || d.data_emissao || 'SEM_DATA_REALIZ';
      const dataValid = d.data_validade || 'SEM_DATA_VALID';
      const crm = d.meta?.medico_crm || 'SEM_CRM';
      const fileBase = d.arquivo_url ? d.arquivo_url.split('/').pop()?.replace(/^\d+-/, '') : (d.titulo || 'SEM_ARQ');

      // Key for duplicate grouping:
      // If dates match, it's the exact same exam.
      // If file name/url is the same, it's the exact same file upload.
      const examKey = `${dataRealiz}_${dataValid}_${crm}`;
      if (!examGroups.has(examKey)) examGroups.set(examKey, []);
      examGroups.get(examKey).push(d);
    });

    console.log(`Distinct Exams (Historical): ${examGroups.size}`);
    totalAsosUnicosLegitimos += examGroups.size;

    for (const [examKey, groupDocs] of examGroups.entries()) {
      const isDuplicate = groupDocs.length > 1;
      if (isDuplicate) {
        totalDuplicatasDetectadas += (groupDocs.length - 1);
        console.log(`\n  ⚠️  [EXAME REPETIDO / DUPLICADO] Chave: ${examKey} (${groupDocs.length} cópias):`);
      } else {
        console.log(`\n  ✅ [EXAME ÚNICO] Chave: ${examKey}:`);
      }

      // Check which one is the "primary" or "authoritative" (e.g. processado in e-Social > enviado > has OCR > latest)
      groupDocs.forEach((d, idx) => {
        const esocialStatus = d.meta?.esocial_status || 'sem_meta';
        const hasRecibo = esocialEvents.some(e => e.entidade_origem_id === d.id && e.numero_recibo);
        console.log(`    [#${idx + 1}] ID: ${d.id}`);
        console.log(`        Titulo: ${d.titulo}`);
        console.log(`        Rastreio: ${d.numero_rastreio}`);
        console.log(`        Emissão: ${d.data_emissao} | Validade: ${d.data_validade}`);
        console.log(`        Tipo: ${d.meta?.tipo_exame || 'ND'} | Resultado: ${d.meta?.resultado || 'ND'}`);
        console.log(`        Médico: ${d.meta?.medico_nome || 'ND'} (${d.meta?.medico_crm || 'ND'})`);
        console.log(`        e-Social Status: ${esocialStatus} ${hasRecibo ? '⭐ (COM RECIBO)' : ''}`);
        console.log(`        OCR Status: ${d.ocr_status}`);
        console.log(`        Arquivo URL: ${d.arquivo_url || 'ND'}`);
        console.log(`        Arquivo Hash: ${d.arquivo_hash || 'ND'}`);
        console.log(`        Created At: ${d.created_at}`);
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`RESUMO GERAL:`);
  console.log(`Total ASO records no banco (gt_documentos): ${docAsos.length}`);
  console.log(`Total de Exames Legítimos no Histórico: ${totalAsosUnicosLegitimos}`);
  console.log(`Total de Cópias Duplicadas: ${totalDuplicatasDetectadas}`);
  console.log(`======================================================`);
}

run();
