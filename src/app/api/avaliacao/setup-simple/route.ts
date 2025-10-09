import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API simplificada para configurar o sistema de avaliação
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Iniciando configuração simplificada do sistema...');
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
        resultados.push(`⚠️ Pesos: ${pesoError.message}`);
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
        resultados.push(`⚠️ Comprometimento: ${comprometimentoError.message}`);
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
        resultados.push(`⚠️ Pontualidade: ${pontualidadeError.message}`);
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
        resultados.push(`⚠️ Liderança: ${liderancaError.message}`);
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
        resultados.push(`⚠️ Nova Liderança: ${novaLiderancaError.message}`);
      } else {
        resultados.push('✅ Novo critério "Liderança - Desenvolvimento da Equipe" criado');
      }

    } catch (error) {
      console.error('Erro ao atualizar critérios:', error);
      resultados.push(`❌ Erro nos critérios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 2. Verificar tabelas essenciais
    try {
      console.log('Verificando tabelas essenciais...');
      
      const tabelas = ['users_unified', 'criterios', 'avaliacoes'];
      
      for (const tabela of tabelas) {
        const { error } = await supabase
          .from(tabela)
          .select('id')
          .limit(1);

        if (error) {
          resultados.push(`❌ Tabela ${tabela}: ${error.message}`);
        } else {
          resultados.push(`✅ Tabela ${tabela}: Acessível`);
        }
      }

    } catch (error) {
      console.error('Erro ao verificar tabelas:', error);
      resultados.push(`❌ Erro nas tabelas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 3. Contar critérios
    try {
      const { data: criterios, error: criteriosError } = await supabase
        .from('criterios')
        .select('nome, peso')
        .eq('ativo', true);

      if (criteriosError) {
        resultados.push(`❌ Erro ao contar critérios: ${criteriosError.message}`);
      } else {
        resultados.push(`✅ Total de critérios ativos: ${criterios?.length || 0}`);
        
        const criteriosLideranca = criterios?.filter(c => c.nome.includes('Liderança')) || [];
        resultados.push(`✅ Critérios de liderança: ${criteriosLideranca.length}`);
        
        const pesosDiferentes = criterios?.filter(c => c.peso !== 1.0) || [];
        if (pesosDiferentes.length > 0) {
          resultados.push(`⚠️ ${pesosDiferentes.length} critérios ainda com peso diferente de 1.0`);
        } else {
          resultados.push('✅ Todos os critérios têm peso 1.0');
        }

        // Listar critérios de liderança
        if (criteriosLideranca.length > 0) {
          resultados.push('');
          resultados.push('📋 Critérios de Liderança encontrados:');
          criteriosLideranca.forEach(c => {
            resultados.push(`• ${c.nome}`);
          });
        }
      }

    } catch (error) {
      console.error('Erro ao verificar critérios:', error);
      resultados.push(`❌ Erro ao verificar critérios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    console.log('Configuração simplificada concluída!');

    return NextResponse.json({
      success: true,
      message: 'Configuração aplicada com sucesso',
      resultados,
      observacoes: [
        'Sistema configurado com as mudanças básicas',
        'Algumas tabelas avançadas podem precisar ser criadas manualmente',
        'Teste o módulo de avaliação para verificar funcionamento'
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
      .select('nome, peso, ativo')
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

      // Verificar se há comprometimento unificado
      const comprometimentoUnificado = criterios?.find(c => c.nome === 'Comprometimento e Pontualidade');
      if (comprometimentoUnificado) {
        resultados.push('✅ Comprometimento e Pontualidade unificados');
      } else {
        resultados.push('⚠️ Comprometimento e Pontualidade não unificados');
      }

      // Listar todos os critérios
      resultados.push('');
      resultados.push('📋 Critérios ativos no sistema:');
      criterios?.forEach(c => {
        resultados.push(`• ${c.nome} (peso: ${c.peso})`);
      });
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
