import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

/**
 * Rota para corrigir problemas de autenticação
 */
export async function POST(request: NextRequest) {
  try {
    console.log('API fix-auth: Iniciando correção de autenticação');
    
    // Verificar autenticação - tentar obter o token de várias fontes
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    // Se não encontrou no cabeçalho, tentar nos cookies
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) {
        token = tokenCookie.value;
        console.log('API fix-auth: Token encontrado nos cookies');
      }
    }

    if (!token) {
      console.error('API fix-auth: Token não fornecido');
      return NextResponse.json(
        { success: false, error: 'Não autorizado - Token não fornecido' },
        { status: 401 }
      );
    }

    // Verificar se o token tem formato JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('API fix-auth: Token não tem formato JWT válido');
      return NextResponse.json(
        { success: false, error: 'Token inválido - formato incorreto' },
        { status: 401 }
      );
    }

    // Decodificar o token sem verificar a assinatura
    let payload;
    try {
      payload = jwt.decode(token);
      console.log('API fix-auth: Token decodificado:', payload);
    } catch (decodeError) {
      console.error('API fix-auth: Erro ao decodificar token:', decodeError);
      return NextResponse.json(
        { success: false, error: 'Erro ao decodificar token' },
        { status: 401 }
      );
    }

    if (!payload || typeof payload !== 'object' || !payload.userId) {
      console.error('API fix-auth: Token não contém ID do usuário');
      return NextResponse.json(
        { success: false, error: 'Token não contém ID do usuário' },
        { status: 401 }
      );
    }

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
      console.error('API fix-auth: Erro ao buscar usuário:', userError);
      
      // Tentar buscar na tabela users como fallback
      const { data: legacyUserData, error: legacyUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', payload.userId)
        .single();
        
      if (legacyUserError) {
        console.error('API fix-auth: Erro ao buscar usuário na tabela legacy:', legacyUserError);
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
        console.error('API fix-auth: Erro ao criar usuário na tabela unificada:', createError);
        return NextResponse.json(
          { success: false, error: 'Erro ao criar usuário na tabela unificada' },
          { status: 500 }
        );
      }
      
      console.log('API fix-auth: Usuário criado na tabela unificada:', newUnifiedUser.id);
      
      // Gerar um novo token com as informações corretas
      const newToken = jwt.sign(
        {
          userId: newUnifiedUser.id,
          phoneNumber: newUnifiedUser.phone_number,
          role: newUnifiedUser.role,
          email: newUnifiedUser.email
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '1d' }
      );
      
      // Definir o novo token nos cookies
      const response = NextResponse.json({
        success: true,
        message: 'Usuário criado na tabela unificada e novo token gerado',
        user: {
          id: newUnifiedUser.id,
          email: newUnifiedUser.email,
          role: newUnifiedUser.role,
          access_permissions: newUnifiedUser.access_permissions
        },
        token: newToken
      });
      
      // Definir o cookie no response
      response.cookies.set('abzToken', newToken, {
        path: '/',
        sameSite: 'lax',
        secure: request.url.startsWith('https:'),
        maxAge: 60 * 60 * 24 // 1 dia
      });
      
      response.cookies.set('token', newToken, {
        path: '/',
        sameSite: 'lax',
        secure: request.url.startsWith('https:'),
        maxAge: 60 * 60 * 24 // 1 dia
      });
      
      return response;
    }

    // Verificar se o usuário tem permissões
    if (!userData.access_permissions) {
      console.log('API fix-auth: Usuário não tem permissões, adicionando permissões padrão');
      
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
        console.error('API fix-auth: Erro ao atualizar permissões do usuário:', updateError);
        return NextResponse.json(
          { success: false, error: 'Erro ao atualizar permissões do usuário' },
          { status: 500 }
        );
      }
      
      console.log('API fix-auth: Permissões padrão adicionadas ao usuário');
      
      // Gerar um novo token com as informações corretas
      const newToken = jwt.sign(
        {
          userId: userData.id,
          phoneNumber: userData.phone_number,
          role: userData.role,
          email: userData.email
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '1d' }
      );
      
      // Definir o novo token nos cookies
      const response = NextResponse.json({
        success: true,
        message: 'Permissões do usuário corrigidas e novo token gerado',
        user: {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          access_permissions
        },
        token: newToken
      });
      
      // Definir o cookie no response
      response.cookies.set('abzToken', newToken, {
        path: '/',
        sameSite: 'lax',
        secure: request.url.startsWith('https:'),
        maxAge: 60 * 60 * 24 // 1 dia
      });
      
      response.cookies.set('token', newToken, {
        path: '/',
        sameSite: 'lax',
        secure: request.url.startsWith('https:'),
        maxAge: 60 * 60 * 24 // 1 dia
      });
      
      return response;
    }
    
    // Gerar um novo token com as informações corretas
    const newToken = jwt.sign(
      {
        userId: userData.id,
        phoneNumber: userData.phone_number,
        role: userData.role,
        email: userData.email
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1d' }
    );
    
    console.log('API fix-auth: Novo token gerado para o usuário');
    
    // Definir o novo token nos cookies
    const response = NextResponse.json({
      success: true,
      message: 'Novo token gerado para o usuário',
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        access_permissions: userData.access_permissions
      },
      token: newToken
    });
    
    // Definir o cookie no response
    response.cookies.set('abzToken', newToken, {
      path: '/',
      sameSite: 'lax',
      secure: request.url.startsWith('https:'),
      maxAge: 60 * 60 * 24 // 1 dia
    });
    
    response.cookies.set('token', newToken, {
      path: '/',
      sameSite: 'lax',
      secure: request.url.startsWith('https:'),
      maxAge: 60 * 60 * 24 // 1 dia
    });
    
    return response;
  } catch (error) {
    console.error('API fix-auth: Erro ao processar requisição:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
