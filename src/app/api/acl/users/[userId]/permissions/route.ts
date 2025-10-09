import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Obter permissões ACL de um usuário específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    console.log(`🔄 API ACL User Permissions - Buscando permissões do usuário: ${userId}`);

    // Buscar dados do usuário
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email, role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Buscar permissões individuais do usuário
    const { data: userPermissions, error: userPermError } = await supabaseAdmin
      .from('user_acl_permissions')
      .select(`
        id,
        granted_at,
        expires_at,
        acl_permissions (
          id,
          name,
          description,
          resource,
          action,
          level
        )
      `)
      .eq('user_id', userId);

    if (userPermError) {
      console.error('Erro ao buscar permissões individuais:', userPermError);
      return NextResponse.json(
        { error: 'Erro ao buscar permissões individuais' },
        { status: 500 }
      );
    }

    // Buscar permissões por role
    const { data: rolePermissions, error: rolePermError } = await supabaseAdmin
      .from('role_acl_permissions')
      .select(`
        id,
        acl_permissions (
          id,
          name,
          description,
          resource,
          action,
          level
        )
      `)
      .eq('role', user.role);

    if (rolePermError) {
      console.error('Erro ao buscar permissões por role:', rolePermError);
      return NextResponse.json(
        { error: 'Erro ao buscar permissões por role' },
        { status: 500 }
      );
    }

    // Organizar dados de resposta
    const response = {
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email,
        role: user.role
      },
      individual_permissions: userPermissions?.map(up => ({
        id: up.id,
        permission: up.acl_permissions,
        granted_at: up.granted_at,
        expires_at: up.expires_at,
        is_expired: up.expires_at ? new Date(up.expires_at) < new Date() : false
      })) || [],
      role_permissions: rolePermissions?.map(rp => ({
        id: rp.id,
        permission: rp.acl_permissions
      })) || [],
      effective_permissions: [] // Será calculado no frontend
    };

    console.log(`✅ Permissões carregadas para usuário ${user.email}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro ao buscar permissões do usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Atribuir permissão ACL a um usuário
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { permission_id, expires_at, granted_by } = body;

    if (!permission_id) {
      return NextResponse.json(
        { error: 'permission_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API ACL User Permissions - Atribuindo permissão ${permission_id} ao usuário ${userId}`);

    // Verificar se a permissão existe
    const { data: permission, error: permError } = await supabaseAdmin
      .from('acl_permissions')
      .select('id, name, description')
      .eq('id', permission_id)
      .single();

    if (permError || !permission) {
      return NextResponse.json(
        { error: 'Permissão não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Criar atribuição de permissão
    const permissionData = {
      user_id: userId,
      permission_id,
      granted_by: granted_by || null,
      granted_at: new Date().toISOString(),
      expires_at: expires_at || null
    };

    const { data: newUserPermission, error: insertError } = await supabaseAdmin
      .from('user_acl_permissions')
      .upsert(permissionData, { 
        onConflict: 'user_id,permission_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao atribuir permissão:', insertError);
      return NextResponse.json(
        { error: 'Erro ao atribuir permissão' },
        { status: 500 }
      );
    }

    console.log(`✅ Permissão ${permission.name} atribuída ao usuário ${user.email}`);
    return NextResponse.json({
      success: true,
      permission: newUserPermission,
      message: `Permissão "${permission.name}" atribuída com sucesso`
    });

  } catch (error) {
    console.error('Erro ao atribuir permissão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remover permissão ACL de um usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('permission_id');

    if (!permissionId) {
      return NextResponse.json(
        { error: 'permission_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API ACL User Permissions - Removendo permissão ${permissionId} do usuário ${userId}`);

    // Remover atribuição de permissão
    const { error: deleteError } = await supabaseAdmin
      .from('user_acl_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId);

    if (deleteError) {
      console.error('Erro ao remover permissão:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao remover permissão' },
        { status: 500 }
      );
    }

    console.log(`✅ Permissão removida do usuário`);
    return NextResponse.json({
      success: true,
      message: 'Permissão removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover permissão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
