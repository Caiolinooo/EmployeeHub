const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('=== STEP 1: BACKUP BEFORE DEDUPLICATION ===');
  
  const { data: backupDocs, error: docErr } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null);

  const { data: backupAsoMeta, error: asoErr } = await supabase
    .from('gt_documentos_aso')
    .select('*');

  const { data: backupColabs, error: colabErr } = await supabase
    .from('gt_colaboradores')
    .select('*')
    .ilike('nome_completo', '%vinicius%');

  if (docErr || asoErr) {
    console.error('Error fetching backup data:', docErr || asoErr);
    process.exit(1);
  }

  const backupData = {
    timestamp: new Date().toISOString(),
    totalDocs: backupDocs.length,
    totalAsoMeta: backupAsoMeta.length,
    docs: backupDocs,
    asoMeta: backupAsoMeta,
    viniciusColabs: backupColabs
  };

  const backupPath = path.join(__dirname, `backup_aso_dedup_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`Backup saved to ${backupPath} (${backupDocs.length} ASO docs, ${backupAsoMeta.length} ASO meta rows).`);

  console.log('\n=== STEP 2: CONSOLIDATING VINICIUS PEREIRA DE OLIVEIRA PROFILES ===');
  const vinPrimaryId = '9af7dceb-f7f7-43d9-81e1-87806307739f'; // active on MT Charline, Moço de convés, matricula 17784306000189.000783
  const vinSecondaryId = '9fb58004-62d0-4c67-beaa-09693a108be8'; // duplicate without cargo

  // Move all documents from secondary to primary
  const { data: secondaryDocs, error: secErr } = await supabase
    .from('gt_documentos')
    .select('id, tipo_documento, titulo')
    .eq('colaborador_id', vinSecondaryId)
    .is('deleted_at', null);

  if (secErr) {
    console.error('Error fetching secondary docs:', secErr);
  } else if (secondaryDocs && secondaryDocs.length > 0) {
    console.log(`Moving ${secondaryDocs.length} documents from secondary Vinicius (${vinSecondaryId}) to primary (${vinPrimaryId}):`);
    for (const d of secondaryDocs) {
      console.log(`  - Moving doc [${d.id}] ${d.tipo_documento}: "${d.titulo}"`);
      await supabase
        .from('gt_documentos')
        .update({ colaborador_id: vinPrimaryId, updated_at: new Date().toISOString() })
        .eq('id', d.id);
      
      // If it's an ASO, also update gt_documentos_aso
      if (d.tipo_documento === 'aso') {
        await supabase
          .from('gt_documentos_aso')
          .update({ colaborador_id: vinPrimaryId, updated_at: new Date().toISOString() })
          .eq('documento_id', d.id);
      }
    }
  }

  // Soft delete secondary Vinicius row
  const { error: delSecColabErr } = await supabase
    .from('gt_colaboradores')
    .update({
      deleted_at: new Date().toISOString(),
      observacoes: 'Perfil duplicado mesclado no ID principal 9af7dceb-f7f7-43d9-81e1-87806307739f',
      updated_at: new Date().toISOString()
    })
    .eq('id', vinSecondaryId);

  if (delSecColabErr) {
    console.error('Error soft-deleting secondary Vinicius:', delSecColabErr);
  } else {
    console.log(`Secondary Vinicius profile (${vinSecondaryId}) soft-deleted successfully.`);
  }

  console.log('\n=== STEP 3: PERFORMING PRECISE ASO DEDUPLICATION ===');

  // Fetch all active ASOs again (now that Vinicius docs are consolidated)
  const { data: allAsos } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const { data: currentAsoMeta } = await supabase
    .from('gt_documentos_aso')
    .select('*');
  const metaMap = new Map((currentAsoMeta || []).map(m => [m.documento_id, m]));

  const { data: s2220Events } = await supabase
    .from('esocial_eventos')
    .select('*')
    .eq('evento_codigo', 'S-2220');

  const { data: colabs } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf')
    .is('deleted_at', null);
  const colabMap = new Map((colabs || []).map(c => [c.id, c]));

  // Group by Person (CPF or Colaborador ID)
  const byPerson = new Map();

  allAsos.forEach(doc => {
    const meta = metaMap.get(doc.id);
    const colab = colabMap.get(doc.colaborador_id);
    const cpf = (meta?.cpf_documento || colab?.cpf || 'UNKNOWN').replace(/\D/g, '');
    const name = colab?.nome_completo || meta?.nome_clinica || doc.titulo;

    const personKey = cpf.length === 11 ? cpf : (doc.colaborador_id || 'ORPHAN');
    if (!byPerson.has(personKey)) {
      byPerson.set(personKey, { personKey, cpf, name, docs: [] });
    }
    byPerson.get(personKey).docs.push({ doc, meta });
  });

  let totalRemoved = 0;
  let totalRetained = 0;
  const now = new Date().toISOString();

  for (const [personKey, personData] of byPerson.entries()) {
    console.log(`\nProcessing Person: ${personData.name} (CPF: ${personData.cpf}) - ${personData.docs.length} ASOs...`);

    // Group into distinct historical exams
    const examGroups = new Map();

    personData.docs.forEach(item => {
      const { doc, meta } = item;
      const dRealiz = meta?.data_realizacao || doc.data_emissao;
      const dValid = doc.data_validade;
      const crm = meta?.medico_crm || '';

      let groupKey;
      if (dRealiz || dValid || crm) {
        groupKey = `DATE_${dRealiz || 'NULL'}_${dValid || 'NULL'}_${crm || 'NULL'}`;
      } else {
        groupKey = `TITLE_${doc.titulo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      }

      if (!examGroups.has(groupKey)) examGroups.set(groupKey, []);
      examGroups.get(groupKey).push(item);
    });

    for (const [gKey, items] of examGroups.entries()) {
      // Rank items to pick the single authoritative KEEPER
      const ranked = items.map(it => {
        let score = 0;
        const ev = (s2220Events || []).find(e => e.entidade_origem_id === it.doc.id);
        const eStat = it.meta?.esocial_status || '';

        if (ev?.numero_recibo || eStat === 'processado') score += 10000;
        else if (eStat === 'enviado') score += 5000;
        else if (eStat === 'pendente') score += 1000;
        else if (eStat === 'erro') score += 500;
        else if (eStat === 'nao_enviado') score += 100;

        if (it.doc.ocr_status === 'concluido') score += 50;
        if (it.doc.data_validade) score += 20;
        if (it.doc.data_emissao) score += 10;
        if (it.doc.arquivo_url) score += 10;
        if (it.meta?.medico_crm) score += 10;
        if (it.meta?.tipo_exame) score += 10;
        if (it.doc.colaborador_id) score += 10;

        return { ...it, score, ev };
      });

      ranked.sort((a, b) => b.score - a.score || new Date(b.doc.created_at).getTime() - new Date(a.doc.created_at).getTime());

      const keeper = ranked[0];
      const duplicates = ranked.slice(1);

      totalRetained++;
      console.log(`  ⭐ KEEPING: [${keeper.doc.id}] "${keeper.doc.titulo}" | Rastreio: ${keeper.doc.numero_rastreio} | Realiz: ${keeper.meta?.data_realizacao || keeper.doc.data_emissao} | Valid: ${keeper.doc.data_validade} | e-Social: ${keeper.meta?.esocial_status || 'N/A'}`);

      // If keeper is missing data that a duplicate had (e.g. data_validade or data_emissao), enrich keeper:
      let needsEnrichment = false;
      const updateKeeper = {};
      if (!keeper.doc.data_validade) {
        const bestValid = items.map(x => x.doc.data_validade).filter(Boolean)[0];
        if (bestValid) {
          updateKeeper.data_validade = bestValid;
          needsEnrichment = true;
        }
      }
      if (!keeper.doc.data_emissao) {
        const bestEmissao = items.map(x => x.doc.data_emissao).filter(Boolean)[0];
        if (bestEmissao) {
          updateKeeper.data_emissao = bestEmissao;
          needsEnrichment = true;
        }
      }
      if (needsEnrichment) {
        updateKeeper.updated_at = now;
        await supabase.from('gt_documentos').update(updateKeeper).eq('id', keeper.doc.id);
        console.log(`     Enriched keeper with:`, updateKeeper);
      }

      // Soft delete all duplicate copies
      for (const dup of duplicates) {
        console.log(`  ❌ SOFT-DELETING DUPLICATE: [${dup.doc.id}] "${dup.doc.titulo}" | Rastreio: ${dup.doc.numero_rastreio} | Status: ${dup.meta?.esocial_status || 'N/A'}`);
        
        const { error: softDelErr } = await supabase
          .from('gt_documentos')
          .update({
            deleted_at: now,
            comentario_revisao: `Duplicata mesclada no registro autoritativo ${keeper.doc.numero_rastreio || keeper.doc.id}`,
            updated_at: now
          })
          .eq('id', dup.doc.id);

        if (softDelErr) {
          console.error(`Error soft-deleting doc ${dup.doc.id}:`, softDelErr);
        } else {
          totalRemoved++;
        }

        // Delete from gt_documentos_aso so it does not clutter queries
        const { error: delAsoMetaErr } = await supabase
          .from('gt_documentos_aso')
          .delete()
          .eq('documento_id', dup.doc.id);

        if (delAsoMetaErr) {
          console.error(`Error deleting ASO meta for doc ${dup.doc.id}:`, delAsoMetaErr);
        }
      }
    }
  }

  console.log(`\n=============================================`);
  console.log(`DEDUPLICATION COMPLETE:`);
  console.log(`Total Legitimate Historical Exams Retained: ${totalRetained}`);
  console.log(`Total Duplicate Records Soft-Deleted: ${totalRemoved}`);
  console.log(`=============================================`);
}

run();
