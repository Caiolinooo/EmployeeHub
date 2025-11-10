import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Rota para corrigir as permissões do usuário
 */
export async function POST(request: NextRequest) {
  try {
    console.log('API fix-permissions: Iniciando correção de permissões');
    
    // Verificar autenticação - tentar obter o token de várias fontes
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    // Se não encontrou no cabeçalho, tentar nos cookies
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) {
        token = tokenCookie.value;
        console.log('API fix-permissions: Token encontrado nos cookies');
      }
    }

    if (!token) {
      console.error('API fix-permissions: Token não fornecido');
      return NextResponse.json(
        { success: false, error: 'Não autorizado - Token não fornecido' },
        { status: 401 }
      );
    }

    // Verificar o token
    const payload = verifyToken(token);
    if (!payload) {
      console.error('API fix-permissions: Token inválido');
      return NextResponse.json(
        { success: false, error: 'Não autorizado - Token inválido' },
        { status: 401 }
      );
    }

    console.log('API fix-permissions: Token válido para usuário:', payload.userId);

    // Inicializar cliente Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar o usuário
    const { data: userData, error: userError } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('API fix-permissions: Erro ao buscar usuário:', userError);
      
      // Tentar buscar na tabela users como fallback
      const { data: legacyUserData, error: legacyUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', payload.userId)
        .single();
        
      if (legacyUserError) {
        console.error('API fix-permissions: Erro ao buscar usuário na tabela legacy:', legacyUserError);
        return NextResponse.json(
          { success: false, error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }
      
      // Criar um perfil na tabela users_unified
      const { data: newUnifiedUser, error: createError } = await supabase
        .from('users_unified')
        .insert({
          id: legacyUserData.id,
          email: legacyUserData.email,
          phone_number: legacyUserData.phoneNumber || legacyUserData.phone_number,
          first_name: legacyUserData.firstName || legacyUserData.first_name,
          last_name: legacyUserData.lastName || legacyUserData.last_name,
          role: legacyUserData.role,
          active: true,
          created_at: legacyUserData.createdAt || legacyUserData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          access_permissions: {
            modules: {
              dashboard: true,
              manual: true,
              procedimentos: true,
              politicas: true,
              calendario: true,
              noticias: true,
              reembolso: true,
              contracheque: true,
              ponto: true,
              ...(legacyUserData.role === 'ADMIN' ? { admin: true, avaliacao: true } : {}),
              ...(legacyUserData.role === 'MANAGER' ? { avaliacao: true } : {})
            },
            features: {}
          }
        })
        .select()
        .single();
        
      if (createError) {
        console.error('API fix-permissions: Erro ao criar usuário na tabela unificada:', createError);
        return NextResponse.json(
          { success: false, error: 'Erro ao criar usuário na tabela unificada' },
          { status: 500 }
        );
      }
      
      console.log('API fix-permissions: Usuário criado na tabela unificada:', newUnifiedUser.id);
      
      return NextResponse.json({
        success: true,
        message: 'Usuário criado na tabela unificada com permissões corrigidas',
        user: {
          id: newUnifiedUser.id,
          email: newUnifiedUser.email,
          role: newUnifiedUser.role,
          access_permissions: newUnifiedUser.access_permissions
        }
      });
    }

    // Verificar se o usuário tem permissões
    if (!userData.access_permissions) {
      console.log('API fix-permissions: Usuário não tem permissões, adicionando permissões padrão');
      
      // Adicionar permissões padrão
      const access_permissions = {
        modules: {
          dashboard: true,
          manual: true,
          procedimentos: true,
          politicas: true,
          calendario: true,
          noticias: true,
          reembolso: true,
          contracheque: true,
          ponto: true,
          ...(userData.role === 'ADMIN' ? { admin: true, avaliacao: true } : {}),
          ...(userData.role === 'MANAGER' ? { avaliacao: true } : {})
        },
        features: {}
      };
      
      // Atualizar no banco de dados
      const { error: updateError } = await supabase
        .from('users_unified')
        .update({
          access_permissions,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);
        
      if (updateError) {
        console.error('API fix-permissions: Erro ao atualizar permissões do usuário:', updateError);
        return NextResponse.json(
          { success: false, error: 'Erro ao atualizar permissões do usuário' },
          { status: 500 }
        );
      }
      
      console.log('API fix-permissions: Permissões padrão adicionadas ao usuário');
      
      return NextResponse.json({
        success: true,
        message: 'Permissões do usuário corrigidas',
        user: {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          access_permissions
        }
      });
    }
    
    // Verificar se o usuário tem permissão para o módulo de avaliação
    if (userData.role === 'ADMIN' || userData.role === 'MANAGER') {
      if (!userData.access_permissions.modules?.avaliacao) {
        console.log('API fix-permissions: Usuário não tem permissão para o módulo de avaliação, adicionando');
        
        // Adicionar permissão para o módulo de avaliação
        const access_permissions = {
          ...userData.access_permissions,
          modules: {
            ...userData.access_permissions.modules,
            avaliacao: true
          }
        };
        
        // Atualizar no banco de dados
        const { error: updateError } = await supabase
          .from('users_unified')
          .update({
            access_permissions,
            updated_at: new Date().toISOString()
          })
          .eq('id', userData.id);
          
        if (updateError) {
          console.error('API fix-permissions: Erro ao atualizar permissões do usuário:', updateError);
          return NextResponse.json(
            { success: false, error: 'Erro ao atualizar permissões do usuário' },
            { status: 500 }
          );
        }
        
        console.log('API fix-permissions: Permissão para o módulo de avaliação adicionada ao usuário');
        
        return NextResponse.json({
          success: true,
          message: 'Permissão para o módulo de avaliação adicionada ao usuário',
          user: {
            id: userData.id,
            email: userData.email,
            role: userData.role,
            access_permissions
          }
        });
      }
    }
    
    console.log('API fix-permissions: Usuário já tem as permissões corretas');
    
    return NextResponse.json({
      success: true,
      message: 'Usuário já tem as permissões corretas',
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        access_permissions: userData.access_permissions
      }
    });
  } catch (error) {
    console.error('API fix-permissions: Erro ao processar requisição:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
