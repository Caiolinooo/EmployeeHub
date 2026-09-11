const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('=== INVESTIGATING ASO DUPLICATES IN DB ===');

  // 1. Get all collaborators
  const { data: colabs, error: colabErr } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, matricula')
    .is('deleted_at', null);

  if (colabErr) {
    console.error('Error fetching colabs:', colabErr);
    return;
  }
  const colabMap = new Map(colabs.map(c => [c.id, c]));

  // 2. Get all documents of type 'aso'
  const { data: docAsos, error: docErr } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (docErr) {
    console.error('Error fetching docAsos:', docErr);
    return;
  }

  // 3. Get all gt_documentos_aso records
  const { data: asoRecords, error: asoErr } = await supabase
    .from('gt_documentos_aso')
    .select('*');

  if (asoErr) {
    console.error('Error fetching asoRecords:', asoErr);
    return;
  }
  const asoMetaMap = new Map(asoRecords.map(a => [a.documento_id, a]));

  // 4. Get all S-2220 events
  const { data: s2220Events, error: evtErr } = await supabase
    .from('esocial_eventos')
    .select('*')
    .eq('evento_codigo', 'S-2220');

  console.log(`Total active colaboradores: ${colabs.length}`);
  console.log(`Total gt_documentos (aso): ${docAsos.length}`);
  console.log(`Total gt_documentos_aso records: ${asoRecords.length}`);
  console.log(`Total S-2220 esocial_eventos: ${s2220Events ? s2220Events.length : 0}`);

  // Inspect Vinicius Pereira de Oliveira specifically
  const vinicius = colabs.find(c => c.nome_completo && c.nome_completo.toUpperCase().includes('VINICIUS PEREIRA'));
  if (vinicius) {
    console.log('\n--- VINICIUS PEREIRA DE OLIVEIRA (ID: ' + vinicius.id + ') ---');
    const viniciusDocs = docAsos.filter(d => d.colaborador_id === vinicius.id);
    console.log(`Found ${viniciusDocs.length} ASO docs for Vinicius:`);
    viniciusDocs.forEach(d => {
      const meta = asoMetaMap.get(d.id);
      console.log({
        id: d.id,
        titulo: d.titulo,
        numero_rastreio: d.numero_rastreio,
        numero_documento: d.numero_documento,
        data_emissao: d.data_emissao,
        data_validade: d.data_validade,
        arquivo_hash: d.arquivo_hash,
        arquivo_url: d.arquivo_url ? d.arquivo_url.split('/').pop() : null,
        ocr_status: d.ocr_status,
        meta_tipo_exame: meta?.tipo_exame,
        meta_resultado: meta?.resultado,
        meta_data_realizacao: meta?.data_realizacao,
        meta_esocial_status: meta?.esocial_status,
        meta_cpf_documento: meta?.cpf_documento,
        meta_identity_match: meta?.identity_match,
        created_at: d.created_at
      });
    });

    const vinEvents = (s2220Events || []).filter(e => e.cpf_trabalhador === vinicius.cpf.replace(/\D/g, ''));
    console.log(`Found ${vinEvents.length} S-2220 events for Vinicius:`, vinEvents.map(e => ({
      id: e.id,
      status: e.status,
      entidade_origem_id: e.entidade_origem_id,
      numero_recibo: e.numero_recibo,
      protocolo_envio: e.protocolo_envio,
      created_at: e.created_at
    })));
  }

  // 5. Detect all duplicate groups among ASOs
  console.log('\n=== DETECTING DUPLICATE GROUPS ACROSS ALL COLLABORATORS ===');

  const groupsByColabAndKey = new Map();

  docAsos.forEach(doc => {
    const meta = asoMetaMap.get(doc.id);
    const colab = colabMap.get(doc.colaborador_id);
    const colabName = colab ? colab.nome_completo : `[ID: ${doc.colaborador_id}]`;

    // Key 1: File hash
    const hashKey = doc.arquivo_hash ? `HASH_${doc.colaborador_id}_${doc.arquivo_hash}` : null;
    
    // Key 2: Content signature (data_realizacao/data_emissao + data_validade + medico_crm/nome)
    const realizacao = meta?.data_realizacao || doc.data_emissao || 'ND';
    const validade = doc.data_validade || 'ND';
    const crm = meta?.medico_crm || 'ND';
    const signatureKey = `SIG_${doc.colaborador_id}_${realizacao}_${validade}_${crm}`;

    // Store in map
    if (hashKey) {
      if (!groupsByColabAndKey.has(hashKey)) groupsByColabAndKey.set(hashKey, []);
      groupsByColabAndKey.get(hashKey).push({ doc, meta, colabName, matchType: 'exact_file_hash' });
    }
    if (!groupsByColabAndKey.has(signatureKey)) groupsByColabAndKey.set(signatureKey, []);
    groupsByColabAndKey.get(signatureKey).push({ doc, meta, colabName, matchType: 'date_signature' });
  });

  const duplicateHashGroups = [];
  const duplicateSignatureGroups = [];

  for (const [key, items] of groupsByColabAndKey.entries()) {
    if (items.length > 1) {
      const uniqueDocs = [];
      const seen = new Set();
      for (const it of items) {
        if (!seen.has(it.doc.id)) {
          seen.add(it.doc.id);
          uniqueDocs.push(it);
        }
      }
      if (uniqueDocs.length > 1) {
        if (key.startsWith('HASH_')) {
          duplicateHashGroups.push({ key, docs: uniqueDocs });
        } else if (key.startsWith('SIG_')) {
          duplicateSignatureGroups.push({ key, docs: uniqueDocs });
        }
      }
    }
  }

  console.log(`\nDuplicate Groups by File Hash: ${duplicateHashGroups.length}`);
  duplicateHashGroups.forEach((g, idx) => {
    console.log(`\n[Hash Group ${idx + 1}] Colaborador: ${g.docs[0].colaboradorName || g.docs[0].colabName}`);
    g.docs.forEach(d => {
      console.log(`  - Doc ID: ${d.doc.id} | Titulo: ${d.doc.titulo} | Rastreio: ${d.doc.numero_rastreio} | Status e-Social: ${d.meta?.esocial_status || 'sem meta'} | Created: ${d.doc.created_at}`);
    });
  });

  console.log(`\nDuplicate Groups by Medical/Date Signature: ${duplicateSignatureGroups.length}`);
  duplicateSignatureGroups.forEach((g, idx) => {
    console.log(`\n[Signature Group ${idx + 1}] Colaborador: ${g.docs[0].colaboradorName || g.docs[0].colabName} (Key: ${g.key})`);
    g.docs.forEach(d => {
      console.log(`  - Doc ID: ${d.doc.id} | Hash: ${d.doc.arquivo_hash?.substring(0, 10)} | Titulo: ${d.doc.titulo} | Rastreio: ${d.doc.numero_rastreio} | Realiz: ${d.meta?.data_realizacao || d.doc.data_emissao} | Valid: ${d.doc.data_validade} | Status e-Social: ${d.meta?.esocial_status || 'sem meta'} | Created: ${d.doc.created_at}`);
    });
  });

  // Also check non-ASO documents to see if general duplication exists
  const { data: allDocs, error: allErr } = await supabase
    .from('gt_documentos')
    .select('id, colaborador_id, tipo_documento, titulo, numero_rastreio, arquivo_hash, data_emissao, data_validade, created_at')
    .is('deleted_at', null);

  console.log(`\nTotal all documents in gt_documentos: ${allDocs ? allDocs.length : 0}`);
  
  const allDocHashGroups = new Map();
  (allDocs || []).forEach(d => {
    if (d.arquivo_hash && d.colaborador_id) {
      const k = `${d.colaborador_id}_${d.tipo_documento}_${d.arquivo_hash}`;
      if (!allDocHashGroups.has(k)) allDocHashGroups.set(k, []);
      allDocHashGroups.get(k).push(d);
    }
  });

  let totalDupAllDocs = 0;
  for (const [k, list] of allDocHashGroups.entries()) {
    if (list.length > 1) {
      totalDupAllDocs += (list.length - 1);
    }
  }
  console.log(`Total duplicated document instances (all types by exact hash): ${totalDupAllDocs}`);
}

run();
