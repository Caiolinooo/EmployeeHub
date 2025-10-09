import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API para criar todas as tabelas necessárias do sistema
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Iniciando criação de tabelas...');
    const resultados = [];

    // 1. Verificar e criar tabela users_unified
    try {
      console.log('Verificando tabela users_unified...');
      
      const { data: existingUsers, error: checkError } = await supabase
        .from('users_unified')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === 'PGRST116') {
        // Tabela não existe, criar
        console.log('Criando tabela users_unified...');
        
        const createUsersQuery = `
          CREATE TABLE IF NOT EXISTS users_unified (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(20),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            cpf VARCHAR(14),
            role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'gerente', 'user')),
            password_hash VARCHAR(255),
            profile_data JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;

        const { error: createError } = await supabase.rpc('exec_sql', {
          sql_query: createUsersQuery
        });

        if (createError) {
          resultados.push(`❌ Erro ao criar users_unified: ${createError.message}`);
        } else {
          resultados.push('✅ Tabela users_unified criada com sucesso');
        }
      } else {
        resultados.push('✅ Tabela users_unified já existe');
      }
    } catch (error) {
      console.error('Erro ao verificar users_unified:', error);
      resultados.push(`❌ Erro ao verificar users_unified: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 2. Verificar e criar tabela criterios
    try {
      console.log('Verificando tabela criterios...');
      
      const { data: existingCriterios, error: checkError } = await supabase
        .from('criterios')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === 'PGRST116') {
        // Tabela não existe, criar
        console.log('Criando tabela criterios...');
        
        const createCriteriosQuery = `
          CREATE TABLE IF NOT EXISTS criterios (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            nome VARCHAR(100) NOT NULL,
            descricao TEXT,
            categoria VARCHAR(50),
            peso DECIMAL(3,2) DEFAULT 1.0,
            pontuacao_maxima INTEGER DEFAULT 5,
            ativo BOOLEAN DEFAULT TRUE,
            apenas_lideres BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;

        const { error: createError } = await supabase.rpc('exec_sql', {
          sql_query: createCriteriosQuery
        });

        if (createError) {
          resultados.push(`❌ Erro ao criar criterios: ${createError.message}`);
        } else {
          resultados.push('✅ Tabela criterios criada com sucesso');
          
          // Inserir critérios padrão
          const criteriosPadrao = [
            {
              id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
              nome: 'Comprometimento e Pontualidade',
              descricao: 'Avalia o nível de comprometimento com os objetivos da empresa e o cumprimento de prazos e horários estabelecidos',
              categoria: 'Comportamental',
              peso: 1.0,
              pontuacao_maxima: 5,
              ativo: true,
              apenas_lideres: false
            },
            {
              id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
              nome: 'Qualidade do Trabalho',
              descricao: 'Avalia a qualidade e precisão do trabalho executado',
              categoria: 'Técnica',
              peso: 1.0,
              pontuacao_maxima: 5,
              ativo: true,
              apenas_lideres: false
            },
            {
              id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
              nome: 'Liderança - Delegar',
              descricao: 'Avalia a capacidade de delegar tarefas de forma eficaz e acompanhar resultados',
              categoria: 'Liderança',
              peso: 1.0,
              pontuacao_maxima: 5,
              ativo: true,
              apenas_lideres: true
            },
            {
              id: '4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
              nome: 'Liderança - Desenvolvimento da Equipe',
              descricao: 'Avalia a capacidade de desenvolver e capacitar membros da equipe',
              categoria: 'Liderança',
              peso: 1.0,
              pontuacao_maxima: 5,
              ativo: true,
              apenas_lideres: true
            }
          ];

          for (const criterio of criteriosPadrao) {
            const { error: insertError } = await supabase
              .from('criterios')
              .upsert(criterio);

            if (insertError) {
              console.error(`Erro ao inserir critério ${criterio.nome}:`, insertError);
            }
          }
          
          resultados.push('✅ Critérios padrão inseridos');
        }
      } else {
        resultados.push('✅ Tabela criterios já existe');
      }
    } catch (error) {
      console.error('Erro ao verificar criterios:', error);
      resultados.push(`❌ Erro ao verificar criterios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 3. Verificar e criar tabela avaliacoes
    try {
      console.log('Verificando tabela avaliacoes...');
      
      const { data: existingAvaliacoes, error: checkError } = await supabase
        .from('avaliacoes')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === 'PGRST116') {
        // Tabela não existe, criar
        console.log('Criando tabela avaliacoes...');
        
        const createAvaliacoesQuery = `
          CREATE TABLE IF NOT EXISTS avaliacoes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            funcionario_id UUID NOT NULL REFERENCES users_unified(id),
            avaliador_id UUID REFERENCES users_unified(id),
            periodo_avaliacao_id UUID,
            etapa_atual VARCHAR(50) DEFAULT 'autoavaliacao' 
              CHECK (etapa_atual IN ('autoavaliacao', 'aguardando_gerente', 'em_aprovacao', 'finalizada', 'cancelada')),
            data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
            data_fim DATE,
            data_autoavaliacao TIMESTAMP WITH TIME ZONE,
            comentarios_gerente TEXT,
            pontuacao_total DECIMAL(5,2),
            status VARCHAR(20) DEFAULT 'em_andamento' 
              CHECK (status IN ('em_andamento', 'concluida', 'cancelada')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;

        const { error: createError } = await supabase.rpc('exec_sql', {
          sql_query: createAvaliacoesQuery
        });

        if (createError) {
          resultados.push(`❌ Erro ao criar avaliacoes: ${createError.message}`);
        } else {
          resultados.push('✅ Tabela avaliacoes criada com sucesso');
        }
      } else {
        resultados.push('✅ Tabela avaliacoes já existe');
      }
    } catch (error) {
      console.error('Erro ao verificar avaliacoes:', error);
      resultados.push(`❌ Erro ao verificar avaliacoes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 4. Criar outras tabelas necessárias
    const tabelasAdicionais = [
      {
        nome: 'periodos_avaliacao',
        query: `
          CREATE TABLE IF NOT EXISTS periodos_avaliacao (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            nome VARCHAR(100) NOT NULL,
            descricao TEXT,
            data_inicio DATE NOT NULL,
            data_fim DATE NOT NULL,
            data_limite_autoavaliacao DATE NOT NULL,
            data_limite_aprovacao DATE NOT NULL,
            ativo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        nome: 'autoavaliacoes',
        query: `
          CREATE TABLE IF NOT EXISTS autoavaliacoes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            avaliacao_id UUID NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
            funcionario_id UUID NOT NULL REFERENCES users_unified(id),
            questao_11_pontos_fortes TEXT,
            questao_12_areas_melhoria TEXT,
            questao_13_objetivos_alcancados TEXT,
            questao_14_planos_desenvolvimento TEXT,
            autoavaliacao_criterios JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(avaliacao_id)
          );
        `
      },
      {
        nome: 'lideres',
        query: `
          CREATE TABLE IF NOT EXISTS lideres (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
            cargo_lideranca VARCHAR(100) NOT NULL,
            departamento VARCHAR(100),
            data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
            data_fim DATE,
            ativo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        nome: 'historico_avaliacao',
        query: `
          CREATE TABLE IF NOT EXISTS historico_avaliacao (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            avaliacao_id UUID NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
            etapa_anterior VARCHAR(50),
            etapa_nova VARCHAR(50),
            usuario_id UUID REFERENCES users_unified(id),
            observacoes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      }
    ];

    for (const tabela of tabelasAdicionais) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: tabela.query
        });

        if (error) {
          resultados.push(`❌ Erro ao criar ${tabela.nome}: ${error.message}`);
        } else {
          resultados.push(`✅ Tabela ${tabela.nome} criada com sucesso`);
        }
      } catch (error) {
        resultados.push(`❌ Erro ao criar ${tabela.nome}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    console.log('Criação de tabelas concluída!');

    return NextResponse.json({
      success: true,
      message: 'Tabelas criadas com sucesso',
      resultados
    });

  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
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
 * GET para verificar status das tabelas
 */
export async function GET(request: NextRequest) {
  try {
    const resultados = [];
    const tabelas = ['users_unified', 'criterios', 'avaliacoes', 'periodos_avaliacao', 'autoavaliacoes', 'lideres', 'historico_avaliacao'];
    
    for (const tabela of tabelas) {
      try {
        const { error } = await supabase
          .from(tabela)
          .select('id')
          .limit(1);

        if (error) {
          if (error.code === 'PGRST116') {
            resultados.push(`❌ Tabela ${tabela}: Não existe`);
          } else {
            resultados.push(`❌ Tabela ${tabela}: ${error.message}`);
          }
        } else {
          resultados.push(`✅ Tabela ${tabela}: OK`);
        }
      } catch (error) {
        resultados.push(`❌ Tabela ${tabela}: Erro de acesso`);
      }
    }

    return NextResponse.json({
      success: true,
      resultados
    });

  } catch (error) {
    console.error('Erro ao verificar tabelas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
