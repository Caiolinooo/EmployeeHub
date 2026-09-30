import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeNivelRecrutamento } from '@/lib/recrutamento/recrutamento-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const pode = await podeNivelRecrutamento(payload.userId, payload.role, 'view');
    if (!pode) return NextResponse.json({ error: 'Sem permissão para recrutamento' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('rc_vagas')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erro ao listar vagas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const pode = await podeNivelRecrutamento(payload.userId, payload.role, 'manage');
    if (!pode) return NextResponse.json({ error: 'Sem permissão para cadastrar vaga' }, { status: 403 });

    const body = await request.json();
    const titulo = String(body.titulo || '').trim();
    if (!titulo) return NextResponse.json({ error: 'Título da vaga é obrigatório' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('rc_vagas')
      .insert({
        titulo,
        descricao: body.descricao || null,
        empresa: body.empresa || null,
        centro_custo: body.centro_custo || null,
        status: body.status || 'aberta',
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar vaga:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
