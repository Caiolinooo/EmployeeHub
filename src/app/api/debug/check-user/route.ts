import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configurações do Supabase não encontradas' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: user, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Usuário não encontrado', details: error.message },
        { status: 404 }
      );
    }

    // Verificar formato da senha
    const hasPassword = !!user.password;
    const hasPasswordHash = !!user.password_hash;
    const passwordIsBcrypt = hasPassword && user.password.startsWith('$2');
    const passwordHashIsBcrypt = hasPasswordHash && user.password_hash.startsWith('$2');

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        active: user.active,
        email_verified: user.email_verified,
        authorization_status: user.authorization_status,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      password_info: {
        has_password: hasPassword,
        has_password_hash: hasPasswordHash,
        password_length: hasPassword ? user.password.length : 0,
        password_hash_length: hasPasswordHash ? user.password_hash.length : 0,
        password_preview: hasPassword ? user.password.substring(0, 30) : null,
        password_hash_preview: hasPasswordHash ? user.password_hash.substring(0, 30) : null,
        password_is_bcrypt: passwordIsBcrypt,
        password_hash_is_bcrypt: passwordHashIsBcrypt
      }
    });
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
