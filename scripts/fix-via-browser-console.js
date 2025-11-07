/**
 * Execute este código no console do navegador (F12) enquanto estiver logado no sistema
 *
 * Como usar:
 * 1. Faça login no sistema (https://painelabz.netlify.app)
 * 2. Abra o console (F12 → Console)
 * 3. Cole este código completo
 * 4. Pressione Enter
 * 5. Aguarde a mensagem de sucesso
 */

async function fixEmailVerifiedUsers() {
  console.log('🔧 Iniciando correção de email_verified...\n');

  try {
    // Pegar o token do localStorage
    const token = localStorage.getItem('token');

    if (!token) {
      console.error('❌ Token não encontrado. Faça login primeiro!');
      return;
    }

    console.log('✅ Token encontrado');

    // Fazer a requisição
    const response = await fetch('/api/admin/fix-email-verified', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na requisição:', response.status, errorText);
      return;
    }

    const result = await response.json();

    console.log('\n✅ SUCESSO!');
    console.log('📊 Resultado:', result);
    console.log(`\n✅ ${result.updated} usuários atualizados:`);

    result.users.forEach(user => {
      console.log(`  - ${user.name} (${user.email})`);
    });

    console.log('\n🎉 Agora os usuários podem fazer login!');

    return result;

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Executar a função
fixEmailVerifiedUsers();
