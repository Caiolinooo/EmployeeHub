const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: events } = await supabase
    .from('esocial_eventos')
    .select('id, entidade_origem_id, evento_codigo, status, numero_recibo, protocolo_envio, cpf_trabalhador')
    .eq('evento_codigo', 'S-2220');

  console.log('All S-2220 events in esocial_eventos:');
  events.forEach(e => {
    console.log(`- Event [${e.id}] Status: ${e.status} | Recibo: ${e.numero_recibo || 'N/A'} | Entidade ID: ${e.entidade_origem_id} | CPF: ${e.cpf_trabalhador}`);
  });
}

run();
