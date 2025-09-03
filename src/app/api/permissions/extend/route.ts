import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Extending permissions system for Academy and Social...');

    // Verificar se o usuário é admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    // Buscar todos os usuários para atualizar suas permissões
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, access_permissions, first_name, last_name');

    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
    }

    let updatedCount = 0;
    const errors = [];

    // Atualizar permissões de cada usuário
    for (const user of allUsers) {
      try {
        // Obter permissões atuais ou criar estrutura padrão
        const currentPermissions = user.access_permissions || {
          modules: {},
          features: {}
        };

        // Garantir que a estrutura features existe
        if (!currentPermissions.features) {
          currentPermissions.features = {};
        }

        // Definir permissões baseadas no role
        const newFeatures = { ...currentPermissions.features };

        switch (user.role) {
          case 'ADMIN':
            // Admins têm todas as permissões
            newFeatures.academy_editor = true;
            newFeatures.academy_moderator = true;
            newFeatures.social_editor = true;
            newFeatures.social_moderator = true;
            break;

          case 'MANAGER':
            // Managers podem ser moderadores mas não editores por padrão
            newFeatures.academy_editor = false;
            newFeatures.academy_moderator = true;
            newFeatures.social_editor = false;
            newFeatures.social_moderator = true;
            break;

          case 'USER':
          default:
            // Usuários normais não têm permissões especiais por padrão
            newFeatures.academy_editor = false;
            newFeatures.academy_moderator = false;
            newFeatures.social_editor = false;
            newFeatures.social_moderator = false;
            break;
        }

        // Atualizar permissões no banco
        const { error: updateError } = await supabaseAdmin
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
          console.error(`Erro ao atualizar usuário ${user.first_name} ${user.last_name}:`, updateError);
          errors.push({
            user: `${user.first_name} ${user.last_name}`,
            error: updateError.message
          });
        } else {
          updatedCount++;
          console.log(`✅ Permissões atualizadas para ${user.first_name} ${user.last_name} (${user.role})`);
        }

      } catch (error) {
        console.error(`Erro ao processar usuário ${user.first_name} ${user.last_name}:`, error);
        errors.push({
          user: `${user.first_name} ${user.last_name}`,
          error: error.message
        });
      }
    }

    // Criar permissões ACL para Academy e Social se não existirem
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

    // Inserir permissões ACL
    const allPermissions = [...academyPermissions, ...socialPermissions];
    let aclInserted = 0;

    for (const permission of allPermissions) {
      try {
        const { error: aclError } = await supabaseAdmin
          .from('acl_permissions')
          .upsert(permission, { onConflict: 'name', ignoreDuplicates: true });

        if (!aclError) {
          aclInserted++;
        }
      } catch (error) {
        console.error(`Erro ao inserir permissão ACL ${permission.name}:`, error);
      }
    }

    console.log(`✅ Sistema de permissões estendido com sucesso!`);
    console.log(`📊 Usuários atualizados: ${updatedCount}/${allUsers.length}`);
    console.log(`🔐 Permissões ACL inseridas: ${aclInserted}/${allPermissions.length}`);

    return NextResponse.json({
      success: true,
      message: 'Sistema de permissões estendido com sucesso',
      stats: {
        usersUpdated: updatedCount,
        totalUsers: allUsers.length,
        aclPermissionsInserted: aclInserted,
        totalAclPermissions: allPermissions.length,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined,
      newFeatures: {
        academy_editor: 'Permite criar e editar cursos da academy',
        academy_moderator: 'Permite moderar comentários e avaliações da academy',
        social_editor: 'Permite criar posts oficiais e gerenciar conteúdo social',
        social_moderator: 'Permite moderar posts, comentários e conteúdo social'
      }
    });

  } catch (error) {
    console.error('❌ Erro ao estender sistema de permissões:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }, { status: 500 });
  }
}
