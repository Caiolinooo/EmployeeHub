import { NextRequest, NextResponse } from 'next/server';
import { AvaliacaoWorkflowService } from '@/lib/services/avaliacao-workflow-service';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { criteriosPadrao } from '@/data/criterios-avaliacao';
import { isValidUUID, generateUUID } from '@/lib/uuid-utils';

export const dynamic = 'force-dynamic';

/**
 * Rota para criar uma nova avaliação - redireciona para a API correta
 * Esta rota é mantida para compatibilidade com código existente
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

    // Usar o serviço de workflow para criar a avaliação
    const result = await AvaliacaoWorkflowService.createAvaliacao(data);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Erro ao criar avaliação'
      }, { status: 400 });
    }

    // Se houver critérios, salvar as pontuações
    if (data.criterios && data.criterios.length > 0 && result.data) {
      try {
        const supabaseAdmin = (await import('@/lib/supabase')).supabaseAdmin;
        
        // Verificar se os critérios existem no banco de dados
        const { data: criteriosExistentes, error: criteriosError } = await supabaseAdmin
          .from('criterios')
          .select('id, nome')
          .is('deleted_at', null);

        if (criteriosError) {
          console.error('API avaliacao/create: Erro ao buscar critérios existentes:', criteriosError);
        }

        console.log('API avaliacao/create: Critérios existentes no banco:', criteriosExistentes?.length || 0);

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
            avaliacao_id: result.data!.id,
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
          console.error('API avaliacao/create: Erro ao salvar pontuações:', pontuacoesError);
          // Não falhar a operação principal, apenas logar o erro
        }
      } catch (error) {
        console.error('API avaliacao/create: Erro ao processar pontuações:', error);
        // Não falhar a operação principal, apenas logar o erro
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Avaliação criada com sucesso'
    });

  } catch (error) {
    console.error('API avaliacao/create: Erro inesperado:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
