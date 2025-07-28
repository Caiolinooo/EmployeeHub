import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { isValidUUID, generateUUID } from '@/lib/uuid-utils';

/**
 * Rota para listar avaliações
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      console.error('API avaliacoes: Token não fornecido');
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.error('API avaliacoes: Token inválido ou expirado');
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    console.log('API avaliacoes: Usuário autenticado:', payload.userId);

    // Obter parâmetros da URL
    const url = new URL(request.url);
    const funcionarioId = url.searchParams.get('funcionarioId');
    const ano = url.searchParams.get('ano');
    const periodo = url.searchParams.get('periodo');

    // Construir a consulta base - usando a view que já tem os joins
    let query = supabase
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
      `);

    // Filtrar por funcionário se especificado
    if (funcionarioId) {
      query = query.eq('funcionario_id', funcionarioId);
    }

    // Filtrar por ano se especificado
    if (ano) {
      query = query.or(`data_inicio.gte.${ano}-01-01,data_inicio.lte.${ano}-12-31`);
    }

    // Filtrar por período se especificado
    if (periodo) {
      query = query.eq('periodo', periodo);
    }

    // Ordenar por data de criação (mais recentes primeiro)
    query = query.order('created_at', { ascending: false });

    // Executar a consulta
    const { data: avaliacoes, error } = await query;

    if (error) {
      console.error('Erro ao buscar avaliações:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: avaliacoes || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao obter avaliações:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para criar uma nova avaliação
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação - tentar obter o token de várias fontes
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);

    // Log detalhado para depuração
    console.log('API avaliacoes POST: Cabeçalho de autorização:', authHeader ? 'Presente' : 'Ausente');
    console.log('API avaliacoes POST: Token extraído do cabeçalho:', token ? 'Presente' : 'Ausente');

    // Se não encontrou no cabeçalho, tentar nos cookies
    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) {
        token = tokenCookie.value;
        console.log('API avaliacoes POST: Token encontrado nos cookies');
      }
    }

    // Se ainda não encontrou, verificar parâmetros de consulta (para compatibilidade)
    if (!token) {
      const url = new URL(request.url);
      token = url.searchParams.get('token');
      console.log('API avaliacoes POST: Token nos parâmetros de consulta:', token ? 'Presente' : 'Ausente');
    }

    if (!token) {
      console.error('API avaliacoes POST: Token não fornecido em nenhuma fonte');
      return NextResponse.json(
        { success: false, error: 'Não autorizado - Token não fornecido' },
        { status: 401 }
      );
    }

    console.log('API avaliacoes POST: Verificando token com comprimento:', token.length);

    // Verificar se o token é um JWT válido antes de tentar decodificá-lo
    let isValidJwt = false;
    try {
      const parts = token.split('.');
      isValidJwt = parts.length === 3;
      console.log('API avaliacoes POST: Token tem formato JWT válido:', isValidJwt);
    } catch (e) {
      console.error('API avaliacoes POST: Erro ao verificar formato do token:', e);
    }

    if (!isValidJwt) {
      console.error('API avaliacoes POST: Token não tem formato JWT válido');
      return NextResponse.json(
        { success: false, error: 'Token inválido - formato incorreto' },
        { status: 401 }
      );
    }

    // Verificar o token
    const payload = verifyToken(token);
    if (!payload) {
      console.error('API avaliacoes POST: Token inválido ou expirado');
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Log para depuração
    console.log('API avaliacoes POST: Usuário autenticado:', payload.userId);
    console.log('API avaliacoes POST: Role do usuário:', payload.role);

    // Verificar se o usuário é um gerente (MANAGER) ou administrador (ADMIN)
    if (payload.role !== 'MANAGER' && payload.role !== 'ADMIN') {
      console.error('Usuário não autorizado a criar avaliações:', payload.userId, payload.role);
      return NextResponse.json({
        success: false,
        error: 'Apenas gerentes e administradores podem criar avaliações.',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Obter dados do corpo da requisição
    const data = await request.json();

    console.log('Dados recebidos na API:', JSON.stringify(data, null, 2));

    // Verificar se os IDs estão no formato correto (funcionario_id ou funcionarioId)
    const funcionarioIdToCheck = data.funcionario_id || data.funcionarioId;
    const avaliadorIdToCheck = data.avaliador_id || data.avaliadorId;

    console.log('IDs extraídos:', {
      funcionarioIdToCheck,
      avaliadorIdToCheck,
      funcionario_id: data.funcionario_id,
      avaliador_id: data.avaliador_id,
      funcionarioId: data.funcionarioId,
      avaliadorId: data.avaliadorId
    });

    if (!data || !funcionarioIdToCheck || !avaliadorIdToCheck) {
      return NextResponse.json(
        { error: 'Dados inválidos. É necessário fornecer o ID do funcionário e do avaliador.' },
        { status: 400 }
      );
    }

    // Validar se o período foi fornecido
    if (!data.periodo) {
      return NextResponse.json(
        { error: 'Dados inválidos. É necessário fornecer o período da avaliação.' },
        { status: 400 }
      );
    }

    // Preparar datas
    const dataInicio = data.dataInicio || data.data_inicio || new Date().toISOString().split('T')[0];
    const dataFim = data.dataFim || data.data_fim || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0];

    console.log('IDs para verificação:', {
      funcionarioIdToCheck,
      avaliadorIdToCheck,
      originalFuncionarioId: data.funcionario_id,
      originalAvaliadorId: data.avaliador_id,
      fallbackFuncionarioId: data.funcionarioId,
      fallbackAvaliadorId: data.avaliadorId
    });

    // Verificar se os IDs de funcionário e avaliador existem na tabela funcionarios
    console.log('Buscando funcionário com ID:', funcionarioIdToCheck);

    // Primeiro, vamos verificar todos os funcionários para depuração
    const { data: allFuncionarios, error: allFuncionariosError } = await supabase
      .from('funcionarios')
      .select('id, nome, user_id')
      .limit(10);

    if (allFuncionariosError) {
      console.error('Erro ao buscar todos os funcionários:', allFuncionariosError);
    } else {
      console.log('Amostra de funcionários disponíveis:', allFuncionarios.map(f => ({
        id: f.id,
        nome: f.nome,
        user_id: f.user_id
      })));
    }

    // Tentar buscar pelo ID do funcionário primeiro
    let funcionarioCheck;
    let funcionarioError;

    // Verificar se o ID fornecido é um UUID (possível user_id)
    const isFuncionarioUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(funcionarioIdToCheck);

    if (isFuncionarioUUID) {
      // Tentar buscar pelo user_id primeiro
      const { data: userIdCheck, error: userIdError } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, departamento, user_id')
        .eq('user_id', funcionarioIdToCheck)
        .single();

      if (!userIdError && userIdCheck) {
        console.log('Funcionário encontrado pelo user_id:', userIdCheck);
        funcionarioCheck = userIdCheck;
        funcionarioError = null;
      } else {
        // Se não encontrou pelo user_id, tentar pelo id
        const { data: idCheck, error: idError } = await supabase
          .from('funcionarios')
          .select('id, nome, cargo, departamento, user_id')
          .eq('id', funcionarioIdToCheck)
          .single();

        funcionarioCheck = idCheck;
        funcionarioError = idError;
      }
    } else {
      // Se não for UUID, buscar pelo id diretamente
      const { data: idCheck, error: idError } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, departamento, user_id')
        .eq('id', funcionarioIdToCheck)
        .single();

      funcionarioCheck = idCheck;
      funcionarioError = idError;
    }

    console.log('Verificação de funcionário:', {
      funcionarioId: funcionarioIdToCheck,
      encontrado: !!funcionarioCheck,
      erro: funcionarioError ? funcionarioError.message : null,
      detalhes: funcionarioCheck ? {
        id: funcionarioCheck.id,
        nome: funcionarioCheck.nome,
        user_id: funcionarioCheck.user_id
      } : null
    });

    if (funcionarioError) {
      console.error('Erro ao verificar funcionário:', funcionarioError);
      console.error('ID do funcionário fornecido:', funcionarioIdToCheck);
      return NextResponse.json({
        success: false,
        error: 'Funcionário não encontrado. Verifique se o ID está correto.',
        details: funcionarioError.message,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log('Buscando avaliador com ID:', avaliadorIdToCheck);

    // Tentar buscar pelo ID do avaliador
    let avaliadorCheck;
    let avaliadorError;

    // Verificar se o ID fornecido é um UUID (possível user_id)
    const isAvaliadorUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(avaliadorIdToCheck);

    if (isAvaliadorUUID) {
      // Tentar buscar pelo user_id primeiro
      const { data: userIdCheck, error: userIdError } = await supabase
        .from('funcionarios')
        .select('id, nome, user_id')
        .eq('user_id', avaliadorIdToCheck)
        .single();

      if (!userIdError && userIdCheck) {
        console.log('Avaliador encontrado pelo user_id:', userIdCheck);
        avaliadorCheck = userIdCheck;
        avaliadorError = null;
      } else {
        // Se não encontrou pelo user_id, tentar pelo id
        const { data: idCheck, error: idError } = await supabase
          .from('funcionarios')
          .select('id, nome, user_id')
          .eq('id', avaliadorIdToCheck)
          .single();

        avaliadorCheck = idCheck;
        avaliadorError = idError;
      }
    } else {
      // Se não for UUID, buscar pelo id diretamente
      const { data: idCheck, error: idError } = await supabase
        .from('funcionarios')
        .select('id, nome, user_id')
        .eq('id', avaliadorIdToCheck)
        .single();

      avaliadorCheck = idCheck;
      avaliadorError = idError;
    }

    console.log('Verificação de avaliador:', {
      avaliadorId: avaliadorIdToCheck,
      encontrado: !!avaliadorCheck,
      erro: avaliadorError ? avaliadorError.message : null,
      detalhes: avaliadorCheck ? {
        id: avaliadorCheck.id,
        nome: avaliadorCheck.nome,
        user_id: avaliadorCheck.user_id
      } : null
    });

    if (avaliadorError) {
      console.error('Erro ao verificar avaliador:', avaliadorError);
      console.error('ID do avaliador fornecido:', avaliadorIdToCheck);
      return NextResponse.json({
        success: false,
        error: 'Avaliador não encontrado. Verifique se o ID está correto.',
        details: avaliadorError.message,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log('Funcionário e avaliador verificados com sucesso. Criando avaliação...');
    console.log('Dados da avaliação:', {
      funcionario_id: funcionarioIdToCheck,
      avaliador_id: avaliadorIdToCheck,
      periodo: data.periodo,
      data_inicio: dataInicio,
      data_fim: dataFim
    });

    // Verificar se os IDs estão no formato correto (funcionario_id ou funcionarioId)
    // Usar os IDs já verificados anteriormente
    const funcionarioId = funcionarioCheck?.id;
    const avaliadorId = avaliadorCheck?.id;

    console.log('IDs para criação de avaliação:', {
      funcionarioId,
      avaliadorId,
      originalFuncionarioId: data.funcionario_id,
      originalAvaliadorId: data.avaliador_id,
      fallbackFuncionarioId: data.funcionarioId,
      fallbackAvaliadorId: data.avaliadorId,
      funcionarioCheckId: funcionarioCheck?.id,
      avaliadorCheckId: avaliadorCheck?.id
    });

    if (!funcionarioId || !avaliadorId) {
      console.error('IDs de funcionário ou avaliador não fornecidos:', {
        funcionarioId,
        avaliadorId,
        data
      });
      return NextResponse.json({
        success: false,
        error: 'IDs de funcionário ou avaliador não fornecidos',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Criar avaliação usando supabaseAdmin para contornar as políticas RLS
    const { data: avaliacao, error } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .insert({
        funcionario_id: funcionarioId,
        avaliador_id: avaliadorId,
        periodo: data.periodo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: 'pendente',
        observacoes: data.observacoes || '',
        pontuacao_total: 0 // Será calculado depois com base nas pontuações dos critérios
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar avaliação:', error);
      console.error('Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return NextResponse.json({
        success: false,
        error: error.message,
        details: {
          code: error.code,
          hint: error.hint
        },
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Se houver critérios, salvar as pontuações
    if (data.criterios && data.criterios.length > 0) {
      // Verificar se os critérios existem no banco de dados
      // Primeiro, buscar todos os critérios existentes
      const { data: criteriosExistentes, error: criteriosError } = await supabaseAdmin
        .from('criterios')
        .select('id, nome')
        .is('deleted_at', null);

      if (criteriosError) {
        console.error('Erro ao buscar critérios existentes:', criteriosError);
      }

      console.log('Critérios existentes no banco:', criteriosExistentes?.length || 0);

      // Importar os critérios padrão para usar como fallback
      let criteriosPadrao: any[] = [];
      try {
        const { criteriosPadrao: criterios } = await import('@/data/criterios-avaliacao');
        criteriosPadrao = criterios;
      } catch (importError) {
        console.error('Erro ao importar critérios padrão:', importError);
      }

      // Mapear critérios para pontuações, garantindo que os IDs sejam UUIDs válidos
      const pontuacoes = data.criterios.map((criterio: any) => {
        // Verificar se o criterioId é um UUID válido
        const isUuidValid = isValidUUID(criterio.criterioId);

        let criterioIdFinal = criterio.criterioId;

        // Se não for UUID, tentar encontrar um critério correspondente no banco
        if (!isUuidValid && criteriosExistentes && criteriosExistentes.length > 0) {
          // Tentar encontrar por nome
          const criterioEncontrado = criteriosExistentes.find(c =>
            c.nome.toLowerCase() === criterio.nome?.toLowerCase()
          );

          if (criterioEncontrado) {
            criterioIdFinal = criterioEncontrado.id;
            console.log(`Critério "${criterio.nome}" encontrado no banco com ID ${criterioIdFinal}`);
          } else if (criteriosPadrao.length > 0) {
            // Se não encontrar, usar um dos critérios padrão com UUID válido
            const criterioPadrao = criteriosPadrao.find(c =>
              c.nome.toLowerCase() === criterio.nome?.toLowerCase() ||
              c.id === criterio.criterioId
            );

            if (criterioPadrao) {
              criterioIdFinal = criterioPadrao.id;
              console.log(`Usando critério padrão para "${criterio.nome}" com ID ${criterioIdFinal}`);
            } else {
              // Se ainda não encontrar, usar o primeiro critério padrão
              criterioIdFinal = criteriosPadrao[0].id;
              console.log(`Usando primeiro critério padrão para "${criterio.nome}" com ID ${criterioIdFinal}`);
            }
          } else {
            // Se não tiver critérios padrão, gerar um UUID
            criterioIdFinal = generateUUID();
            console.log(`Gerando UUID para critério "${criterio.nome}": ${criterioIdFinal}`);
          }
        }

        // Garantir que o ID final seja um UUID válido
        if (!isValidUUID(criterioIdFinal)) {
          const novoUUID = generateUUID();
          console.log(`Convertendo ID inválido "${criterioIdFinal}" para UUID "${novoUUID}"`);
          criterioIdFinal = novoUUID;
        }

        console.log('Preparando pontuação para critério:', {
          criterioId: criterioIdFinal,
          originalCriterioId: criterio.criterioId,
          nome: criterio.nome,
          nota: criterio.nota || 0,
          comentario: criterio.comentario || ''
        });

        return {
          avaliacao_id: avaliacao.id,
          criterio_id: criterioIdFinal,
          valor: criterio.nota || 0,
          observacao: criterio.comentario || ''
        };
      });

      console.log('Inserindo pontuações:', pontuacoes);

      try {
        const { error: pontuacoesError } = await supabaseAdmin
          .from('pontuacoes')
          .insert(pontuacoes);

        if (pontuacoesError) {
          console.error('Erro ao salvar pontuações:', pontuacoesError);
          console.error('Detalhes do erro:', {
            code: pontuacoesError.code,
            message: pontuacoesError.message,
            details: pontuacoesError.details,
            hint: pontuacoesError.hint
          });
          // Não falhar a requisição, apenas logar o erro
        } else {
          console.log('Pontuações salvas com sucesso!');
        }
      } catch (insertError) {
        console.error('Exceção ao salvar pontuações:', insertError);
        // Não falhar a requisição, apenas logar o erro
      }

      // Calcular pontuação total
      const pontuacaoTotal = data.criterios.reduce((total: number, criterio: any) => {
        return total + (criterio.nota || 0) * (criterio.peso || 1);
      }, 0) / data.criterios.length;

      // Atualizar a pontuação total na avaliação
      const { error: updateError } = await supabaseAdmin
        .from('avaliacoes_desempenho')
        .update({ pontuacao_total: pontuacaoTotal })
        .eq('id', avaliacao.id);

      console.log('Atualizando pontuação total:', {
        avaliacaoId: avaliacao.id,
        pontuacaoTotal,
        sucesso: !updateError,
        erro: updateError ? updateError.message : null
      });

      if (updateError) {
        console.error('Erro ao atualizar pontuação total:', updateError);
        // Não falhar a requisição, apenas logar o erro
      }
    }

    return NextResponse.json({
      success: true,
      data: avaliacao,
      message: 'Avaliação criada com sucesso',
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar avaliação:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
