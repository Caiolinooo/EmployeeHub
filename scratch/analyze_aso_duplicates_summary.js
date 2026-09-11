const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allColabs } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf')
    .is('deleted_at', null);

  const colabMap = new Map(allColabs.map(c => [c.id, c]));

  const { data: docAsos } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const { data: asoMeta } = await supabase
    .from('gt_documentos_aso')
    .select('*');
  const metaMap = new Map(asoMeta.map(m => [m.documento_id, m]));

  const { data: esocialEvents } = await supabase
    .from('esocial_eventos')
    .select('*')
    .eq('evento_codigo', 'S-2220');

  // Summary per collaborator
  const byColab = new Map();
  docAsos.forEach(d => {
    const cid = d.colaborador_id || 'NULL_COLAB';
    if (!byColab.has(cid)) byColab.set(cid, []);
    byColab.get(cid).push({
      ...d,
      meta: metaMap.get(d.id) || null
    });
  });

  const colabSummary = [];

  for (const [cid, docs] of byColab.entries()) {
    const colab = colabMap.get(cid);
    const colabName = colab ? colab.nome_completo : `[SEM COLABORADOR VINCULADO - ID: ${cid}]`;
    const cpf = colab ? colab.cpf : '—';

    // Group into distinct exams
    // Group criteria:
    // 1. Same OCR data_realizacao or data_emissao
    // 2. Same data_validade (or both null)
    // 3. Same CRM or doctor name (or title similarity if OCR not run)
    const distinctGroups = new Map();

    docs.forEach(doc => {
      const dataRealiz = doc.meta?.data_realizacao || doc.data_emissao || 'ND';
      const dataValid = doc.data_validade || 'ND';
      const crm = doc.meta?.medico_crm || 'ND';
      
      // If OCR hasn't run yet, group by normalized title or filename
      const titleNorm = doc.titulo.toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = (dataRealiz !== 'ND' || dataValid !== 'ND' || crm !== 'ND')
        ? `${dataRealiz}_${dataValid}_${crm}`
        : `TITLE_${titleNorm}`;

      if (!distinctGroups.has(key)) distinctGroups.set(key, []);
      distinctGroups.get(key).push(doc);
    });

    let dupCount = 0;
    const groupsDetail = [];

    for (const [gKey, gDocs] of distinctGroups.entries()) {
      if (gDocs.length > 1) {
        dupCount += (gDocs.length - 1);
      }
      // Determine the best keeper for each group:
      // Priority:
      // 1. Has e-Social event with recibo (status = processado)
      // 2. Has e-Social status in ('enviado', 'processado')
      // 3. Has e-Social status in ('pendente', 'erro')
      // 4. Has ocr_status = 'concluido'
      // 5. Most complete metadata
      // 6. Most recent created_at
      const scored = gDocs.map(d => {
        let score = 0;
        const eStat = d.meta?.esocial_status || '';
        const ev = esocialEvents.find(e => e.entidade_origem_id === d.id);
        if (ev?.numero_recibo || eStat === 'processado') score += 1000;
        else if (eStat === 'enviado') score += 500;
        else if (eStat === 'pendente') score += 100;
        else if (eStat === 'erro') score += 50;

        if (d.ocr_status === 'concluido') score += 20;
        if (d.data_validade) score += 10;
        if (d.data_emissao) score += 5;
        if (d.arquivo_url) score += 5;
        if (d.meta?.medico_crm) score += 5;
        if (d.meta?.resultado) score += 5;

        return { doc: d, score, ev };
      });

      scored.sort((a, b) => b.score - a.score || new Date(b.doc.created_at).getTime() - new Date(a.doc.created_at).getTime());
      const keeper = scored[0];
      const duplicatesToDelete = scored.slice(1);

      groupsDetail.push({
        groupKey: gKey,
        totalDocs: gDocs.length,
        keeper: {
          id: keeper.doc.id,
          titulo: keeper.doc.titulo,
          rastreio: keeper.doc.numero_rastreio,
          esocial_status: keeper.doc.meta?.esocial_status || 'sem_meta',
          recibo: keeper.ev?.numero_recibo || keeper.doc.meta?.esocial_numero_recibo || null,
          data_realizacao: keeper.doc.meta?.data_realizacao || keeper.doc.data_emissao,
          data_validade: keeper.doc.data_validade,
          medico: keeper.doc.meta?.medico_nome,
          created_at: keeper.doc.created_at
        },
        duplicates: duplicatesToDelete.map(x => ({
          id: x.doc.id,
          titulo: x.doc.titulo,
          rastreio: x.doc.numero_rastreio,
          esocial_status: x.doc.meta?.esocial_status || 'sem_meta',
          recibo: x.ev?.numero_recibo || x.doc.meta?.esocial_numero_recibo || null,
          data_realizacao: x.doc.meta?.data_realizacao || x.doc.data_emissao,
          data_validade: x.doc.data_validade,
          created_at: x.doc.created_at
        }))
      });
    }

    colabSummary.push({
      colaboradorId: cid,
      nome: colabName,
      cpf,
      totalAsoDocs: docs.length,
      distinctExamsCount: distinctGroups.size,
      duplicateCount: dupCount,
      groups: groupsDetail
    });
  }

  // Print high-level overview
  console.log('=== VISÃO GERAL DE ASOS POR COLABORADOR ===\n');
  let totalDocsAll = 0;
  let totalExamesAll = 0;
  let totalDupsAll = 0;

  colabSummary.forEach(cs => {
    totalDocsAll += cs.totalAsoDocs;
    totalExamesAll += cs.distinctExamsCount;
    totalDupsAll += cs.duplicateCount;

    console.log(`👤 ${cs.nome} (CPF: ${cs.cpf})`);
    console.log(`   Total ASOs: ${cs.totalAsoDocs} | Exames Únicos: ${cs.distinctExamsCount} | Duplicatas: ${cs.duplicateCount}`);
    if (cs.duplicateCount > 0) {
      cs.groups.filter(g => g.duplicates.length > 0).forEach((g, gIdx) => {
        console.log(`   ├─ 📦 Grupo de Duplicação ${gIdx + 1} (${g.totalDocs} cópias para o exame de ${g.keeper.data_realizacao}):`);
        console.log(`   │    ⭐ Manter: [${g.keeper.id}] "${g.keeper.titulo}" (Rastreio: ${g.keeper.rastreio}, e-Social: ${g.keeper.esocial_status}${g.keeper.recibo ? `, Recibo: ${g.keeper.recibo}` : ''})`);
        g.duplicates.forEach(dup => {
          console.log(`   │    ❌ Excluir duplicata: [${dup.id}] "${dup.titulo}" (Rastreio: ${dup.rastreio}, e-Social: ${dup.esocial_status})`);
        });
      });
    }
    console.log('');
  });

  console.log(`=============================================`);
  console.log(`TOTAL GERAL:`);
  console.log(`Documentos ASO cadastrados: ${totalDocsAll}`);
  console.log(`Exames distintos legítimos: ${totalExamesAll}`);
  console.log(`Total de duplicatas redundantes: ${totalDupsAll}`);
  console.log(`=============================================`);
}

run();
