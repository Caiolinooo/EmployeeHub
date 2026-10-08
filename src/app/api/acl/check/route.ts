import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST - Verificar se usuário tem permissão específica
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, resource, action, permission_name } = body;

    if (!user_id || (!permission_name && (!resource || !action))) {
      return NextResponse.json(
        { error: 'user_id e (permission_name ou resource+action) são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔍 Verificando permissão ACL para usuário ${user_id}: ${permission_name || `${resource}.${action}`}`);

    // Buscar dados do usuário
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('Usuário não encontrado:', userError);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Administradores têm acesso a tudo
    if (user.role === 'ADMIN') {
      console.log('✅ Usuário é ADMIN - acesso concedido');
      return NextResponse.json({ 
        hasPermission: true, 
        reason: 'admin_access',
        user_role: user.role 
      });
    }

    // Verificar permissão específica
    const hasPermission = await checkUserACLPermission(user_id, user.role, permission_name, resource, action);

    console.log(`${hasPermission.granted ? '✅' : '❌'} Permissão ${hasPermission.granted ? 'concedida' : 'negada'}: ${hasPermission.reason}`);

    return NextResponse.json({
      hasPermission: hasPermission.granted,
      reason: hasPermission.reason,
      user_role: user.role,
      permission_source: hasPermission.source
    });

  } catch (error) {
    console.error('Erro ao verificar permissão ACL:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função para verificar permissão ACL do usuário
async function checkUserACLPermission(
  userId: string, 
  userRole: string, 
  permissionName?: string, 
  resource?: string, 
  action?: string
): Promise<{ granted: boolean; reason: string; source: string }> {
  
  try {
    // 1. Buscar a permissão específica
    let permissionQuery = supabaseAdmin
      .from('acl_permissions')
      .select('id, name, resource, action, level')
      .eq('enabled', true);

    if (permissionName) {
      permissionQuery = permissionQuery.eq('name', permissionName);
    } else if (resource && action) {
      permissionQuery = permissionQuery.eq('resource', resource).eq('action', action);
    }

    const { data: permissions, error: permError } = await permissionQuery;

    if (permError || !permissions || permissions.length === 0) {
      return { granted: false, reason: 'permission_not_found', source: 'none' };
    }

    const permission = permissions[0];

    // 2. Verificar permissão individual do usuário (prioridade máxima)
    const { data: userPermission, error: userPermError } = await supabaseAdmin
      .from('user_acl_permissions')
      .select('id, granted, expires_at')
      .eq('user_id', userId)
      .eq('permission_id', permission.id)
      .single();

    if (!userPermError && userPermission) {
      const active = !userPermission.expires_at || new Date(userPermission.expires_at) > new Date();
      if (active && userPermission.granted === false) {
        return { granted: false, reason: 'individual_revocation', source: 'user' };
      }
      if (active) {
        return { granted: true, reason: 'individual_permission', source: 'user' };
      }
    }

    // 3. Verificar permissão por role
    const { data: rolePermission, error: rolePermError } = await supabaseAdmin
      .from('role_acl_permissions')
      .select('id')
      .eq('role', userRole)
      .eq('permission_id', permission.id)
      .single();

    if (!rolePermError && rolePermission) {
      return { granted: true, reason: 'role_permission', source: 'role' };
    }

    // 4. Verificar permissões hierárquicas (permissões de nível superior)
    if (permission.level > 0) {
      const { data: higherPermissions, error: higherError } = await supabaseAdmin
        .from('acl_permissions')
        .select('id, name, level')
        .eq('resource', permission.resource)
        .eq('action', permission.action)
        .lt('level', permission.level)
        .eq('enabled', true);

      if (!higherError && higherPermissions && higherPermissions.length > 0) {
        // Verificar se o usuário tem alguma permissão de nível superior
        for (const higherPerm of higherPermissions) {
          const hasHigher = await checkUserACLPermission(userId, userRole, higherPerm.name);
          if (hasHigher.granted) {
            return { granted: true, reason: 'hierarchical_permission', source: hasHigher.source };
          }
        }
      }
    }

    return { granted: false, reason: 'no_permission', source: 'none' };

  } catch (error) {
    console.error('Erro ao verificar permissão ACL:', error);
    return { granted: false, reason: 'error', source: 'none' };
  }
}

// GET - Verificar permissão via query params (para uso simples)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const resource = searchParams.get('resource');
    const action = searchParams.get('action');
    const permission_name = searchParams.get('permission');

    if (!user_id || (!permission_name && (!resource || !action))) {
      return NextResponse.json(
        { error: 'user_id e (permission ou resource+action) são obrigatórios' },
        { status: 400 }
      );
    }

    // Reutilizar lógica do POST
    const body = { user_id, resource, action, permission_name };
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });

    return await POST(postRequest);

  } catch (error) {
    console.error('Erro ao verificar permissão ACL via GET:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
