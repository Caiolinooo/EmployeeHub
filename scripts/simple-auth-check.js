/**
 * Script simples para verificar autenticação
 */

console.log('🔍 Verificação Simples de Autenticação');
console.log('====================================');

// Verificar variáveis de ambiente
console.log('📧 ADMIN_EMAIL:', process.env.ADMIN_EMAIL || 'Não definido');
console.log('📱 ADMIN_PHONE_NUMBER:', process.env.ADMIN_PHONE_NUMBER || 'Não definido');
console.log('🔑 ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? 'Definido' : 'Não definido');
console.log('🌐 SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'Não definido');
console.log('🔐 SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Definido' : 'Não definido');

console.log('\n✅ Script executado com sucesso!');
