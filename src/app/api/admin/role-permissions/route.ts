import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCatalogFeatureDefaultsForRole, getFullPermissionsForRole } from '@/config/modules';

export const dynamic = 'force-dynamic';

// GET - Obter permissões padrão por role
export async function GET() {
  try {
    console.log('🔄 API Role Permissions - Buscando permissões por role...');

    // Obter permissões dinâmicas padrão para cada role
    const roles = ['ADMIN', 'MANAGER', 'USER'] as const;
    const formattedPermissions: any = {};
    
    roles.forEach(role => {
      formattedPermissions[role] = {
        modules: getFullPermissionsForRole(role),
        features: getCatalogFeatureDefaultsForRole(role)
      };
    });

    // Buscar configurações de permissões por role do Supabase
    const { data: dbRolePermissions, error } = await supabaseAdmin
      .from('role_permissions')
      .select('*')
      .order('role');

    if (!error && dbRolePermissions) {
      dbRolePermissions.forEach(rolePermission => {
        const role = rolePermission.role as 'ADMIN' | 'MANAGER' | 'USER';
        if (formattedPermissions[role]) {
          // Mesclar as permissões do banco por cima dos defaults
          formattedPermissions[role].modules = {
            ...formattedPermissions[role].modules,
            ...(rolePermission.modules || {})
          };
          formattedPermissions[role].features = {
            ...formattedPermissions[role].features,
            ...(rolePermission.features || {})
          };
        }
      });
    } else if (error) {
      console.warn('Aviso: erro ao buscar permissões do banco, usando defaults:', error.message);
    }

    return NextResponse.json(formattedPermissions);

  } catch (error) {
    console.error('Erro ao buscar permissões por role:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar permissões de um role específico
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, permissions } = body;

    if (!role || !permissions) {
      return NextResponse.json(
        { error: 'Role e permissões são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Role Permissions - Atualizando permissões para role: ${role}`);

    // Verificar se já existe uma configuração para este role
    const { data: existingRole, error: checkError } = await supabaseAdmin
      .from('role_permissions')
      .select('id')
      .eq('role', role)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Erro ao verificar role existente:', checkError);
      return NextResponse.json(
        { error: 'Erro ao verificar role existente' },
        { status: 500 }
      );
    }

    const roleData = {
      role,
      modules: permissions.modules || {},
      features: permissions.features || {},
      updated_at: new Date().toISOString()
    };

    let result;
    if (existingRole) {
      // Atualizar role existente
      result = await supabaseAdmin
        .from('role_permissions')
        .update(roleData)
        .eq('role', role)
        .select()
        .single();
    } else {
      // Criar novo role
      result = await supabaseAdmin
        .from('role_permissions')
        .insert({
          ...roleData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Erro ao salvar permissões do role:', result.error);
      return NextResponse.json(
        { error: 'Erro ao salvar permissões do role' },
        { status: 500 }
      );
    }

    console.log(`✅ Permissões do role ${role} atualizadas com sucesso`);
    return NextResponse.json({ success: true, data: result.data });

  } catch (error) {
    console.error('Erro ao atualizar permissões do role:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
