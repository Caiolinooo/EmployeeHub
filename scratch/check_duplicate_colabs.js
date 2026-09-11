const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: colabs } = await supabase
    .from('gt_colaboradores')
    .select('id, nome_completo, cpf, matricula, status_embarque, deleted_at');

  const byCpf = new Map();
  (colabs || []).forEach(c => {
    if (c.deleted_at) return;
    const clean = c.cpf ? c.cpf.replace(/\D/g, '') : 'NO_CPF';
    if (!byCpf.has(clean)) byCpf.set(clean, []);
    byCpf.get(clean).push(c);
  });

  console.log('=== DUPLICATE COLABORADORES BY CPF ===');
  let dupColabs = 0;
  for (const [cpf, list] of byCpf.entries()) {
    if (list.length > 1 && cpf !== 'NO_CPF') {
      dupColabs++;
      console.log(`\nCPF: ${cpf} (${list.length} registros):`);
      list.forEach(c => {
        console.log(`  - ID: ${c.id} | Nome: ${c.nome_completo} | CPF gravado: "${c.cpf}" | Matrícula: ${c.matricula} | Status: ${c.status_embarque}`);
      });
    }
  }
  console.log(`\nTotal CPFs com colaboradores duplicados: ${dupColabs}`);
}

run();
