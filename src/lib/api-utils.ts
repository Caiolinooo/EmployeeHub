/**
 * Utilitários para APIs
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, isAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/**
 * Verifica a autenticação e autorização do usuário
 * @param request Requisição Next.js
 * @param requireAdmin Se true, verifica se o usuário é administrador
 * @returns Objeto com usuário e payload do token, ou resposta de erro
 */
export async function verifyAuth(request: NextRequest, requireAdmin = false) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return {
        error: NextResponse.json(
          { error: 'Não autorizado' },
          { status: 401 }
        )
      };
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return {
        error: NextResponse.json(
          { error: 'Token inválido' },
          { status: 401 }
        )
      };
    }

    const token = tokenParts[1];

    // Verificar token
    const payload = verifyToken(token);
    if (!payload) {
      return {
        error: NextResponse.json(
          { error: 'Token inválido' },
          { status: 401 }
        )
      };
    }

    // Buscar usuário pelo ID
    let { data: user, error } = await supabase
      .from('users_unified')
      .select('*')
      .eq('id', payload.userId)
      .single();

    // Se não encontrar pelo ID, tentar pelo número de telefone
    if (!user && payload.phoneNumber) {
      console.log('Usuário não encontrado pelo ID, tentando pelo telefone:', payload.phoneNumber);
      const { data: userByPhone, error: phoneError } = await supabase
        .from('users_unified')
        .select('*')
        .eq('phone_number', payload.phoneNumber)
        .single();

      if (!phoneError) {
        user = userByPhone;
      }
    }

    // Verificar se o usuário existe
    if (!user) {
      return {
        error: NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 401 }
        )
      };
    }

    // Verificar se o usuário está ativo
    if (!user.active) {
      return {
        error: NextResponse.json(
          { error: 'Conta desativada' },
          { status: 403 }
        )
      };
    }

    // Verificar se o usuário é administrador (se necessário)
    console.log('Verificando permissão de admin:', { requireAdmin, isAdmin: isAdmin(user), role: user.role });
    if (requireAdmin && !isAdmin(user)) {
      console.log('Acesso negado: usuário não é administrador');
      return {
        error: NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        )
      };
    }

    // Retornar usuário e payload
    return { user, payload };
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return {
      error: NextResponse.json(
        { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
        { status: 500 }
      )
    };
  }
}

/**
 * Processa erros de API de forma consistente
 * @param error Erro capturado
 * @returns Resposta de erro formatada
 */
export function handleApiError(error: unknown) {
  console.error('Erro na API:', error);

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
    { status: 500 }
  );
}
