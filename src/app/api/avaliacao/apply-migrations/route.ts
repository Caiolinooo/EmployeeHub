import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API para aplicar migrações do sistema de avaliação
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
    const { data: user } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', authResult.userId)
      .single();

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acesso negado. Apenas administradores podem aplicar migrações.' },
        { status: 403 }
      );
    }

    console.log('Iniciando aplicação das migrações...');
    const resultados = [];

    // Migração 1: Adicionar coluna apenas_lideres
    try {
      console.log('Aplicando migração 1: Adicionar coluna apenas_lideres...');
      
      // Adicionar coluna apenas_lideres
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE criterios ADD COLUMN IF NOT EXISTS apenas_lideres BOOLEAN DEFAULT FALSE;'
      });

      if (alterError) {
        console.log('Coluna apenas_lideres pode já existir:', alterError.message);
      }

      // Atualizar pesos para 1.0
      await supabase.rpc('exec_sql', {
        sql_query: 'UPDATE criterios SET peso = 1.0 WHERE peso != 1.0;'
      });

      // Unificar Comprometimento e Pontualidade
      await supabase.rpc('exec_sql', {
        sql_query: `UPDATE criterios 
                    SET nome = 'Comprometimento e Pontualidade',
                        descricao = 'Avalia o nível de comprometimento com os objetivos da empresa e o cumprimento de prazos e horários estabelecidos'
                    WHERE nome = 'Comprometimento';`
      });

      // Remover Pontualidade separada
      await supabase.rpc('exec_sql', {
        sql_query: "DELETE FROM criterios WHERE nome = 'Pontualidade';"
      });

      // Atualizar Liderança para Liderança - Delegar
      await supabase.rpc('exec_sql', {
        sql_query: `UPDATE criterios 
                    SET nome = 'Liderança - Delegar',
                        descricao = 'Avalia a capacidade de delegar tarefas de forma eficaz e acompanhar resultados',
                        apenas_lideres = TRUE
                    WHERE nome = 'Liderança';`
      });

      // Inserir novo critério de Liderança - Desenvolvimento da Equipe
      await supabase.rpc('exec_sql', {
        sql_query: `INSERT INTO criterios (id, nome, descricao, categoria, peso, pontuacao_maxima, ativo, apenas_lideres)
                    VALUES (
                      '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
                      'Liderança - Desenvolvimento da Equipe',
                      'Avalia a capacidade de desenvolver e capacitar membros da equipe',
                      'Liderança',
                      1.0,
                      5,
                      TRUE,
                      TRUE
                    ) ON CONFLICT (id) DO NOTHING;`
      });

      resultados.push('✅ Migração 1: Critérios atualizados com sucesso');
    } catch (error) {
      console.error('Erro na migração 1:', error);
      resultados.push(`❌ Migração 1: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // Migração 2: Criar tabela de líderes
    try {
      console.log('Aplicando migração 2: Criar tabela de líderes...');
      
      await supabase.rpc('exec_sql', {
        sql_query: `CREATE TABLE IF NOT EXISTS lideres (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
          cargo_lideranca VARCHAR(100) NOT NULL,
          departamento VARCHAR(100),
          data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
          data_fim DATE,
          ativo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
      });

      // Criar índices
      await supabase.rpc('exec_sql', {
        sql_query: 'CREATE INDEX IF NOT EXISTS idx_lideres_user_id ON lideres(user_id);'
      });

      await supabase.rpc('exec_sql', {
        sql_query: 'CREATE INDEX IF NOT EXISTS idx_lideres_ativo ON lideres(ativo);'
      });

      resultados.push('✅ Migração 2: Tabela de líderes criada com sucesso');
    } catch (error) {
      console.error('Erro na migração 2:', error);
      resultados.push(`❌ Migração 2: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // Migração 3: Criar tabelas do novo workflow
    try {
      console.log('Aplicando migração 3: Criar tabelas do workflow...');
      
      // Tabela de períodos de avaliação
      await supabase.rpc('exec_sql', {
        sql_query: `CREATE TABLE IF NOT EXISTS periodos_avaliacao (
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
        );`
      });

      // Adicionar colunas à tabela avaliacoes
      await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS periodo_avaliacao_id UUID;'
      });

      await supabase.rpc('exec_sql', {
        sql_query: `ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS etapa_atual VARCHAR(50) DEFAULT 'autoavaliacao' 
                    CHECK (etapa_atual IN ('autoavaliacao', 'aguardando_gerente', 'em_aprovacao', 'finalizada', 'cancelada'));`
      });

      await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS data_autoavaliacao TIMESTAMP WITH TIME ZONE;'
      });

      await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS comentarios_gerente TEXT;'
      });

      // Tabela de autoavaliações
      await supabase.rpc('exec_sql', {
        sql_query: `CREATE TABLE IF NOT EXISTS autoavaliacoes (
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
        );`
      });

      resultados.push('✅ Migração 3: Tabelas do workflow criadas com sucesso');
    } catch (error) {
      console.error('Erro na migração 3:', error);
      resultados.push(`❌ Migração 3: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // Criar período de teste
    try {
      console.log('Criando período de avaliação de teste...');
      
      await supabase.rpc('exec_sql', {
        sql_query: `INSERT INTO periodos_avaliacao (id, nome, descricao, data_inicio, data_fim, data_limite_autoavaliacao, data_limite_aprovacao, ativo)
                    VALUES (
                      '550e8400-e29b-41d4-a716-446655440000',
                      'Avaliação Teste 2024',
                      'Período de teste para validação do sistema',
                      '2024-01-01',
                      '2024-12-31',
                      '2024-06-30',
                      '2024-07-31',
                      TRUE
                    ) ON CONFLICT (id) DO NOTHING;`
      });

      resultados.push('✅ Período de teste criado com sucesso');
    } catch (error) {
      console.error('Erro ao criar período de teste:', error);
      resultados.push(`❌ Período de teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    console.log('Migrações concluídas!');

    return NextResponse.json({
      success: true,
      message: 'Migrações aplicadas com sucesso',
      resultados
    });

  } catch (error) {
    console.error('Erro ao aplicar migrações:', error);
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
