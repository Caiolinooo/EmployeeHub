import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAclRoleGrants, getAclSeedPermissions } from '@/config/modules';

export const dynamic = 'force-dynamic';

// POST - Inicializar permissões ACL básicas
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Inicializando sistema ACL...');

    // Verificar se as tabelas existem tentando fazer uma query simples
    try {
      const { data: testPermissions } = await supabaseAdmin
        .from('acl_permissions')
        .select('id')
        .limit(1);

      const { data: testRolePermissions } = await supabaseAdmin
        .from('role_acl_permissions')
        .select('id')
        .limit(1);

      const { data: testUserPermissions } = await supabaseAdmin
        .from('user_acl_permissions')
        .select('id')
        .limit(1);

      console.log('✅ Tabelas ACL existem e são acessíveis');
    } catch (tableError) {
      console.error('❌ Erro ao acessar tabelas ACL:', tableError);
      return NextResponse.json(
        {
          error: 'Tabelas ACL não existem ou não são acessíveis. Execute o script create-news-system-tables.sql primeiro.',
          details: tableError
        },
        { status: 500 }
      );
    }

    const basicPermissions = getAclSeedPermissions();

    // Inserir permissões básicas
    for (const permission of basicPermissions) {
      const { data: existingPerm } = await supabaseAdmin
        .from('acl_permissions')
        .select('id')
        .eq('name', permission.name)
        .single();

      if (!existingPerm) {
        console.log(`Criando permissão: ${permission.name}`);
        const { error: insertError } = await supabaseAdmin
          .from('acl_permissions')
          .insert({
            ...permission,
            enabled: true,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`Erro ao criar permissão ${permission.name}:`, insertError);
        }
      }
    }

    const rolePermissions = getAclRoleGrants();

    // Inserir permissões por role
    for (const [role, permissions] of Object.entries(rolePermissions)) {
      for (const permissionName of permissions) {
        const { data: permission } = await supabaseAdmin
          .from('acl_permissions')
          .select('id')
          .eq('name', permissionName)
          .single();

        if (permission) {
          const { data: existingRolePerm } = await supabaseAdmin
            .from('role_acl_permissions')
            .select('id')
            .eq('role', role)
            .eq('permission_id', permission.id)
            .single();

          if (!existingRolePerm) {
            console.log(`Atribuindo permissão ${permissionName} ao role ${role}`);
            const { error: insertRolePermError } = await supabaseAdmin
              .from('role_acl_permissions')
              .insert({
                role,
                permission_id: permission.id,
                created_at: new Date().toISOString()
              });

            if (insertRolePermError) {
              console.error(`Erro ao atribuir permissão ${permissionName} ao role ${role}:`, insertRolePermError);
            }
          }
        }
      }
    }

    console.log('✅ Sistema ACL inicializado com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Sistema ACL inicializado com sucesso',
      permissions_created: basicPermissions.length,
      roles_configured: Object.keys(rolePermissions).length
    });

  } catch (error) {
    console.error('Erro ao inicializar sistema ACL:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET - Verificar status do sistema ACL
export async function GET() {
  try {
    // Verificar quantas permissões existem
    const { data: permissions, error: permError } = await supabaseAdmin
      .from('acl_permissions')
      .select('id, name, resource, action')
      .eq('enabled', true);

    if (permError) {
      return NextResponse.json(
        { error: 'Erro ao verificar permissões' },
        { status: 500 }
      );
    }

    // Verificar quantas permissões por role existem
    const { data: rolePermissions, error: rolePermError } = await supabaseAdmin
      .from('role_acl_permissions')
      .select('role, permission_id');

    if (rolePermError) {
      return NextResponse.json(
        { error: 'Erro ao verificar permissões por role' },
        { status: 500 }
      );
    }

    const roleStats = rolePermissions?.reduce((acc, rp) => {
      acc[rp.role] = (acc[rp.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      permissions_count: permissions?.length || 0,
      permissions: permissions || [],
      role_permissions_count: rolePermissions?.length || 0,
      role_stats: roleStats,
      initialized: (permissions?.length || 0) > 0
    });

  } catch (error) {
    console.error('Erro ao verificar status ACL:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
