const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allColabs } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, matricula')
    .is('deleted_at', null);

  const colabMap = new Map(allColabs.map(c => [c.id, c]));

  const { data: allAsos } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const { data: asoMeta } = await supabase
    .from('gt_documentos_aso')
    .select('*');
  const metaMap = new Map(asoMeta.map(m => [m.documento_id, m]));

  const { data: s2220List } = await supabase
    .from('esocial_eventos')
    .select('*')
    .eq('evento_codigo', 'S-2220');

  // Let's list all 32 legitimate historical ASO exams
  // Group by (person_cpf, data_realizacao/data_emissao, data_validade, crm)
  const exams = new Map();

  allAsos.forEach(doc => {
    const meta = metaMap.get(doc.id);
    const colab = colabMap.get(doc.colaborador_id);
    const cpf = (meta?.cpf_documento || colab?.cpf || 'UNKNOWN').replace(/\D/g, '');
    const name = colab?.nome_completo || meta?.nome_clinica || doc.titulo;

    const dataRealiz = meta?.data_realizacao || doc.data_emissao;
    const dataValid = doc.data_validade;
    const crm = meta?.medico_crm || '';
    
    let key;
    if (dataRealiz || dataValid || crm) {
      key = `${cpf}_${dataRealiz || 'NULL'}_${dataValid || 'NULL'}_${crm || 'NULL'}`;
    } else {
      key = `${cpf}_TITLE_${doc.titulo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }

    if (!exams.has(key)) {
      exams.set(key, {
        cpf,
        name,
        colaborador_id: doc.colaborador_id,
        key,
        docs: []
      });
    }
    exams.get(key).docs.push({ doc, meta });
  });

  console.log(`=== OS 32 EXAMES LEGÍTIMOS QUE COMPÕEM O HISTÓRICO COMPLETO ===\n`);
  let idx = 1;
  for (const [k, item] of exams.entries()) {
    // Pick keeper
    const ranked = item.docs.map(it => {
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

      return { ...it, score, ev };
    });
    ranked.sort((a, b) => b.score - a.score || new Date(b.doc.created_at).getTime() - new Date(a.doc.created_at).getTime());
    const keeper = ranked[0];

    const dRealiz = keeper.meta?.data_realizacao || keeper.doc.data_emissao || '—';
    const dValid = keeper.doc.data_validade || '—';
    const tipo = keeper.meta?.tipo_exame || '—';
    const res = keeper.meta?.resultado || '—';
    const med = keeper.meta?.medico_nome || '—';
    const crm = keeper.meta?.medico_crm || '—';
    const eStat = keeper.meta?.esocial_status || '—';
    const recibo = keeper.ev?.numero_recibo || '—';
    const copies = item.docs.length;

    console.log(`${idx}. Colaborador: ${item.name} (CPF: ${item.cpf})`);
    console.log(`   - Tipo: ${tipo.toUpperCase()} | Resultado: ${res.toUpperCase()}`);
    console.log(`   - Realização: ${dRealiz} | Validade: ${dValid}`);
    console.log(`   - Médico: ${med} (CRM: ${crm})`);
    console.log(`   - e-Social: ${eStat.toUpperCase()} ${recibo !== '—' ? `| Recibo: ${recibo}` : ''}`);
    console.log(`   - Doc ID Mantido: ${keeper.doc.id} (Rastreio: ${keeper.doc.numero_rastreio})`);
    console.log(`   - Total de Cópias no Banco: ${copies} (${copies > 1 ? `${copies - 1} duplicatas serão removidas` : 'sem duplicata'})`);
    console.log('');
    idx++;
  }
}

run();
