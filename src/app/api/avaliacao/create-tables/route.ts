import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Não autorizado'
      }, { status: 401 });
    }

    // Obter configurações do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Configurações do Supabase não encontradas'
      }, { status: 500 });
    }

    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SQL para criar as tabelas
    const createFuncionariosSQL = `
      CREATE TABLE IF NOT EXISTS funcionarios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome TEXT NOT NULL,
        cargo TEXT,
        departamento TEXT,
        data_admissao DATE,
        email TEXT,
        matricula TEXT,
        status TEXT NOT NULL DEFAULT 'ativo',
        user_id UUID,
        deleted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;

    const createAvaliacoesSQL = `
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        funcionario_id UUID NOT NULL,
        avaliador_id UUID NOT NULL,
        periodo TEXT NOT NULL,
        data_inicio DATE DEFAULT CURRENT_DATE,
        data_fim DATE DEFAULT (CURRENT_DATE + INTERVAL '3 months'),
        status TEXT NOT NULL DEFAULT 'pending',
        pontuacao_total FLOAT DEFAULT 0,
        observacoes TEXT,
        deleted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Executar SQL para criar as tabelas
    const results: Record<string, any> = {};

    // Criar tabela funcionarios
    try {
      const { error: funcionariosError } = await supabase.rpc('execute_sql', {
        sql: createFuncionariosSQL
      });

      if (funcionariosError) {
        results['funcionarios'] = {
          success: false,
          error: funcionariosError.message
        };
      } else {
        results['funcionarios'] = {
          success: true
        };
      }
    } catch (err) {
      results['funcionarios'] = {
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido'
      };
    }

    // Criar tabela avaliacoes
    try {
      const { error: avaliacoesError } = await supabase.rpc('execute_sql', {
        sql: createAvaliacoesSQL
      });

      if (avaliacoesError) {
        results['avaliacoes'] = {
          success: false,
          error: avaliacoesError.message
        };
      } else {
        results['avaliacoes'] = {
          success: true
        };
      }
    } catch (err) {
      results['avaliacoes'] = {
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido'
      };
    }

    return NextResponse.json({
      success: true,
      results
    });
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
    
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
