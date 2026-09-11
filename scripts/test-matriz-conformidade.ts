import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verify() {
  const { supabaseAdmin } = await import('../src/lib/supabase');
  console.log('=== VERIFICANDO MATRIZES E CONFORMIDADE ===');

  // 1. Matrizes
  const { data: matrizes, error: errMat } = await supabaseAdmin
    .from('gt_matrizes_treinamento')
    .select('*, gt_matriz_treinamento_requisitos(count)');
  
  if (errMat) {
    console.error('Erro ao buscar matrizes:', errMat);
    process.exit(1);
  }
  console.log('Matrizes cadastradas:', matrizes.map(m => ({ id: m.id, codigo: m.codigo, nome: m.nome, requisitos: m.gt_matriz_treinamento_requisitos })));

  // 2. Requisitos da matriz CASTORONE
  const { data: reqs, error: errReqs } = await supabaseAdmin
    .from('gt_matriz_treinamento_requisitos')
    .select('cargo_nome, treinamento_nome, regime, obrigatorio');
  
  console.log(`Total de requisitos cadastrados: ${reqs?.length}`);
  console.log('Amostra de requisitos:', reqs?.slice(0, 6));

  // 3. Colaboradores com cargos compatíveis
  const { data: colabs } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, nome_completo, cargo_id, gt_cargos(nome)')
    .limit(4);
  
  console.log('Amostra de colaboradores no banco:', colabs?.map(c => ({ id: c.id, nome: c.nome_completo, cargo: (c.gt_cargos as any)?.nome })));

  console.log('=== TESTE CONCLUÍDO COM SUCESSO ===');
}

verify().catch(console.error);
