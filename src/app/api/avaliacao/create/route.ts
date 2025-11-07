import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { criteriosPadrao } from '@/data/criterios-avaliacao';
import { isValidUUID, generateUUID } from '@/lib/uuid-utils';

export const dynamic = 'force-dynamic';

/**
 * Rota para criar uma nova avaliação - redireciona para a API correta
 */
export async function POST(request: NextRequest) {
  try {
    console.log('API avaliacao/create: Recebendo requisição para criar avaliação');

    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      console.error('API avaliacao/create: Token não fornecido');
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.error('API avaliacao/create: Token inválido ou expirado');
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Obter dados do corpo da requisição
    const data = await request.json();
    console.log('API avaliacao/create: Dados recebidos:', JSON.stringify(data, null, 2));

    // Verificar se os campos obrigatórios estão presentes
    if (!data.funcionario_id || !data.avaliador_id || !data.periodo) {
      return NextResponse.json({
        success: false,
        error: 'Dados incompletos. Funcionário, avaliador e período são obrigatórios.'
      }, { status: 400 });
    }

    // Preparar datas
    const dataInicio = data.data_inicio || new Date().toISOString().split('T')[0];
    const dataFim = data.data_fim || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0];

    // Criar avaliação usando supabaseAdmin para contornar as políticas RLS
    const { data: avaliacao, error } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .insert({
        funcionario_id: data.funcionario_id,
        avaliador_id: data.avaliador_id,
        periodo: data.periodo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: data.status || 'pendente',
        observacoes: data.observacoes || '',
        pontuacao_total: 0 // Será calculado depois com base nas pontuações dos critérios
      })
      .select()
      .single();

    if (error) {
      console.error('API avaliacao/create: Erro ao criar avaliação:', error);
      return NextResponse.json({
        success: false,
        error: `Erro ao criar avaliação: ${error.message}`,
        details: error
      }, { status: 500 });
    }

    console.log('API avaliacao/create: Avaliação criada com sucesso:', avaliacao);

    // Se houver critérios, salvar as pontuações
    if (data.criterios && data.criterios.length > 0) {
      // Verificar se os critérios existem no banco de dados
      // Primeiro, buscar todos os critérios existentes
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
            console.log(`API avaliacao/create: Critério "${criterio.nome}" encontrado no banco com ID ${criterioIdFinal}`);
          } else {
            // Se não encontrar, usar um dos critérios padrão com UUID válido
            const criterioPadrao = criteriosPadrao.find(c =>
              c.nome.toLowerCase() === criterio.nome?.toLowerCase() ||
              c.id === criterio.criterioId
            );

            if (criterioPadrao) {
              criterioIdFinal = criterioPadrao.id;
              console.log(`API avaliacao/create: Usando critério padrão para "${criterio.nome}" com ID ${criterioIdFinal}`);
            } else {
              // Se ainda não encontrar, usar o primeiro critério padrão
              criterioIdFinal = criteriosPadrao[0].id;
              console.log(`API avaliacao/create: Usando primeiro critério padrão para "${criterio.nome}" com ID ${criterioIdFinal}`);
            }
          }
        }

        // Garantir que o ID final seja um UUID válido
        if (!isValidUUID(criterioIdFinal)) {
          const novoUUID = generateUUID();
          console.log(`API avaliacao/create: Convertendo ID inválido "${criterioIdFinal}" para UUID "${novoUUID}"`);
          criterioIdFinal = novoUUID;
        }

        return {
          avaliacao_id: avaliacao.id,
          criterio_id: criterioIdFinal,
          valor: criterio.nota || 0,
          observacao: criterio.comentario || ''
        };
      });

      console.log('API avaliacao/create: Inserindo pontuações:', pontuacoes);

      // Inserir as pontuações no banco
      const { error: pontuacoesError } = await supabaseAdmin
        .from('pontuacoes')
        .insert(pontuacoes);

      if (pontuacoesError) {
        console.error('API avaliacao/create: Erro ao salvar pontuações:', pontuacoesError);
        // Não falhar a requisição, apenas logar o erro
      } else {
        console.log('API avaliacao/create: Pontuações salvas com sucesso!');
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

      if (updateError) {
        console.error('API avaliacao/create: Erro ao atualizar pontuação total:', updateError);
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
    console.error('API avaliacao/create: Erro ao criar avaliação:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
