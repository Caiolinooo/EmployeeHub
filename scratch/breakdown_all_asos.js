const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: colabs } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, matricula')
    .is('deleted_at', null);

  const colabByCleanCpf = new Map();
  const colabById = new Map();
  colabs.forEach(c => {
    colabById.set(c.id, c);
    const clean = c.cpf ? c.cpf.replace(/\D/g, '') : '';
    if (clean) {
      if (!colabByCleanCpf.has(clean)) colabByCleanCpf.set(clean, []);
      colabByCleanCpf.get(clean).push(c);
    }
  });

  const { data: allAsos } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const { data: asoMeta } = await supabase
    .from('gt_documentos_aso')
    .select('*');
  const metaByDocId = new Map(asoMeta.map(m => [m.documento_id, m]));

  const { data: s2220List } = await supabase
    .from('esocial_eventos')
    .select('*')
    .eq('evento_codigo', 'S-2220');

  console.log('=== DETAILED BREAKDOWN OF ALL ASO RECORDS ===\n');

  // Let's group ASOs by actual Person (by CPF extracted from OCR or Colaborador CPF)
  const byPerson = new Map();

  allAsos.forEach(doc => {
    const meta = metaByDocId.get(doc.id);
    const colab = colabById.get(doc.colaborador_id);
    const cpf = (meta?.cpf_documento || colab?.cpf || 'UNKNOWN').replace(/\D/g, '');
    const name = colab?.nome_completo || meta?.nome_clinica || doc.titulo;

    const personKey = cpf.length === 11 ? cpf : (doc.colaborador_id || 'ORPHAN');
    if (!byPerson.has(personKey)) {
      byPerson.set(personKey, {
        personKey,
        cpf,
        name,
        docs: []
      });
    }
    byPerson.get(personKey).docs.push({ doc, meta });
  });

  console.log(`Total Unique Persons with ASOs: ${byPerson.size}`);

  let grandTotalDocs = 0;
  let grandTotalLegitimateExams = 0;
  let grandTotalDuplicates = 0;

  const duplicatePlan = [];

  for (const [personKey, personData] of byPerson.entries()) {
    grandTotalDocs += personData.docs.length;

    // Group exams by (data_realizacao/data_emissao, data_validade, medico_crm/nome)
    const examGroups = new Map();

    personData.docs.forEach(item => {
      const { doc, meta } = item;
      // Normalization of realizacao date
      let dRealiz = meta?.data_realizacao || doc.data_emissao;
      // Normalization of validity
      let dValid = doc.data_validade;
      let crm = meta?.medico_crm || '';

      // If no date at all, check title
      let groupKey;
      if (dRealiz || dValid || crm) {
        groupKey = `DATE_${dRealiz || 'NULL'}_${dValid || 'NULL'}_${crm || 'NULL'}`;
      } else {
        groupKey = `TITLE_${doc.titulo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      }

      if (!examGroups.has(groupKey)) examGroups.set(groupKey, []);
      examGroups.get(groupKey).push(item);
    });

    grandTotalLegitimateExams += examGroups.size;

    console.log(`\n======================================================`);
    console.log(`👤 ${personData.name} (CPF: ${personData.cpf})`);
    console.log(`   Total registros ASO: ${personData.docs.length} | Exames reais distintos: ${examGroups.size}`);

    for (const [gKey, items] of examGroups.entries()) {
      if (items.length === 1) {
        const item = items[0];
        console.log(`   ✅ [Exame Único] ID: ${item.doc.id} | Titulo: ${item.doc.titulo} | Realiz: ${item.meta?.data_realizacao || item.doc.data_emissao} | Valid: ${item.doc.data_validade} | e-Social: ${item.meta?.esocial_status || 'sem_meta'}`);
      } else {
        const dups = items.length - 1;
        grandTotalDuplicates += dups;
        console.log(`   ⚠️ [${items.length} REPETIÇÕES] Chave: ${gKey}`);

        // Rank items to pick the best authoritative one to KEEP:
        const ranked = items.map(it => {
          let score = 0;
          const ev = s2220List.find(e => e.entidade_origem_id === it.doc.id);
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

        console.log(`      ⭐ MANTER: [${keeper.doc.id}] Titulo: "${keeper.doc.titulo}" | Rastreio: ${keeper.doc.numero_rastreio} | e-Social: ${keeper.meta?.esocial_status || 'N/A'}${keeper.ev?.numero_recibo ? ` (Recibo: ${keeper.ev.numero_recibo})` : ''} | OCR: ${keeper.doc.ocr_status}`);
        
        duplicates.forEach(dup => {
          console.log(`      ❌ DUPLICATA A REMOVER: [${dup.doc.id}] Titulo: "${dup.doc.titulo}" | Rastreio: ${dup.doc.numero_rastreio} | e-Social: ${dup.meta?.esocial_status || 'N/A'} | Created: ${dup.doc.created_at}`);
          duplicatePlan.push({
            personName: personData.name,
            cpf: personData.cpf,
            keeperId: keeper.doc.id,
            duplicateDocId: dup.doc.id,
            duplicateDocTitle: dup.doc.titulo,
            duplicateRastreio: dup.doc.numero_rastreio,
            duplicateEsocialStatus: dup.meta?.esocial_status,
            duplicateEventId: dup.ev?.id || null
          });
        });
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`RESUMO FINAL:`);
  console.log(`Total Documentos ASO: ${grandTotalDocs}`);
  console.log(`Total Exames Legítimos: ${grandTotalLegitimateExams}`);
  console.log(`Total Duplicatas Identificadas: ${grandTotalDuplicates}`);
  console.log(`Total no plano de deduplicação: ${duplicatePlan.length}`);
  console.log(`======================================================`);
}

run();
