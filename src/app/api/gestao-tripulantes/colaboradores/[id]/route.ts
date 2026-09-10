import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { autoGenerateESocialEvents } from '@/services/eSocialAutoService';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { loadColaboradorDetail, parseIncludeParam } from '@/lib/gestao-tripulantes/colaborador-get';
import { montarPayloadCadastro } from '@/lib/gestao-tripulantes/colaborador-cadastro';
import {
  MENSAGEM_CADASTRO_NEGADO,
  podeMutarCadastroColaborador,
} from '@/lib/gestao-tripulantes/colaborador-cadastro-auth';

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
    const include = parseIncludeParam(request.nextUrl.searchParams.get('include'));
    const result = await loadColaboradorDetail(id, include);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    if (result.notFound) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    console.log(
      `[GT GET /colaboradores/${id}] ${result.timingsMs.total}ms wave1=${result.timingsMs.wave1} wave2=${result.timingsMs.wave2} include=${[...include].join(',')}`
    );

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Erro ao obter colaborador:', error);
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

    const podeMutar = await podeMutarCadastroColaborador(payload.userId, payload.role);
    if (!podeMutar) {
      return NextResponse.json({ error: MENSAGEM_CADASTRO_NEGADO }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const montado = montarPayloadCadastro(body as Record<string, unknown>, 'update');
    if (!montado.ok) {
      return NextResponse.json({ error: montado.error }, { status: montado.status });
    }

    const updateData: Record<string, unknown> = { ...montado.data };

    if (typeof updateData.cpf === 'string' && updateData.cpf) {
      const existing = await findColaboradorByCpf(updateData.cpf);
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'CPF já cadastrado para outro colaborador' }, { status: 409 });
      }
    }

    // View aliases (cargo_nome etc.) are not table columns — resolve to FKs instead of dropping.
    const fkNameResolvers: { nameKey: string; idKey: string; table: string }[] = [
      { nameKey: 'cargo_nome', idKey: 'cargo_id', table: 'gt_cargos' },
      { nameKey: 'empresa_nome', idKey: 'empresa_id', table: 'gt_empresas' },
      { nameKey: 'embarcacao_nome', idKey: 'embarcacao_atual_id', table: 'gt_embarcacoes' },
      { nameKey: 'centro_custo_nome', idKey: 'centro_custo_id', table: 'gt_centros_custo' },
    ];
    for (const { nameKey, idKey, table } of fkNameResolvers) {
      if (idKey in updateData) continue;
      if (typeof body[nameKey] !== 'string' || !body[nameKey].trim()) continue;
      const { data: row } = await supabaseAdmin
        .from(table)
        .select('id')
        .ilike('nome', body[nameKey].trim())
        .limit(1)
        .maybeSingle();
      if (!row) {
        return NextResponse.json({ error: `${nameKey.replace('_nome', '')} não encontrado: ${body[nameKey]}` }, { status: 400 });
      }
      updateData[idKey] = row.id;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('gt_colaboradores')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar colaborador:', updateError);
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'CPF já cadastrado para outro colaborador' }, { status: 409 });
      }
      return NextResponse.json({ error: updateError.message || 'Erro ao atualizar colaborador' }, { status: 500 });
    }

    if (updated && updated.id) {
      autoGenerateESocialEvents(updated.id).catch(err => {
        console.error('[eSocialAuto] Failed in background execution on update:', err);
      });
    }

    const result = await loadColaboradorDetail(id, parseIncludeParam('all'));

    return NextResponse.json({
      success: true,
      data: result.data || updated
    });
  } catch (error) {
    console.error('Erro ao atualizar colaborador:', error);
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

    const podeMutar = await podeMutarCadastroColaborador(payload.userId, payload.role);
    if (!podeMutar) {
      return NextResponse.json({ error: MENSAGEM_CADASTRO_NEGADO }, { status: 403 });
    }

    const { id } = await context.params;

    const { error: softDeleteError } = await supabaseAdmin
      .from('gt_colaboradores')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (softDeleteError) {
      console.error('Erro ao excluir colaborador:', softDeleteError);
      return NextResponse.json({ error: 'Erro ao excluir colaborador' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Colaborador excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir colaborador:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
