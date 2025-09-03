// Script to extend permissions system
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const extendPermissions = async () => {
  console.log('🔐 Extending permissions system...');

  try {
    // Buscar todos os usuários
    const { data: users, error: usersError } = await supabase
      .from('users_unified')
      .select('id, first_name, last_name, role, access_permissions');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return false;
    }

    console.log(`📊 Found ${users.length} users to update`);

    let updatedCount = 0;
    const errors = [];

    // Atualizar cada usuário
    for (const user of users) {
      try {
        // Obter permissões atuais ou criar estrutura padrão
        const currentPermissions = user.access_permissions || {
          modules: {
            dashboard: true,
            manual: true,
            procedimentos: true,
            politicas: true,
            calendario: true,
            noticias: true,
            reembolso: true,
            contracheque: true,
            ponto: true,
            ...(user.role === 'ADMIN' ? { admin: true, avaliacao: true } : {}),
            ...(user.role === 'MANAGER' ? { avaliacao: true } : {})
          },
          features: {}
        };

        // Garantir que a estrutura features existe
        if (!currentPermissions.features) {
          currentPermissions.features = {};
        }

        // Definir novas permissões baseadas no role
        const newFeatures = { ...currentPermissions.features };

        switch (user.role) {
          case 'ADMIN':
            newFeatures.academy_editor = true;
            newFeatures.academy_moderator = true;
            newFeatures.social_editor = true;
            newFeatures.social_moderator = true;
            break;

          case 'MANAGER':
            newFeatures.academy_editor = false;
            newFeatures.academy_moderator = true;
            newFeatures.social_editor = false;
            newFeatures.social_moderator = true;
            break;

          case 'USER':
          default:
            newFeatures.academy_editor = false;
            newFeatures.academy_moderator = false;
            newFeatures.social_editor = false;
            newFeatures.social_moderator = false;
            break;
        }

        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('users_unified')
          .update({
            access_permissions: {
              ...currentPermissions,
              features: newFeatures
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`❌ Error updating ${user.first_name} ${user.last_name}:`, updateError);
          errors.push({
            user: `${user.first_name} ${user.last_name}`,
            error: updateError.message
          });
        } else {
          updatedCount++;
          console.log(`✅ Updated ${user.first_name} ${user.last_name} (${user.role})`);
        }

      } catch (error) {
        console.error(`❌ Error processing ${user.first_name} ${user.last_name}:`, error);
        errors.push({
          user: `${user.first_name} ${user.last_name}`,
          error: error.message
        });
      }
    }

    // Verificar se tabela ACL existe e inserir permissões
    const { data: aclTable, error: aclError } = await supabase
      .from('acl_permissions')
      .select('id')
      .limit(1);

    let aclInserted = 0;
    if (!aclError) {
      console.log('📋 ACL table exists, inserting new permissions...');
      
      const academyPermissions = [
        { name: 'academy.read', description: 'Visualizar cursos da academy', resource: 'academy', action: 'read', level: 0 },
        { name: 'academy.enroll', description: 'Matricular-se em cursos', resource: 'academy', action: 'enroll', level: 0 },
        { name: 'academy.comment', description: 'Comentar em cursos', resource: 'academy', action: 'comment', level: 0 },
        { name: 'academy.rate', description: 'Avaliar cursos', resource: 'academy', action: 'rate', level: 0 },
        { name: 'academy.create', description: 'Criar cursos', resource: 'academy', action: 'create', level: 2 },
        { name: 'academy.update', description: 'Editar cursos', resource: 'academy', action: 'update', level: 2 },
        { name: 'academy.delete', description: 'Excluir cursos', resource: 'academy', action: 'delete', level: 2 },
        { name: 'academy.publish', description: 'Publicar cursos', resource: 'academy', action: 'publish', level: 2 },
        { name: 'academy.moderate', description: 'Moderar comentários e avaliações', resource: 'academy', action: 'moderate', level: 1 }
      ];

      const socialPermissions = [
        { name: 'social.read', description: 'Visualizar posts sociais', resource: 'social', action: 'read', level: 0 },
        { name: 'social.create', description: 'Criar posts', resource: 'social', action: 'create', level: 0 },
        { name: 'social.update', description: 'Editar posts próprios', resource: 'social', action: 'update', level: 0 },
        { name: 'social.delete', description: 'Excluir posts próprios', resource: 'social', action: 'delete', level: 0 },
        { name: 'social.like', description: 'Curtir posts', resource: 'social', action: 'like', level: 0 },
        { name: 'social.comment', description: 'Comentar em posts', resource: 'social', action: 'comment', level: 0 },
        { name: 'social.follow', description: 'Seguir usuários', resource: 'social', action: 'follow', level: 0 },
        { name: 'social.story', description: 'Criar stories', resource: 'social', action: 'story', level: 0 },
        { name: 'social.create.official', description: 'Criar posts oficiais', resource: 'social', action: 'create_official', level: 2 },
        { name: 'social.moderate', description: 'Moderar conteúdo social', resource: 'social', action: 'moderate', level: 1 },
        { name: 'social.analytics', description: 'Ver analytics sociais', resource: 'social', action: 'analytics', level: 2 }
      ];

      const allPermissions = [...academyPermissions, ...socialPermissions];

      for (const permission of allPermissions) {
        try {
          const { error: insertError } = await supabase
            .from('acl_permissions')
            .upsert(permission, { onConflict: 'name', ignoreDuplicates: true });

          if (!insertError) {
            aclInserted++;
          }
        } catch (error) {
          console.error(`❌ Error inserting ACL permission ${permission.name}:`, error);
        }
      }
    } else {
      console.log('⚠️ ACL table not found, skipping ACL permissions');
    }

    console.log('\n🎉 Permissions extension completed!');
    console.log(`📊 Users updated: ${updatedCount}/${users.length}`);
    console.log(`🔐 ACL permissions inserted: ${aclInserted}`);
    
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      errors.forEach(error => {
        console.log(`  - ${error.user}: ${error.error}`);
      });
    }

    return true;

  } catch (error) {
    console.error('❌ Error extending permissions:', error);
    return false;
  }
};

// Run the script
extendPermissions().then(success => {
  if (success) {
    console.log('\n✅ Permissions system extended successfully!');
    console.log('\n📋 New features added:');
    console.log('  - academy_editor: Create and edit academy courses');
    console.log('  - academy_moderator: Moderate academy comments and ratings');
    console.log('  - social_editor: Create official posts and manage social content');
    console.log('  - social_moderator: Moderate social posts and comments');
  } else {
    console.log('\n❌ Failed to extend permissions system');
  }
});
