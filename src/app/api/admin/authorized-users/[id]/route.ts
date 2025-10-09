import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/admin/authorized-users/[id]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { params } = context;
  const { id } = await params;
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta API.' },
        { status: 403 }
      );
    }

    // Buscar usuário autorizado
    const { data: authorizedUser, error: findError } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !authorizedUser) {
      return NextResponse.json(
        { error: 'Usuário autorizado não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(authorizedUser);
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/authorized-users/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { params } = context;
  const { id } = await params;
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta API.' },
        { status: 403 }
      );
    }

    // Verificar se o usuário autorizado existe
    const { data: authorizedUser, error: findError } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !authorizedUser) {
      return NextResponse.json(
        { error: 'Usuário autorizado não encontrado' },
        { status: 404 }
      );
    }

    // Excluir o usuário autorizado
    const { error: deleteError } = await supabaseAdmin
      .from('authorized_users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir usuário autorizado:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao excluir usuário autorizado', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário autorizado excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/admin/authorized-users/[id]
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { params } = context;
  const { id } = await params;
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role, first_name, last_name')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta API.' },
        { status: 403 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();

    // Buscar o usuário autorizado para verificar se existe
    const { data: userToUpdate, error: findError } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !userToUpdate) {
      return NextResponse.json(
        { error: 'Usuário autorizado não encontrado' },
        { status: 404 }
      );
    }

    // Preparar a nota de atualização
    const noteMessage = `Atualizado por ${requestingUser.first_name} ${requestingUser.last_name} em ${new Date().toISOString()}`;

    // Preparar dados para atualização
    const updateData = {
      ...body,
      notes: [...(userToUpdate.notes || []), noteMessage],
      updated_at: new Date().toISOString(),
      updated_by: payload.userId
    };

    // Atualizar usuário autorizado
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('authorized_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar usuário autorizado:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar usuário autorizado', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário autorizado atualizado com sucesso',
      data: updatedUser
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
