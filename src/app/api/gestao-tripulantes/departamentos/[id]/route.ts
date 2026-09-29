import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from('gt_departamentos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar departamento:', error);
      return NextResponse.json({ error: 'Erro ao buscar departamento' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Departamento não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao obter departamento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const updateData: Record<string, any> = { ...body, updated_at: new Date().toISOString() };
    delete updateData.id;
    delete updateData.created_at;

    const { data, error } = await supabaseAdmin
      .from('gt_departamentos')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao atualizar departamento:', error);
      return NextResponse.json({ error: 'Erro ao atualizar departamento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao atualizar departamento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { id } = await context.params;

    const { count, error: countError } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('*', { count: 'exact', head: true })
      .eq('departamento_id', id)
      .is('deleted_at', null);

    if (countError) {
      console.error('Erro ao verificar colaboradores:', countError);
      return NextResponse.json({ error: 'Erro ao verificar colaboradores vinculados' }, { status: 500 });
    }

    if (count && count > 0) {
      return NextResponse.json({
        error: `Não é possível excluir: ${count} colaborador(es) vinculado(s) a este departamento`
      }, { status: 409 });
    }

    const { error } = await supabaseAdmin
      .from('gt_departamentos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir departamento:', error);
      return NextResponse.json({ error: 'Erro ao excluir departamento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Departamento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir departamento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
