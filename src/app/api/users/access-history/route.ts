import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';

// GET - Obter histórico de acesso de um usuário
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador ou gerente
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || (requestingUser.role !== 'ADMIN' && requestingUser.role !== 'MANAGER')) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores e gerentes podem acessar o histórico.' },
        { status: 403 }
      );
    }

    // Obter o ID do usuário da query
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar o histórico de acesso do usuário
    try {
      // Buscar na tabela users_unified
      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users_unified')
        .select('id, first_name, last_name, access_history')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar usuário:', fetchError);
        return NextResponse.json(
          { error: 'Erro ao buscar usuário' },
          { status: 500 }
        );
      }

      if (!user) {
        return NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        );
      }

      // Verificar se o histórico existe e está no formato correto
      let accessHistory = user.access_history || [];

      // Garantir que o histórico seja um array
      if (!Array.isArray(accessHistory)) {
        console.log('Histórico não é um array, convertendo...');
        try {
          // Tentar converter de string JSON para array
          if (typeof accessHistory === 'string') {
            accessHistory = JSON.parse(accessHistory);
          }
          // Se ainda não for um array, criar um vazio
          if (!Array.isArray(accessHistory)) {
            accessHistory = [];
          }
        } catch (error) {
          console.error('Erro ao converter histórico:', error);
          accessHistory = [];
        }
      }

      return NextResponse.json({
        userId: user.id,
        fullName: `${user.first_name} ${user.last_name}`,
        accessHistory: accessHistory
      });
    } catch (error) {
      console.error('Erro ao buscar histórico de acesso:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar histórico de acesso' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao obter histórico de acesso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Registrar uma nova entrada no histórico de acesso
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();
    const { userId, action, details } = body;

    // Validar os dados
    if (!userId || !action) {
      return NextResponse.json(
        { error: 'ID do usuário e ação são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: requestingUser, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role')
      .eq('id', payload.userId)
      .single();

    if (userError || !requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem registrar histórico.' },
        { status: 403 }
      );
    }

    // Buscar o usuário
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users_unified')
      .select('id, access_history')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Adicionar entrada ao histórico
    const historyEntry = {
      timestamp: new Date(),
      action,
      details: details || ''
    };

    // Obter o histórico atual
    let accessHistory = user.access_history || [];

    // Garantir que o histórico seja um array
    if (!Array.isArray(accessHistory)) {
      try {
        // Tentar converter de string JSON para array
        if (typeof accessHistory === 'string') {
          accessHistory = JSON.parse(accessHistory);
        }
        // Se ainda não for um array, criar um vazio
        if (!Array.isArray(accessHistory)) {
          accessHistory = [];
        }
      } catch (error) {
        console.error('Erro ao converter histórico:', error);
        accessHistory = [];
      }
    }

    // Atualizar o usuário com o novo histórico
    const { error: updateError } = await supabaseAdmin
      .from('users_unified')
      .update({
        access_history: [...accessHistory, historyEntry],
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar histórico:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar histórico de acesso' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Histórico de acesso registrado com sucesso',
      entry: historyEntry
    });
  } catch (error) {
    console.error('Erro ao registrar histórico de acesso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
