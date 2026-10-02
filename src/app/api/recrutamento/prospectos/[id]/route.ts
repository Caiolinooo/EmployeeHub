import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeNivelRecrutamento } from '@/lib/recrutamento/recrutamento-auth';
import { isValidCpf, normalizeCpf } from '@/lib/utils/identity';

export const dynamic = 'force-dynamic';

const STATUS_PROSPECTO = ['prospecto', 'pre_cadastro', 'aprovado', 'contratado', 'rejeitado', 'convertido'] as const;

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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.nome_completo !== undefined) {
      const nome = String(body.nome_completo || '').trim();
      if (!nome) return NextResponse.json({ error: 'Nome completo não pode ser vazio' }, { status: 400 });
      updates.nome_completo = nome;
    }
    if (body.cpf !== undefined) {
      const cpf = body.cpf ? normalizeCpf(String(body.cpf)) : '';
      if (cpf && !isValidCpf(cpf)) return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });
      updates.cpf = cpf || null;
    }
    if (body.email !== undefined) updates.email = body.email || null;
    if (body.telefone !== undefined) updates.telefone = body.telefone || null;
    if (body.telefone_2 !== undefined) updates.telefone_2 = body.telefone_2 || null;
    if (body.vaga_id !== undefined) {
      if (body.vaga_id) {
        const { data: vaga } = await supabaseAdmin
          .from('rc_vagas')
          .select('id')
          .eq('id', body.vaga_id)
          .is('deleted_at', null)
          .maybeSingle();
        if (!vaga) return NextResponse.json({ error: 'Vaga não encontrada' }, { status: 400 });
      }
      updates.vaga_id = body.vaga_id || null;
    }
    if (body.status !== undefined) {
      const status = String(body.status || '').trim();
      if (!STATUS_PROSPECTO.includes(status as (typeof STATUS_PROSPECTO)[number])) {
        return NextResponse.json({ error: `Status inválido. Use: ${STATUS_PROSPECTO.join(', ')}` }, { status: 400 });
      }
      updates.status = status;
    }
    if (body.dados !== undefined && body.dados && typeof body.dados === 'object') {
      updates.dados = body.dados;
    }

    const { data, error } = await supabaseAdmin
      .from('rc_prospectos')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe prospecto ativo com este CPF' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Prospecto não encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao editar prospecto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { erro } = await autenticar(request, 'manage');
    if (erro) return erro;

    const id = params.id;

    const { data: atual } = await supabaseAdmin
      .from('rc_prospectos')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!atual) return NextResponse.json({ error: 'Prospecto não encontrado' }, { status: 404 });
    if (atual.status === 'convertido') {
      return NextResponse.json({ error: 'Prospecto convertido em colaborador não pode ser excluído' }, { status: 409 });
    }

    const { error } = await supabaseAdmin
      .from('rc_prospectos')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir prospecto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
