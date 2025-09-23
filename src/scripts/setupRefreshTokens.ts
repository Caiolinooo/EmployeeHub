/**
 * Script para configurar a tabela de refresh tokens
 * Execute este script para criar a estrutura necessária no banco de dados
 */

import { createRefreshTokensTableDirect } from '@/lib/createRefreshTokensTable';

async function main() {
  console.log('🚀 Configurando sistema de refresh tokens...');
  
  try {
    const success = await createRefreshTokensTableDirect();
    
    if (success) {
      console.log('✅ Configuração concluída com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('1. Execute o script SQL mostrado no console no Supabase Dashboard');
      console.log('2. Teste o sistema de login com "lembrar-me"');
      console.log('3. Verifique se os refresh tokens estão sendo salvos');
    } else {
      console.log('❌ Erro na configuração');
    }
  } catch (error) {
    console.error('❌ Erro ao configurar refresh tokens:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

export default main;
