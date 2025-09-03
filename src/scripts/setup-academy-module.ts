/**
 * Script para configurar o módulo Academy no sistema
 * Este script garante que o módulo Academy esteja disponível para todos os usuários
 */

import { supabaseAdmin } from '@/lib/supabase';

async function setupAcademyModule() {
  console.log('🚀 Configurando módulo Academy...');

  try {
    // 1. Verificar se existe uma tabela de módulos
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('modules')
      .select('*')
      .eq('key', 'academy');

    if (modulesError && modulesError.code !== 'PGRST116') {
      console.error('Erro ao verificar módulos:', modulesError);
    }

    // 2. Se existe tabela de módulos, adicionar o Academy
    if (!modulesError && (!modules || modules.length === 0)) {
      console.log('📝 Adicionando módulo Academy à tabela de módulos...');
      
      const { error: insertError } = await supabaseAdmin
        .from('modules')
        .insert({
          key: 'academy',
          name: 'ABZ Academy',
          description: 'Centro de treinamento e desenvolvimento profissional',
          enabled: true,
          order: 12,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Erro ao inserir módulo Academy:', insertError);
      } else {
        console.log('✅ Módulo Academy adicionado com sucesso!');
      }
    }

    // 3. Verificar se existe uma tabela de permissões de usuário
    const { data: userPermissions, error: permissionsError } = await supabaseAdmin
      .from('user_permissions')
      .select('user_id')
      .limit(1);

    if (!permissionsError) {
      console.log('📝 Adicionando permissões do Academy para todos os usuários...');
      
      // Buscar todos os usuários ativos
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users_unified')
        .select('id')
        .eq('is_active', true);

      if (usersError) {
        console.error('Erro ao buscar usuários:', usersError);
      } else if (users) {
        // Adicionar permissão do Academy para cada usuário
        const permissions = users.map(user => ({
          user_id: user.id,
          module_key: 'academy',
          can_access: true,
          created_at: new Date().toISOString()
        }));

        const { error: insertPermissionsError } = await supabaseAdmin
          .from('user_permissions')
          .upsert(permissions, { 
            onConflict: 'user_id,module_key',
            ignoreDuplicates: false 
          });

        if (insertPermissionsError) {
          console.error('Erro ao inserir permissões:', insertPermissionsError);
        } else {
          console.log(`✅ Permissões do Academy adicionadas para ${users.length} usuários!`);
        }
      }
    }

    // 4. Verificar se existe uma tabela de cards do dashboard
    const { data: dashboardCards, error: cardsError } = await supabaseAdmin
      .from('dashboard_cards')
      .select('*')
      .eq('module_key', 'academy');

    if (!cardsError && (!dashboardCards || dashboardCards.length === 0)) {
      console.log('📝 Adicionando card do Academy ao dashboard...');
      
      const { error: insertCardError } = await supabaseAdmin
        .from('dashboard_cards')
        .insert({
          id: 'academy',
          title: 'ABZ Academy',
          description: 'Centro de treinamento e desenvolvimento profissional',
          href: '/academy',
          icon_name: 'FiPlay',
          color: 'bg-blue-600',
          hover_color: 'hover:bg-blue-700',
          enabled: true,
          order: 12,
          admin_only: false,
          manager_only: false,
          module_key: 'academy',
          created_at: new Date().toISOString()
        });

      if (insertCardError) {
        console.error('Erro ao inserir card do Academy:', insertCardError);
      } else {
        console.log('✅ Card do Academy adicionado ao dashboard!');
      }
    }

    // 5. Verificar se as tabelas do Academy existem
    console.log('📝 Verificando tabelas do Academy...');
    
    const tables = [
      'academy_categories',
      'academy_courses', 
      'academy_enrollments',
      'academy_progress',
      'academy_comments',
      'academy_ratings'
    ];

    for (const table of tables) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`⚠️  Tabela ${table} não encontrada ou inacessível:`, error.message);
      } else {
        console.log(`✅ Tabela ${table} está acessível`);
      }
    }

    console.log('🎉 Configuração do módulo Academy concluída!');
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('1. Faça logout e login novamente para atualizar as permissões');
    console.log('2. Verifique se o card do Academy aparece no dashboard');
    console.log('3. Se ainda não aparecer, verifique as configurações de módulos no admin');

  } catch (error) {
    console.error('❌ Erro durante a configuração:', error);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  setupAcademyModule()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

export { setupAcademyModule };
