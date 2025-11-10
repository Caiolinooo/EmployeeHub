import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API para corrigir as permissões de administrador
 */
export async function POST(request: NextRequest) {
  try {
    // Obter os dados do corpo da requisição
    const body = await request.json();
    const { userId, email, phoneNumber } = body;

    console.log('Tentando corrigir permissões de administrador para:', { userId, email, phoneNumber });

    // Verificar se o usuário é o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isMainAdmin = email === adminEmail || phoneNumber === adminPhone;

    if (!isMainAdmin) {
      console.log('Usuário não é o administrador principal');
      return NextResponse.json({
        success: false,
        error: 'Apenas o administrador principal pode ter suas permissões corrigidas automaticamente'
      }, { status: 403 });
    }

    // Buscar o usuário no banco de dados
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json({
        success: false,
        error: 'Usuário não encontrado'
      }, { status: 404 });
    }

    // Atualizar o papel do usuário para ADMIN
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        role: 'ADMIN',
        access_permissions: {
          ...(user.access_permissions || {}),
          modules: {
            ...(user.access_permissions?.modules || {}),
            admin: true
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar papel do usuário:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar papel do usuário'
      }, { status: 500 });
    }

    // Verificar se o usuário também existe na tabela users_unified
    const { data: unifiedUser, error: unifiedUserError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', userId)
      .single();

    // Se o usuário existir na tabela users_unified, atualizar também
    if (!unifiedUserError && unifiedUser) {
      const { error: updateUnifiedError } = await supabaseAdmin
        .from('users_unified')
        .update({
          role: 'ADMIN',
          access_permissions: {
            ...(unifiedUser.access_permissions || {}),
            modules: {
              ...(unifiedUser.access_permissions?.modules || {}),
              admin: true
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateUnifiedError) {
        console.error('Erro ao atualizar papel do usuário na tabela users_unified:', updateUnifiedError);
      }
    }

    console.log('Permissões de administrador corrigidas com sucesso!');

    return NextResponse.json({
      success: true,
      message: 'Permissões de administrador corrigidas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao corrigir permissões de administrador:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
