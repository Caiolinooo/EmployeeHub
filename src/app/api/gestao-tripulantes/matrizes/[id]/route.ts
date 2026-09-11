import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  podeGerenciarMatrizesTreinamento,
  podeVisualizarMatrizesTreinamento,
} from '@/lib/gestao-tripulantes/matriz-permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token =
      extractTokenFromHeader(authHeader) ||
      request.cookies.get('abzToken')?.value ||
      request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId || payload.user_id || payload.id || '';
    const role = payload.role || '';

    const canView = await podeVisualizarMatrizesTreinamento(userId, role);
    if (!canView) {
      return NextResponse.json(
        { error: 'Acesso negado. Usuário ou setor sem permissão para visualizar matrizes.' },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    const { data: matrix, error: matErr } = await supabaseAdmin
      .from('gt_matrizes_treinamento')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (matErr || !matrix) {
      return NextResponse.json({ error: 'Matriz não encontrada' }, { status: 404 });
    }

    const { data: requisitos, error: reqErr } = await supabaseAdmin
      .from('gt_matriz_treinamento_requisitos')
      .select('*')
      .eq('matriz_id', id)
      .order('cargo_nome', { ascending: true })
      .order('treinamento_nome', { ascending: true });

    if (reqErr) {
      console.error('Erro ao buscar requisitos:', reqErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...matrix,
        requisitos: requisitos || [],
      },
    });
  } catch (error) {
    console.error('Erro ao obter matriz:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token =
      extractTokenFromHeader(authHeader) ||
      request.cookies.get('abzToken')?.value ||
      request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId || payload.user_id || payload.id || '';
    const role = payload.role || '';

    const canManage = await podeGerenciarMatrizesTreinamento(userId, role);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Acesso negado. É necessário ter perfil gestor, permissão ACL ou pertencer a setor autorizado para gerenciar matrizes.' },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.nome !== undefined) updateFields.nome = String(body.nome).trim();
    if (body.codigo !== undefined) updateFields.codigo = String(body.codigo).trim().toUpperCase();
    if (body.descricao !== undefined) updateFields.descricao = body.descricao ? String(body.descricao).trim() : null;
    if (body.centro_resultado !== undefined) updateFields.centro_resultado = body.centro_resultado ? String(body.centro_resultado).trim() : null;
    if (body.cliente !== undefined) updateFields.cliente = body.cliente ? String(body.cliente).trim() : null;
    if (body.contrato !== undefined) updateFields.contrato = body.contrato ? String(body.contrato).trim() : null;
    if (body.responsavel !== undefined) updateFields.responsavel = body.responsavel ? String(body.responsavel).trim() : null;
    if (body.ativo !== undefined) updateFields.ativo = Boolean(body.ativo);

    const { data: updatedMatrix, error: updErr } = await supabaseAdmin
      .from('gt_matrizes_treinamento')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) {
      console.error('Erro ao atualizar matriz:', updErr);
      return NextResponse.json({ error: 'Erro ao atualizar matriz: ' + updErr.message }, { status: 500 });
    }

    // If requisitos array is passed, replace or update requirements
    if (Array.isArray(body.requisitos)) {
      // Delete old requirements for this matrix and insert new set
      await supabaseAdmin
        .from('gt_matriz_treinamento_requisitos')
        .delete()
        .eq('matriz_id', id);

      if (body.requisitos.length > 0) {
        const rowsToInsert = body.requisitos.map((r: any) => ({
          matriz_id: id,
          cargo_id: r.cargo_id || null,
          cargo_nome: String(r.cargo_nome || '').trim(),
          regime: String(r.regime || 'Geral').trim(),
          treinamento_nome: String(r.treinamento_nome || '').trim(),
          sigla: r.sigla ? String(r.sigla).trim() : null,
          obrigatorio: r.obrigatorio !== false,
          validade_meses: r.validade_meses ? Number(r.validade_meses) : null,
          especialidade: r.especialidade ? String(r.especialidade).trim() : 'ND',
        })).filter((r: any) => r.cargo_nome && r.treinamento_nome);

        if (rowsToInsert.length > 0) {
          await supabaseAdmin
            .from('gt_matriz_treinamento_requisitos')
            .insert(rowsToInsert);
        }
      }
    }

    return NextResponse.json({ success: true, data: updatedMatrix });
  } catch (error) {
    console.error('Erro ao atualizar matriz:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get('authorization') || undefined;
    const token =
      extractTokenFromHeader(authHeader) ||
      request.cookies.get('abzToken')?.value ||
      request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId || payload.user_id || payload.id || '';
    const role = payload.role || '';

    const canManage = await podeGerenciarMatrizesTreinamento(userId, role);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Acesso negado. É necessário ter perfil gestor, permissão ACL ou pertencer a setor autorizado para gerenciar matrizes.' },
        { status: 403 },
      );
    }

    const { error } = await supabaseAdmin
      .from('gt_matrizes_treinamento')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir matriz:', error);
      return NextResponse.json({ error: 'Erro ao excluir matriz' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Matriz excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir matriz:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
