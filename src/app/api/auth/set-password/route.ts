import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { inviteCode, password } = await request.json();

    if (!inviteCode || !password) {
      return NextResponse.json(
        { error: 'Código de convite e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a senha atende aos requisitos mínimos
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Buscar usuário pelo código de convite
    console.log('Buscando usuário com código de convite:', inviteCode);
    const { data: user, error } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('invite_code', inviteCode)
      .neq('invite_accepted', true)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Código de convite inválido ou já utilizado' },
        { status: 400 }
      );
    }

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualizar usuário
    console.log('Atualizando usuário com ID:', user.id);
    const { error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        password_hash: hashedPassword,
        invite_accepted: true,
        invite_accepted_at: new Date().toISOString(),
        password_last_changed: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Erro ao atualizar usuário:', updateError);
      return NextResponse.json(
        { error: 'Erro ao definir senha' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Senha definida com sucesso',
    });
  } catch (error) {
    console.error('Erro ao definir senha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
