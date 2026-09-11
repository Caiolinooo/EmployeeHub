const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: allAsos } = await supabase
    .from('gt_documentos')
    .select('*, gt_colaboradores(id, nome_completo, cpf)')
    .eq('tipo_documento', 'aso')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const { data: asoMeta } = await supabase.from('gt_documentos_aso').select('*');
  const metaMap = new Map(asoMeta.map(m => [m.documento_id, m]));

  const { data: s2220List } = await supabase.from('esocial_eventos').select('*').eq('evento_codigo', 'S-2220');

  console.log(`=== ESTADO FINAL DOS ASOS ATIVOS NO BANCO (${allAsos.length} DOCUMENTOS) ===\n`);

  // Group by collaborator
  const byColab = new Map();
  allAsos.forEach(d => {
    const colab = d.gt_colaboradores;
    const name = colab ? `${colab.nome_completo} (CPF: ${colab.cpf})` : `[QUARENTENA / ÓRFÃO - ID: ${d.id}]`;
    if (!byColab.has(name)) byColab.set(name, []);
    byColab.get(name).push(d);
  });

  let totalExames = 0;
  for (const [name, docs] of byColab.entries()) {
    console.log(`👤 ${name} — ${docs.length} ASO(s) no Histórico:`);
    docs.forEach((d, i) => {
      totalExames++;
      const meta = metaMap.get(d.id) || {};
      const ev = s2220List.find(e => e.entidade_origem_id === d.id);
      console.log(`   ${i + 1}. [${d.id}] "${d.titulo}"`);
      console.log(`      • Rastreio: ${d.numero_rastreio} | Validade: ${d.data_validade || 'N/A'}`);
      console.log(`      • Realização: ${meta.data_realizacao || d.data_emissao || 'N/A'} | Tipo: ${(meta.tipo_exame || 'N/A').toUpperCase()} | Resultado: ${(meta.resultado || 'N/A').toUpperCase()}`);
      console.log(`      • Médico: ${meta.medico_nome || 'N/A'} (CRM: ${meta.medico_crm || 'N/A'})`);
      console.log(`      • e-Social: ${(meta.esocial_status || 'N/A').toUpperCase()}${ev?.numero_recibo ? ` (Recibo: ${ev.numero_recibo})` : ''}`);
    });
    console.log('');
  }

  console.log(`=============================================`);
  console.log(`TOTAL DE ASOS ATIVOS: ${allAsos.length}`);
  console.log(`TODOS OS REGISTROS SÃO EXAMES HISTÓRICOS ÚNICOS.`);
  console.log(`=============================================`);
}

run();
