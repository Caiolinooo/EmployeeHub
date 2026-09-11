import { consolidarEventosDaEmpresa } from '../src/lib/e-social/esocial-consolidator';
import { supabaseAdmin } from '../src/lib/supabase';

async function main() {
  console.log('=== TESTANDO CONSOLIDADOR DO E-SOCIAL ===');
  
  const res = await consolidarEventosDaEmpresa();
  console.log('Resultado da Consolidação:', JSON.stringify(res, null, 2));

  // Verificar tabela esocial_eventos enriquecida
  const { data: eventos } = await supabaseAdmin
    .from('esocial_eventos')
    .select('id, evento_codigo, cpf_trabalhador, status, modulo_origem, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\nTop 20 eventos em esocial_eventos:');
  console.table(eventos);
}

main().catch(console.error);
