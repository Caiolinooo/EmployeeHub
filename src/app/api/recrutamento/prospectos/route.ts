import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeNivelRecrutamento } from '@/lib/recrutamento/recrutamento-auth';
import { isValidCpf, normalizeCpf } from '@/lib/utils/identity';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const pode = await podeNivelRecrutamento(payload.userId, payload.role, 'view');
    if (!pode) return NextResponse.json({ error: 'Sem permissão para recrutamento' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    let query = supabaseAdmin
      .from('rc_prospectos')
      .select('*, vaga:rc_vagas(titulo)')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erro ao listar prospectos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const pode = await podeNivelRecrutamento(payload.userId, payload.role, 'manage');
    if (!pode) return NextResponse.json({ error: 'Sem permissão para cadastrar prospecto' }, { status: 403 });

    const body = await request.json();
    const nome = String(body.nome_completo || '').trim();
    if (!nome) return NextResponse.json({ error: 'Nome completo é obrigatório' }, { status: 400 });

    const cpfBruto = body.cpf ? normalizeCpf(String(body.cpf)) : '';
    if (cpfBruto && !isValidCpf(cpfBruto)) {
      return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('rc_prospectos')
      .insert({
        vaga_id: body.vaga_id || null,
        nome_completo: nome,
        cpf: cpfBruto || null,
        email: body.email || null,
        telefone: body.telefone || null,
        telefone_2: body.telefone_2 || null,
        dados: body.dados && typeof body.dados === 'object' ? body.dados : {},
        status: 'prospecto',
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe prospecto com este CPF ou candidato Inhire' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar prospecto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
