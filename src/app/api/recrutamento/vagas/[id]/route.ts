import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeNivelRecrutamento } from '@/lib/recrutamento/recrutamento-auth';

export const dynamic = 'force-dynamic';

const STATUS_VAGA = ['aberta', 'pausada', 'fechada', 'rascunho'] as const;

async function autenticar(request: NextRequest, nivel: 'view' | 'manage') {
  const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return { erro: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  const pode = await podeNivelRecrutamento(payload.userId, payload.role, nivel);
  if (!pode) return { erro: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) };
  return { payload };
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { erro } = await autenticar(request, 'manage');
    if (erro) return erro;

    const id = params.id;
    const body = await request.json();

    const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    if (body.titulo !== undefined) {
      const titulo = String(body.titulo || '').trim();
      if (!titulo) return NextResponse.json({ error: 'Título não pode ser vazio' }, { status: 400 });
      updates.titulo = titulo;
    }
    if (body.descricao !== undefined) updates.descricao = body.descricao || null;
    if (body.empresa !== undefined) updates.empresa = body.empresa || null;
    if (body.centro_custo !== undefined) updates.centro_custo = body.centro_custo || null;
    if (body.status !== undefined) {
      const status = String(body.status || '').trim();
      if (!STATUS_VAGA.includes(status as (typeof STATUS_VAGA)[number])) {
        return NextResponse.json({ error: `Status inválido. Use: ${STATUS_VAGA.join(', ')}` }, { status: 400 });
      }
      updates.status = status;
    }

    const { data, error } = await supabaseAdmin
      .from('rc_vagas')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Vaga não encontrada' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao editar vaga:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { erro } = await autenticar(request, 'manage');
    if (erro) return erro;

    const id = params.id;

    const { count } = await supabaseAdmin
      .from('rc_prospectos')
      .select('id', { count: 'exact', head: true })
      .eq('vaga_id', id)
      .is('deleted_at', null);
    if ((count || 0) > 0) {
      return NextResponse.json({
        error: `Vaga possui ${count} prospecto(s) ativo(s). Exclua ou mova os prospectos antes.`,
      }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from('rc_vagas')
      .update({ deleted_at: new Date().toISOString(), atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Vaga não encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir vaga:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
