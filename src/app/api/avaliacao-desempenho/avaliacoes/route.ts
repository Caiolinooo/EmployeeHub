import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { isValidUUID, generateUUID } from '@/lib/uuid-utils';

export const dynamic = 'force-dynamic';

/**
 * Rota para listar avaliações
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token de autenticação necessário'
      }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Buscar avaliações (usando supabaseAdmin para bypass de RLS)
    const { data: avaliacoes, error } = await supabaseAdmin
      .from('vw_avaliacoes_desempenho')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avaliações:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar avaliações',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: avaliacoes || []
    });

  } catch (error) {
    console.error('Erro inesperado ao buscar avaliações:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

/**
 * Rota para criar uma nova avaliação
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token de autenticação necessário'
      }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    // Obter dados do corpo da requisição
    const data = await request.json();

    // Validar campos obrigatórios
    const requiredFields = ['funcionario_id', 'avaliador_id', 'periodo'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Campos obrigatórios não fornecidos',
        missingFields
      }, { status: 400 });
    }

    // Validar formato dos IDs
    if (!isValidUUID(data.funcionario_id)) {
      return NextResponse.json({
        success: false,
        error: 'ID do funcionário inválido'
      }, { status: 400 });
    }

    if (!isValidUUID(data.avaliador_id)) {
      return NextResponse.json({
        success: false,
        error: 'ID do avaliador inválido'
      }, { status: 400 });
    }

    // Verificar se o funcionário existe (usando supabaseAdmin para bypass de RLS)
    const { data: funcionario, error: funcionarioError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, active')
      .eq('id', data.funcionario_id)
      .single();

    if (funcionarioError || !funcionario) {
      return NextResponse.json({
        success: false,
        error: 'Funcionário não encontrado'
      }, { status: 404 });
    }

    if (!funcionario.active) {
      return NextResponse.json({
        success: false,
        error: 'Funcionário inativo'
      }, { status: 400 });
    }

    // Verificar se o avaliador existe (usando supabaseAdmin para bypass de RLS)
    const { data: avaliador, error: avaliadorError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, active')
      .eq('id', data.avaliador_id)
      .single();

    if (avaliadorError || !avaliador) {
      return NextResponse.json({
        success: false,
        error: 'Avaliador não encontrado'
      }, { status: 404 });
    }

    if (!avaliador.active) {
      return NextResponse.json({
        success: false,
        error: 'Avaliador inativo'
      }, { status: 400 });
    }

    // Verificar se já existe uma avaliação para este funcionário no mesmo período
    const { data: avaliacaoExistente, error: checkError } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('id')
      .eq('funcionario_id', data.funcionario_id)
      .eq('periodo', data.periodo)
      .single();

    if (avaliacaoExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma avaliação para este funcionário neste período'
      }, { status: 409 });
    }

    // Preparar datas
    const funcionarioId = data.funcionario_id;
    const avaliadorId = data.avaliador_id;
    const dataInicio = data.data_inicio || new Date().toISOString().split('T')[0];
    const dataFim = data.data_fim || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0];

    // Criar avaliação usando supabaseAdmin para contornar as políticas RLS
    // Adicionando tratamento específico para violações de RLS
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

      // Tratamento específico para violações de RLS
      if (error.code === '42501') {
        return NextResponse.json({
          success: false,
          error: 'Erro de permissão: Violação de política de segurança (RLS)',
          details: {
            code: error.code,
            message: 'A operação foi bloqueada por uma política de segurança de nível de linha (RLS)',
            hint: 'Verifique se o usuário tem permissão para inserir registros nesta tabela ou use uma conta com privilégios elevados'
          },
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }

      // Tratamento para violação de chave estrangeira
      if (error.code === '23503') {
        return NextResponse.json({
          success: false,
          error: 'Erro de integridade: Funcionário ou avaliador inválido',
          details: {
            code: error.code,
            message: 'Verifique se os IDs de funcionário e avaliador são válidos e existem no banco de dados'
          },
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }

      // Tratamento para violação de restrição única
      if (error.code === '23505') {
        return NextResponse.json({
          success: false,
          error: 'Conflito: Avaliação duplicada',
          details: {
            code: error.code,
            message: 'Já existe uma avaliação com estes mesmos dados'
          },
          timestamp: new Date().toISOString()
        }, { status: 409 });
      }

      // Erro genérico do banco de dados
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar avaliação no banco de dados',
        details: {
          code: error.code,
          message: error.message,
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
          } else {
            // Se não encontrar no banco, tentar nos critérios padrão
            const criterioPadrao = criteriosPadrao.find(c =>
              c.nome.toLowerCase() === criterio.nome?.toLowerCase()
            );

            if (criterioPadrao) {
              criterioIdFinal = criterioPadrao.id;
            }
          }
        }

        return {
          id: generateUUID(),
          avaliacao_id: avaliacao.id,
          criterio_id: criterioIdFinal,
          pontuacao: criterio.pontuacao || 0,
          comentario: criterio.comentario || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      // Inserir as pontuações
      const { error: pontuacoesError } = await supabaseAdmin
        .from('pontuacoes_avaliacao')
        .insert(pontuacoes);

      if (pontuacoesError) {
        console.error('Erro ao salvar pontuações:', pontuacoesError);
        // Não falhar a operação principal, apenas logar o erro
      }
    }

    return NextResponse.json({
      success: true,
      data: avaliacao,
      message: 'Avaliação criada com sucesso'
    });

  } catch (error) {
    console.error('Erro inesperado ao criar avaliação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
