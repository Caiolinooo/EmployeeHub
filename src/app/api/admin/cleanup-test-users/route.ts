import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // Verificar se é ambiente de desenvolvimento
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Esta operação só é permitida em ambiente de desenvolvimento' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'É necessário fornecer email ou telefone para limpeza' },
        { status: 400 }
      );
    }

    let query = supabase.from('users_unified').delete();

    if (email) {
      query = query.eq('email', email);
    } else if (phone) {
      query = query.eq('phone_number', phone);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('Erro ao limpar usuários de teste:', error);
      return NextResponse.json(
        { error: 'Erro ao limpar usuários de teste' },
        { status: 500 }
      );
    }

    // Também tentar limpar do Supabase Auth se possível
    if (email && data && data.length > 0) {
      try {
        for (const user of data) {
          if (user.id) {
            await supabase.auth.admin.deleteUser(user.id);
          }
        }
      } catch (authError) {
        console.warn('Erro ao limpar usuário do Supabase Auth:', authError);
        // Não falhar se não conseguir limpar do Auth
      }
    }

    return NextResponse.json({
      success: true,
      message: `${data?.length || 0} usuário(s) de teste removido(s)`,
      removedUsers: data?.length || 0
    });

  } catch (error) {
    console.error('Erro na limpeza de usuários de teste:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
