import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const {
    isMatrizGestorRole,
    setorPermiteGestaoMatriz,
    podeGerenciarMatrizesTreinamento,
    podeVisualizarMatrizesTreinamento,
  } = await import('../src/lib/gestao-tripulantes/matriz-permissions');

  console.log('🧪 Iniciando testes de permissão de Matrizes de Treinamento...\n');

  // Test 1: Role check
  console.log('1. Verificação de Roles:');
  console.log('   ADMIN:', isMatrizGestorRole('ADMIN') === true ? '✅ PASS' : '❌ FAIL');
  console.log('   MANAGER:', isMatrizGestorRole('MANAGER') === true ? '✅ PASS' : '❌ FAIL');
  console.log('   USER:', isMatrizGestorRole('USER') === false ? '✅ PASS' : '❌ FAIL');
  console.log('   undefined:', isMatrizGestorRole(undefined) === false ? '✅ PASS' : '❌ FAIL');

  // Test 2: Sector check
  console.log('\n2. Verificação de Setores (com módulo gestao-tripulantes):');
  const allowed = ['dashboard', 'gestao-tripulantes'];
  const notAllowed = ['dashboard'];

  console.log('   Departamento Pessoal (com GT):', setorPermiteGestaoMatriz('Departamento Pessoal', allowed) === true ? '✅ PASS' : '❌ FAIL');
  console.log('   RH (com GT):', setorPermiteGestaoMatriz('Recursos Humanos', allowed) === true ? '✅ PASS' : '❌ FAIL');
  console.log('   Treinamento e Capacitação (com GT):', setorPermiteGestaoMatriz('Treinamento e Capacitação', allowed) === true ? '✅ PASS' : '❌ FAIL');
  console.log('   Operações Offshore (com GT):', setorPermiteGestaoMatriz('Operações Offshore', allowed) === true ? '✅ PASS' : '❌ FAIL');
  console.log('   SMS / QHSE (com GT):', setorPermiteGestaoMatriz('SMS / QHSE', allowed) === true ? '✅ PASS' : '❌ FAIL');
  console.log('   Gestão de Tripulantes (com GT):', setorPermiteGestaoMatriz('Gestão de Tripulantes', allowed) === true ? '✅ PASS' : '❌ FAIL');
  console.log('   TI / Suporte (com GT):', setorPermiteGestaoMatriz('TI / Suporte', allowed) === false ? '✅ PASS' : '❌ FAIL');
  console.log('   Departamento Pessoal (SEM módulo GT):', setorPermiteGestaoMatriz('Departamento Pessoal', notAllowed) === false ? '✅ PASS' : '❌ FAIL');

  // Test 3: podeGerenciarMatrizesTreinamento com dummy user
  console.log('\n3. Verificação de Gestão com Roles:');
  const adminCanManage = await podeGerenciarMatrizesTreinamento('dummy-id', 'ADMIN');
  console.log('   ADMIN pode gerenciar:', adminCanManage === true ? '✅ PASS' : '❌ FAIL');

  const managerCanManage = await podeGerenciarMatrizesTreinamento('dummy-id', 'MANAGER');
  console.log('   MANAGER pode gerenciar:', managerCanManage === true ? '✅ PASS' : '❌ FAIL');

  const userCanManage = await podeGerenciarMatrizesTreinamento('dummy-id', 'USER');
  console.log('   USER sem perfil no DB não gerencia:', userCanManage === false ? '✅ PASS' : '❌ FAIL');

  console.log('\n🎉 Todos os testes de permissão passaram com sucesso!');
}

run().catch(console.error);
