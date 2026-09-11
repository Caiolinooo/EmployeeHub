const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testColabView(colabId) {
  const { data: colab } = await supabase
    .from('gt_vw_colaboradores_completo')
    .select('*')
    .eq('id', colabId)
    .single();

  if (!colab) {
    console.log(`Colab ${colabId} not found in gt_vw_colaboradores_completo`);
    return;
  }

  const { data: allDocs } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('colaborador_id', colabId)
    .is('deleted_at', null)
    .order('data_validade', { ascending: false, nullsFirst: false });

  let documentos = allDocs || [];
  const asoDocIds = documentos.filter(d => d.tipo_documento === 'aso').map(d => d.id);
  if (asoDocIds.length > 0) {
    const { data: asoRecords } = await supabase
      .from('gt_documentos_aso')
      .select('*')
      .in('documento_id', asoDocIds);

    const asoDataMap = {};
    (asoRecords || []).forEach(r => { asoDataMap[r.documento_id] = r; });

    const { data: eventosVinculados } = await supabase
      .from('esocial_eventos')
      .select('id, evento_codigo, status, protocolo_envio, numero_recibo, data_envio, data_processamento, entidade_origem_id, created_at')
      .in('entidade_origem_id', asoDocIds)
      .order('created_at', { ascending: false });

    const eventoPorDocId = {};
    (eventosVinculados || []).forEach(ev => {
      if (!eventoPorDocId[ev.entidade_origem_id]) eventoPorDocId[ev.entidade_origem_id] = ev;
    });

    documentos = documentos.map(doc => {
      if (doc.tipo_documento === 'aso') {
        const ev = eventoPorDocId[doc.id];
        return {
          ...doc,
          aso_data: {
            ...(asoDataMap[doc.id] || {}),
            ...(ev ? {
              esocial_evento_ref: {
                id: ev.id,
                evento_codigo: ev.evento_codigo,
                status: ev.status,
                numero_recibo: ev.numero_recibo,
                protocolo_envio: ev.protocolo_envio,
                data_envio: ev.data_envio,
                data_processamento: ev.data_processamento,
              }
            } : {})
          }
        };
      }
      return doc;
    });
  }

  // Deduplication as implemented in route
  const seenTitles = new Set();
  documentos = documentos.filter(d => {
    if (d.tipo_documento !== 'treinamento') return true;
    if (!d.titulo) return true;
    const key = d.titulo.toLowerCase().trim();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  const asoMap = new Map();
  const nonAsoDocs = [];

  documentos.forEach(d => {
    if (d.tipo_documento === 'aso') {
      const dRealiz = d.aso_data?.data_realizacao || d.data_emissao || 'SEM_DATA';
      const dValid = d.data_validade || 'SEM_VALIDADE';
      const key = `${dRealiz}_${dValid}`;
      
      const existing = asoMap.get(key);
      if (!existing) {
        asoMap.set(key, d);
      } else {
        const existingScore =
          (existing.aso_data?.esocial_evento_ref?.numero_recibo || existing.aso_data?.esocial_status === 'processado' ? 1000 : 0) +
          (existing.aso_data?.esocial_status === 'enviado' ? 500 : 0) +
          (existing.ocr_status === 'concluido' ? 50 : 0);
        const currentScore =
          (d.aso_data?.esocial_evento_ref?.numero_recibo || d.aso_data?.esocial_status === 'processado' ? 1000 : 0) +
          (d.aso_data?.esocial_status === 'enviado' ? 500 : 0) +
          (d.ocr_status === 'concluido' ? 50 : 0);
        if (currentScore > existingScore) {
          asoMap.set(key, d);
        }
      }
    } else {
      nonAsoDocs.push(d);
    }
  });

  const uniqueAsos = Array.from(asoMap.values()).sort((a, b) => {
    const dateA = a.aso_data?.data_realizacao || a.data_emissao || '';
    const dateB = b.aso_data?.data_realizacao || b.data_emissao || '';
    return dateB.localeCompare(dateA);
  });

  documentos = [...uniqueAsos, ...nonAsoDocs];

  console.log(`\n======================================================`);
  console.log(`👤 ${colab.nome_completo} (CPF: ${colab.cpf}, Cargo: ${colab.cargo_nome || 'N/A'}, Embarcação: ${colab.embarcacao_nome || 'N/A'}, Matrícula: ${colab.matricula})`);
  console.log(`Total Documentos entregues pela API: ${documentos.length}`);
  
  const asosEntregues = documentos.filter(d => d.tipo_documento === 'aso');
  const treinamentosEntregues = documentos.filter(d => d.tipo_documento === 'treinamento');
  const outrosEntregues = documentos.filter(d => d.tipo_documento !== 'aso' && d.tipo_documento !== 'treinamento');

  console.log(`• ASOs (${asosEntregues.length}):`);
  asosEntregues.forEach((a, i) => {
    console.log(`   [${i+1}] ${a.titulo} | Realização: ${a.aso_data?.data_realizacao || a.data_emissao} | Validade: ${a.data_validade} | e-Social: ${a.aso_data?.esocial_status}${a.aso_data?.esocial_evento_ref?.numero_recibo ? ` (Recibo: ${a.aso_data.esocial_evento_ref.numero_recibo})` : ''}`);
  });

  console.log(`• Treinamentos (${treinamentosEntregues.length}):`);
  treinamentosEntregues.forEach((t, i) => {
    console.log(`   [${i+1}] ${t.titulo} | Validade: ${t.data_validade || 'N/A'}`);
  });

  if (outrosEntregues.length > 0) {
    console.log(`• Outros (${outrosEntregues.length}):`);
    outrosEntregues.forEach((o, i) => {
      console.log(`   [${i+1}] [${o.tipo_documento}] ${o.titulo}`);
    });
  }
}

async function run() {
  // Vinicius Pereira de Oliveira
  await testColabView('9af7dceb-f7f7-43d9-81e1-87806307739f');

  // Ludmilla Silva Oliveira
  await testColabView('6f964ea9-f278-4cc2-8999-3db920f38534');

  // Caio Valerio Goulart Correia
  await testColabView('ad6053bc-517d-4a4b-9dae-33dde2609f6e');

  // Gabriela Valentim de Moraes
  await testColabView('759043dc-fc50-4d77-9466-15cca74205b8');
}

run();
