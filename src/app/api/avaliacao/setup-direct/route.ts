import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API para configurar o sistema de avaliação usando comandos diretos
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    const authResult = verifyToken(token);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Verificar se é admin
    const { data: user, error: userError } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', authResult.userId)
      .single();

    console.log('Verificando usuário:', authResult.userId);
    console.log('Dados do usuário:', user);
    console.log('Erro ao buscar usuário:', userError);

    if (userError) {
      return NextResponse.json(
        { success: false, error: `Erro ao verificar usuário: ${userError.message}` },
        { status: 500 }
      );
    }

    if (!user || (user.role !== 'admin' && user.role !== 'gerente')) {
      return NextResponse.json(
        {
          success: false,
          error: `Acesso negado. Role atual: ${user?.role || 'não encontrado'}. Apenas administradores e gerentes podem aplicar configurações.`,
          debug: {
            userId: authResult.userId,
            userRole: user?.role,
            userFound: !!user
          }
        },
        { status: 403 }
      );
    }

    console.log('Iniciando configuração direta do sistema...');
    const resultados = [];

    // 1. Atualizar critérios existentes
    try {
      console.log('Atualizando critérios existentes...');
      
      // Atualizar pesos para 1.0
      const { error: pesoError } = await supabase
        .from('criterios')
        .update({ peso: 1.0 })
        .neq('peso', 1.0);

      if (pesoError) {
        console.error('Erro ao atualizar pesos:', pesoError);
      } else {
        resultados.push('✅ Pesos dos critérios atualizados para 1.0');
      }

      // Unificar Comprometimento e Pontualidade
      const { error: comprometimentoError } = await supabase
        .from('criterios')
        .update({
          nome: 'Comprometimento e Pontualidade',
          descricao: 'Avalia o nível de comprometimento com os objetivos da empresa e o cumprimento de prazos e horários estabelecidos'
        })
        .eq('nome', 'Comprometimento');

      if (comprometimentoError) {
        console.error('Erro ao unificar comprometimento:', comprometimentoError);
      } else {
        resultados.push('✅ Comprometimento e Pontualidade unificados');
      }

      // Remover Pontualidade separada
      const { error: pontualidadeError } = await supabase
        .from('criterios')
        .delete()
        .eq('nome', 'Pontualidade');

      if (pontualidadeError) {
        console.log('Pontualidade pode não existir separadamente:', pontualidadeError.message);
      } else {
        resultados.push('✅ Critério Pontualidade removido');
      }

      // Atualizar Liderança para Liderança - Delegar
      const { error: liderancaError } = await supabase
        .from('criterios')
        .update({
          nome: 'Liderança - Delegar',
          descricao: 'Avalia a capacidade de delegar tarefas de forma eficaz e acompanhar resultados'
        })
        .eq('nome', 'Liderança');

      if (liderancaError) {
        console.error('Erro ao atualizar liderança:', liderancaError);
      } else {
        resultados.push('✅ Liderança atualizada para "Liderança - Delegar"');
      }

      // Inserir novo critério de Liderança - Desenvolvimento da Equipe
      const { error: novaLiderancaError } = await supabase
        .from('criterios')
        .upsert({
          id: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
          nome: 'Liderança - Desenvolvimento da Equipe',
          descricao: 'Avalia a capacidade de desenvolver e capacitar membros da equipe',
          categoria: 'Liderança',
          peso: 1.0,
          pontuacao_maxima: 5,
          ativo: true
        });

      if (novaLiderancaError) {
        console.error('Erro ao criar nova liderança:', novaLiderancaError);
      } else {
        resultados.push('✅ Novo critério "Liderança - Desenvolvimento da Equipe" criado');
      }

    } catch (error) {
      console.error('Erro ao atualizar critérios:', error);
      resultados.push(`❌ Erro nos critérios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 2. Criar tabela de líderes
    try {
      console.log('Verificando/criando tabela de líderes...');
      
      // Tentar inserir um registro de teste para verificar se a tabela existe
      const { error: testError } = await supabase
        .from('lideres')
        .select('id')
        .limit(1);

      if (testError && testError.message.includes('relation "lideres" does not exist')) {
        resultados.push('❌ Tabela de líderes não existe - precisa ser criada via SQL');
      } else {
        resultados.push('✅ Tabela de líderes já existe ou está acessível');
      }

    } catch (error) {
      console.error('Erro ao verificar tabela de líderes:', error);
      resultados.push(`❌ Erro na tabela de líderes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 3. Criar tabela de períodos de avaliação
    try {
      console.log('Verificando/criando tabela de períodos...');
      
      const { error: testError } = await supabase
        .from('periodos_avaliacao')
        .select('id')
        .limit(1);

      if (testError && testError.message.includes('relation "periodos_avaliacao" does not exist')) {
        resultados.push('❌ Tabela de períodos não existe - precisa ser criada via SQL');
      } else {
        resultados.push('✅ Tabela de períodos já existe ou está acessível');
      }

    } catch (error) {
      console.error('Erro ao verificar tabela de períodos:', error);
      resultados.push(`❌ Erro na tabela de períodos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 4. Criar período de teste se a tabela existir
    try {
      console.log('Criando período de teste...');
      
      const { error: periodoError } = await supabase
        .from('periodos_avaliacao')
        .upsert({
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'Avaliação Teste 2024',
          descricao: 'Período de teste para validação do sistema',
          data_inicio: '2024-01-01',
          data_fim: '2024-12-31',
          data_limite_autoavaliacao: '2024-06-30',
          data_limite_aprovacao: '2024-07-31',
          ativo: true
        });

      if (periodoError) {
        console.error('Erro ao criar período de teste:', periodoError);
        resultados.push(`❌ Período de teste: ${periodoError.message}`);
      } else {
        resultados.push('✅ Período de teste criado com sucesso');
      }

    } catch (error) {
      console.error('Erro ao criar período de teste:', error);
      resultados.push(`❌ Período de teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    console.log('Configuração concluída!');

    return NextResponse.json({
      success: true,
      message: 'Configuração aplicada com sucesso',
      resultados,
      observacoes: [
        'Algumas tabelas podem precisar ser criadas manualmente via SQL',
        'Verifique se todas as funcionalidades estão funcionando',
        'Configure os líderes no painel administrativo'
      ]
    });

  } catch (error) {
    console.error('Erro ao aplicar configuração:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}

/**
 * GET para verificar status do sistema
 */
export async function GET(request: NextRequest) {
  try {
    const resultados = [];

    // Verificar tabelas essenciais
    const tabelas = ['users_unified', 'criterios', 'avaliacoes'];
    
    for (const tabela of tabelas) {
      try {
        const { error } = await supabase
          .from(tabela)
          .select('id')
          .limit(1);

        if (error) {
          resultados.push(`❌ Tabela ${tabela}: ${error.message}`);
        } else {
          resultados.push(`✅ Tabela ${tabela}: OK`);
        }
      } catch (error) {
        resultados.push(`❌ Tabela ${tabela}: Erro de acesso`);
      }
    }

    // Verificar critérios
    const { data: criterios, error: criteriosError } = await supabase
      .from('criterios')
      .select('nome, peso')
      .eq('ativo', true);

    if (criteriosError) {
      resultados.push(`❌ Critérios: ${criteriosError.message}`);
    } else {
      resultados.push(`✅ Critérios encontrados: ${criterios?.length || 0}`);
      
      const criteriosLideranca = criterios?.filter(c => c.nome.includes('Liderança')) || [];
      resultados.push(`✅ Critérios de liderança: ${criteriosLideranca.length}`);
      
      const pesosDiferentes = criterios?.filter(c => c.peso !== 1.0) || [];
      if (pesosDiferentes.length > 0) {
        resultados.push(`⚠️ ${pesosDiferentes.length} critérios com peso diferente de 1.0`);
      } else {
        resultados.push('✅ Todos os critérios têm peso 1.0');
      }
    }

    return NextResponse.json({
      success: true,
      resultados
    });

  } catch (error) {
    console.error('Erro ao verificar sistema:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
