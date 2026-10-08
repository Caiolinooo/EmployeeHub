import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function isAdmin(role: string | null | undefined): boolean {
  return String(role || '').toUpperCase() === 'ADMIN';
}

// GET - Permissões ACL de um usuário (o próprio usuário ou ADMIN)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { user: viewer, error: authError } = await requireAuth(request);
    if (authError) return authError;
    if (viewer.id !== userId && !isAdmin(viewer.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

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
        granted,
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
        granted: up.granted !== false,
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

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro ao buscar permissões do usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Grant (`granted: true`, padrão) ou revogação individual (`granted: false`). Só ADMIN.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { user: admin, error: authError } = await requireAuth(request);
    if (authError) return authError;
    if (!isAdmin(admin.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const body = await request.json();
    const { permission_id, expires_at, granted } = body;

    if (!permission_id) {
      return NextResponse.json(
        { error: 'permission_id é obrigatório' },
        { status: 400 }
      );
    }

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

    const permissionData = {
      user_id: userId,
      permission_id,
      granted: granted !== false,
      granted_by: admin.id,
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

    return NextResponse.json({
      success: true,
      permission: newUserPermission,
      message: permissionData.granted
        ? `Permissão "${permission.name}" atribuída com sucesso`
        : `Permissão "${permission.name}" revogada para o usuário`
    });

  } catch (error) {
    console.error('Erro ao atribuir permissão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a linha individual (grant ou revogação): volta ao default do role. Só ADMIN.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { user: admin, error: authError } = await requireAuth(request);
    if (authError) return authError;
    if (!isAdmin(admin.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('permission_id');

    if (!permissionId) {
      return NextResponse.json(
        { error: 'permission_id é obrigatório' },
        { status: 400 }
      );
    }

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
