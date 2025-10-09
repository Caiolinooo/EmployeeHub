import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';

/**
 * Rota para obter uma avaliação específica pelo ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação - tentar obter o token de várias fontes
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);

    // Log detalhado para depuração
    console.log('API avaliacao GET: Cabeçalho de autorização:', authHeader ? 'Presente' : 'Ausente');
    console.log('API avaliacao GET: Token extraído do cabeçalho:', token ? 'Presente' : 'Ausente');

    // Se não encontrou no cabeçalho, tentar nos cookies
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) {
        token = tokenCookie.value;
        console.log('API avaliacao GET: Token encontrado nos cookies');
      }
    }

    // Para visualização de avaliações, permitir acesso mesmo sem token
    // Isso será restringido mais tarde com base no ID do funcionário
    let payload = null;
    if (token) {
      payload = verifyToken(token);
      if (!payload) {
        console.warn('API avaliacao GET: Token inválido ou expirado, continuando com acesso limitado');
      }
    } else {
      console.warn('API avaliacao GET: Token não fornecido, continuando com acesso limitado');
    }

    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;
    console.log(`API avaliacao GET: Buscando avaliação com ID: ${id}`);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Buscar a avaliação usando a view que já tem os joins
    const { data: avaliacao, error } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select(`
        id,
        funcionario_id,
        avaliador_id,
        periodo,
        data_inicio,
        data_fim,
        status,
        pontuacao_total,
        observacoes,
        created_at,
        updated_at,
        funcionario_nome,
        funcionario_cargo,
        funcionario_departamento,
        avaliador_nome,
        avaliador_cargo
      `)
      .eq('id', id)
      .single();

    // Verificar permissões de acesso
    if (avaliacao && payload) {
      const isAdmin = payload.role === 'ADMIN';
      const isManager = payload.role === 'MANAGER';

      // Se não for admin ou manager, verificar se o usuário está tentando acessar sua própria avaliação
      if (!isAdmin && !isManager && avaliacao.funcionario_id !== payload.userId) {
        console.error('Usuário tentando acessar avaliação de outro funcionário:', payload.userId, avaliacao.funcionario_id);
        return NextResponse.json({
          success: false,
          error: 'Você não tem permissão para acessar esta avaliação',
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    if (error) {
      console.error('Erro ao buscar avaliação:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: error.code === 'PGRST116' ? 404 : 500 });
    }

    if (!avaliacao) {
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Buscar os critérios avaliados para esta avaliação
    const { data: criterios, error: criteriosError } = await supabase
      .from('pontuacoes')
      .select(`
        id,
        criterio_id,
        valor,
        observacao,
        criterios(id, nome, descricao, categoria, peso, pontuacao_maxima)
      `)
      .eq('avaliacao_id', id);

    if (criteriosError) {
      console.error('Erro ao buscar critérios da avaliação:', criteriosError);
    }

    // Processar os critérios para um formato mais amigável
    const criteriosProcessados = criterios?.map(c => ({
      id: c.id,
      criterioId: c.criterio_id,
      nota: c.valor,
      comentario: c.observacao,
      nome: (c.criterios as any)?.nome,
      descricao: (c.criterios as any)?.descricao,
      categoria: (c.criterios as any)?.categoria,
      peso: (c.criterios as any)?.peso || 1,
      notaMaxima: (c.criterios as any)?.pontuacao_maxima || 5
    })) || [];

    // Determinar se deve ocultar informações do avaliador
    const isAdmin = payload?.role === 'ADMIN';
    const isManager = payload?.role === 'MANAGER';
    const shouldHideEvaluatorInfo = !isAdmin && !isManager;

    // Retornar a avaliação com os critérios
    return NextResponse.json({
      success: true,
      data: {
        ...avaliacao,
        criterios: criteriosProcessados,
        // Adicionar objetos para compatibilidade com o código existente
        funcionario: {
          id: avaliacao.funcionario_id,
          nome: avaliacao.funcionario_nome || 'Funcionário não encontrado',
          cargo: avaliacao.funcionario_cargo,
          departamento: avaliacao.funcionario_departamento
        },
        // Ocultar informações do avaliador para usuários regulares
        avaliador: shouldHideEvaluatorInfo ?
          { id: null, nome: 'Informação confidencial', cargo: null } :
          {
            id: avaliacao.avaliador_id,
            nome: avaliacao.avaliador_nome || 'Avaliador não encontrado',
            cargo: avaliacao.avaliador_cargo
          },
        // Ocultar timestamps para usuários regulares
        created_at: shouldHideEvaluatorInfo ? null : avaliacao.created_at,
        updated_at: shouldHideEvaluatorInfo ? null : avaliacao.updated_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao obter avaliação:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para atualizar uma avaliação
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é um gerente (MANAGER) ou administrador (ADMIN)
    if (payload.role !== 'MANAGER' && payload.role !== 'ADMIN') {
      console.error('Usuário não autorizado a atualizar avaliações:', payload.userId, payload.role);
      return NextResponse.json({
        success: false,
        error: 'Apenas gerentes e administradores podem atualizar avaliações.',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;
    console.log(`API avaliacao PUT: Atualizando avaliação com ID: ${id}`);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Verificar se a avaliação existe
    const { data: avaliacaoExistente, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !avaliacaoExistente) {
      console.error('Avaliação não encontrada:', id);
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Obter dados do corpo da requisição
    const data = await request.json();
    console.log('Dados recebidos para atualização:', data);

    // Atualizar a avaliação
    const { error: updateError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .update({
        funcionario_id: data.funcionario_id || data.funcionarioId,
        avaliador_id: data.avaliador_id || data.avaliadorId,
        periodo: data.periodo,
        data_inicio: data.data_inicio || data.dataInicio,
        data_fim: data.data_fim || data.dataFim,
        status: data.status,
        observacoes: data.observacoes || data.comentarios,
        pontuacao_total: data.pontuacao_total || data.pontuacao || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Erro ao atualizar avaliação:', updateError);
      return NextResponse.json({
        success: false,
        error: updateError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Se houver critérios, atualizar as pontuações
    if (data.criterios && Array.isArray(data.criterios) && data.criterios.length > 0) {
      console.log('Atualizando critérios da avaliação:', data.criterios.length);

      // Para cada critério, atualizar ou criar a pontuação
      for (const criterio of data.criterios) {
        const pontuacaoData = {
          avaliacao_id: id,
          criterio_id: criterio.criterioId || criterio.criterio_id,
          valor: criterio.nota || criterio.valor || 0,
          observacao: criterio.comentario || criterio.observacao || ''
        };

        // Verificar se já existe uma pontuação para este critério nesta avaliação
        const { data: existingPontuacao, error: checkPontuacaoError } = await supabase
          .from('pontuacoes')
          .select('id')
          .eq('avaliacao_id', id)
          .eq('criterio_id', pontuacaoData.criterio_id)
          .single();

        if (existingPontuacao) {
          // Atualizar pontuação existente
          const { error: updatePontuacaoError } = await supabaseAdmin
            .from('pontuacoes')
            .update({
              valor: pontuacaoData.valor,
              observacao: pontuacaoData.observacao
            })
            .eq('id', existingPontuacao.id);

          if (updatePontuacaoError) {
            console.error('Erro ao atualizar pontuação:', updatePontuacaoError);
          }
        } else {
          // Criar nova pontuação
          const { error: insertPontuacaoError } = await supabaseAdmin
            .from('pontuacoes')
            .insert(pontuacaoData);

          if (insertPontuacaoError) {
            console.error('Erro ao criar pontuação:', insertPontuacaoError);
          }
        }
      }
    }

    // Buscar a avaliação atualizada
    const { data: avaliacaoAtualizada, error: getError } = await supabase
      .from('vw_avaliacoes_desempenho')
      .select(`
        id,
        funcionario_id,
        avaliador_id,
        periodo,
        data_inicio,
        data_fim,
        status,
        pontuacao_total,
        observacoes,
        created_at,
        updated_at,
        funcionario_nome,
        funcionario_cargo,
        funcionario_departamento,
        avaliador_nome,
        avaliador_cargo
      `)
      .eq('id', id)
      .single();

    if (getError) {
      console.error('Erro ao buscar avaliação atualizada:', getError);
      return NextResponse.json({
        success: true,
        message: 'Avaliação atualizada com sucesso, mas não foi possível recuperar os dados atualizados',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      data: avaliacaoAtualizada,
      message: 'Avaliação atualizada com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao atualizar avaliação:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para excluir uma avaliação
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é um gerente (MANAGER) ou administrador (ADMIN)
    if (payload.role !== 'MANAGER' && payload.role !== 'ADMIN') {
      console.error('Usuário não autorizado a excluir avaliações:', payload.userId, payload.role);
      return NextResponse.json({
        success: false,
        error: 'Apenas gerentes e administradores podem excluir avaliações.',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;
    console.log(`API avaliacao DELETE: Excluindo avaliação com ID: ${id}`);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Verificar se a avaliação existe
    const { data: avaliacaoExistente, error: checkError } = await supabase
      .from('avaliacoes_desempenho')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !avaliacaoExistente) {
      console.error('Avaliação não encontrada:', id);
      return NextResponse.json({
        success: false,
        error: 'Avaliação não encontrada',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Primeiro, excluir as pontuações relacionadas a esta avaliação
    const { error: deletePontuacoesError } = await supabaseAdmin
      .from('pontuacoes')
      .delete()
      .eq('avaliacao_id', id);

    if (deletePontuacoesError) {
      console.error('Erro ao excluir pontuações da avaliação:', deletePontuacoesError);
      return NextResponse.json({
        success: false,
        error: `Erro ao excluir pontuações: ${deletePontuacoesError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Agora, excluir a avaliação
    const { error: deleteError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir avaliação:', deleteError);

      // Tentar excluir da tabela avaliacoes como fallback
      console.log('Tentando excluir da tabela avaliacoes como fallback');
      const { error: fallbackDeleteError } = await supabaseAdmin
        .from('avaliacoes')
        .delete()
        .eq('id', id);

      if (fallbackDeleteError) {
        console.error('Erro ao excluir avaliação da tabela fallback:', fallbackDeleteError);
        return NextResponse.json({
          success: false,
          error: `Erro ao excluir avaliação: ${deleteError.message}. Fallback também falhou: ${fallbackDeleteError.message}`,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }

      console.log('Avaliação excluída com sucesso da tabela fallback');
    } else {
      console.log('Avaliação excluída com sucesso da tabela principal');
    }

    return NextResponse.json({
      success: true,
      message: 'Avaliação excluída com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao excluir avaliação:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
