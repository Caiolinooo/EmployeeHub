import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { extractTokenFromHeader, verifyToken, TokenPayload } from '@/lib/auth'; // Importar TokenPayload

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API endpoint para obter reembolsos para um usuário específico.
 * Este endpoint lida com a busca de reembolsos com autenticação adequada e permissões baseadas no papel do usuário.
 */
export async function GET(request: NextRequest) {
  try {
    // Runtime check to ensure this only runs during actual HTTP requests
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'Esta rota só pode ser executada no servidor' },
        { status: 500 }
      );
    }

    // Check if we're in a static generation context
    if (!request || !request.headers || !request.url) {
      return NextResponse.json(
        { error: 'Rota não disponível durante geração estática' },
        { status: 503 }
      );
    }

    console.log('Requisição de reembolsos do usuário recebida');

    // 1. Verificar autenticação e obter payload do token
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.error('Não autorizado: Token não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload: TokenPayload | null = verifyToken(token); // Usar o tipo importado
    if (!payload) {
      console.error('Não autorizado: Token inválido ou expirado');
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const userId = payload.userId;
    const userRole = payload.role;
    // Obter o email principal do usuário logado a partir do payload do token ou do banco de dados
    // Priorizar o email do payload se existir, caso contrário buscar no banco
    let userEmail = payload.email || '';

    // Se o email não estiver no payload, buscar no banco
    if (!userEmail) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users_unified') // Assumindo que o email principal está nesta tabela
        .select('email')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Erro ao buscar email do usuário logado:', userError);
        // Continuar mesmo sem o email principal, a busca será feita pelos emails adicionais
      } else {
        userEmail = userData?.email || '';
      }
    }

    console.log('Usuário autenticado:', userId, 'Papel:', userRole, 'Email principal:', userEmail);

    // 2. Obter email do parâmetro de query (usado principalmente para admins/gerentes buscarem por email)
    let queryEmail = null;
    try {
      const { searchParams } = new URL(request.url);
      queryEmail = searchParams.get('email');
    } catch (error) {
      console.error('Erro ao processar URL:', error);
      // Continue sem o parâmetro se houver erro
    }

    // 3. Verificar permissões
    const isAdmin = userRole === 'ADMIN';
    const isManager = userRole === 'MANAGER';

    // Verificar se a coluna user_id existe na tabela Reimbursement
    const { data: columns, error: columnsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'Reimbursement')
      .eq('column_name', 'user_id');

    if (columnsError) {
      console.error('Erro ao verificar coluna user_id:', columnsError);
    }

    const hasUserIdColumn = columns && columns.length > 0;
    console.log(`Coluna user_id ${hasUserIdColumn ? 'existe' : 'não existe'} na tabela Reimbursement`);

    // Se a coluna user_id não existir, tentar adicioná-la
    if (!hasUserIdColumn) {
      console.log('Tentando adicionar coluna user_id...');
      try {
        const addColumnResponse = await fetch('/api/reembolso/add-user-id-column', {
          method: 'GET',
        });

        if (addColumnResponse.ok) {
          console.log('Coluna user_id adicionada com sucesso');
        } else {
          console.error('Erro ao adicionar coluna user_id');
        }
      } catch (error) {
        console.error('Erro ao chamar API para adicionar coluna user_id:', error);
      }
    }

    // Determinar se devemos usar email ou user_id para filtrar
    let queryUserId: string | null = null;
    let queryUserEmail: string | null = null;

    if (isAdmin || isManager) {
      // Admins e gerentes podem ver reembolsos de qualquer usuário
      if (queryEmail) {
        // Se um email específico for fornecido, buscar o user_id correspondente
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users_unified')
          .select('id')
          .eq('email', queryEmail.toLowerCase().trim());

        if (!userError && userData && userData.length > 0) {
          queryUserId = userData[0].id;
          console.log(`Admin/Manager buscando por user_id específico: ${queryUserId} (email: ${queryEmail})`);
        } else {
          // Se não encontrar o usuário pelo email principal, tentar buscar em user_emails
          const { data: userEmailsData, error: emailsError } = await supabaseAdmin
            .from('user_emails')
            .select('user_id')
            .eq('email', queryEmail.toLowerCase().trim());

          if (!emailsError && userEmailsData && userEmailsData.length > 0) {
            queryUserId = userEmailsData[0].user_id;
            console.log(`Admin/Manager buscando por user_id específico: ${queryUserId} (email adicional: ${queryEmail})`);
          } else {
            // Se não encontrar o usuário, usar o email para busca (compatibilidade com dados antigos)
            queryUserEmail = queryEmail.toLowerCase().trim();
            console.log(`Admin/Manager buscando por email específico: ${queryUserEmail} (user_id não encontrado)`);
          }
        }
      } else {
        // Se nenhum email for especificado, eles podem ver todos os reembolsos
        console.log('Admin/Manager buscando todos os reembolsos');
      }
    } else {
      // Usuários normais só podem ver seus próprios reembolsos
      console.log(`Usuário normal (${userId}) buscando seus próprios reembolsos`);
      queryUserId = userId;
    }

    // 4. Obter parâmetros de paginação e filtro
    let status = null;
    let page = 1;
    let limit = 10;
    
    try {
      const { searchParams: paginationParams } = new URL(request.url);
      status = paginationParams.get('status');
      page = parseInt(paginationParams.get('page') || '1', 10);
      limit = parseInt(paginationParams.get('limit') || '10', 10);
    } catch (error) {
      console.error('Erro ao processar parâmetros de paginação:', error);
      // Use valores padrão se houver erro
    }

    // Calcular range de paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    console.log('Buscando reembolsos com parâmetros:', {
      queryUserId,
      queryUserEmail,
      status: status || 'all',
      page,
      limit,
      from,
      to
    });

    // 5. Construir e executar a query
    let query = supabaseAdmin
      .from('Reimbursement')
      .select('*', { count: 'exact' });

    // Aplicar filtros baseados em user_id ou email
    if (hasUserIdColumn && queryUserId) {
      // Se a coluna user_id existir e tivermos um user_id para filtrar, usar user_id
      // Mas também incluir reembolsos antigos que podem ter apenas email
      query = query.or(`user_id.eq.${queryUserId},and(user_id.is.null,email.eq.${userEmail})`);
    } else if (queryUserEmail) {
      // Se tivermos um email específico para filtrar, usar email
      query = query.eq('email', queryUserEmail);
    } else if (!isAdmin && !isManager) {
      // Se for um usuário normal sem user_id ou email para filtrar, usar o email do usuário
      // Incluir tanto reembolsos com user_id quanto reembolsos antigos apenas com email
      query = query.or(`user_id.eq.${userId},and(user_id.is.null,email.eq.${userEmail})`);
    }

    // Aplicar filtro de status se fornecido
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Aplicar paginação e ordenação
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    // Executar a query
    const { data: reimbursements, error: queryError, count } = await query;

    if (queryError) {
      console.error('Erro ao consultar reembolsos:', queryError);
      return NextResponse.json(
        { error: 'Falha ao buscar reembolsos', details: queryError.message },
        { status: 500 }
      );
    }

    console.log(`Encontrados ${reimbursements?.length || 0} reembolsos, total: ${count}`);

    return NextResponse.json({
      data: reimbursements || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        hasMore: count ? (from + limit < count) : false
      }
    });

  } catch (error) {
    console.error('Erro ao buscar reembolsos do usuário:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
