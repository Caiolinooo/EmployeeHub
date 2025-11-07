import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to set up all necessary tables for the evaluation system
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    console.log('Setting up evaluation tables...');
    const results: Record<string, any> = {};

    // 1. Create criterios table if it doesn't exist
    const createCriteriosSQL = `
      CREATE TABLE IF NOT EXISTS criterios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome TEXT NOT NULL,
        descricao TEXT NOT NULL,
        categoria TEXT NOT NULL,
        peso FLOAT NOT NULL DEFAULT 1.0,
        pontuacao_maxima INTEGER NOT NULL DEFAULT 5,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;

    try {
      const { error: criteriosError } = await supabaseAdmin.rpc('execute_sql', {
        sql: createCriteriosSQL
      });

      if (criteriosError) {
        console.error('Error creating criterios table:', criteriosError);
        results['criterios'] = {
          success: false,
          error: criteriosError.message
        };
      } else {
        console.log('Criterios table created or already exists');
        results['criterios'] = {
          success: true
        };
      }
    } catch (err) {
      console.error('Exception creating criterios table:', err);
      results['criterios'] = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    // 2. Create avaliacoes table if it doesn't exist
    const createAvaliacoesSQL = `
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        funcionario_id UUID NOT NULL,
        avaliador_id UUID NOT NULL,
        periodo TEXT NOT NULL,
        data_inicio DATE DEFAULT CURRENT_DATE,
        data_fim DATE DEFAULT (CURRENT_DATE + INTERVAL '3 months'),
        status TEXT NOT NULL DEFAULT 'pendente',
        pontuacao_total FLOAT DEFAULT 0,
        observacoes TEXT,
        deleted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;

    try {
      const { error: avaliacoesError } = await supabaseAdmin.rpc('execute_sql', {
        sql: createAvaliacoesSQL
      });

      if (avaliacoesError) {
        console.error('Error creating avaliacoes table:', avaliacoesError);
        results['avaliacoes'] = {
          success: false,
          error: avaliacoesError.message
        };
      } else {
        console.log('Avaliacoes table created or already exists');
        results['avaliacoes'] = {
          success: true
        };
      }
    } catch (err) {
      console.error('Exception creating avaliacoes table:', err);
      results['avaliacoes'] = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    // 3. Create pontuacoes table if it doesn't exist
    const createPontuacoesSQL = `
      CREATE TABLE IF NOT EXISTS pontuacoes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        avaliacao_id UUID NOT NULL REFERENCES avaliacoes(id),
        criterio_id UUID NOT NULL REFERENCES criterios(id),
        valor FLOAT NOT NULL CHECK (valor >= 0),
        observacao TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(avaliacao_id, criterio_id)
      );
    `;

    try {
      const { error: pontuacoesError } = await supabaseAdmin.rpc('execute_sql', {
        sql: createPontuacoesSQL
      });

      if (pontuacoesError) {
        console.error('Error creating pontuacoes table:', pontuacoesError);
        results['pontuacoes'] = {
          success: false,
          error: pontuacoesError.message
        };
      } else {
        console.log('Pontuacoes table created or already exists');
        results['pontuacoes'] = {
          success: true
        };
      }
    } catch (err) {
      console.error('Exception creating pontuacoes table:', err);
      results['pontuacoes'] = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    // 4. Create view for avaliacoes if it doesn't exist
    const createViewSQL = `
      CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
      SELECT 
        a.id,
        a.funcionario_id,
        a.avaliador_id,
        a.periodo,
        a.data_inicio,
        a.data_fim,
        a.status,
        a.pontuacao_total,
        a.observacoes,
        a.created_at,
        a.updated_at,
        f_func.nome AS funcionario_nome,
        f_func.cargo AS funcionario_cargo,
        f_func.departamento AS funcionario_departamento,
        f_aval.nome AS avaliador_nome,
        f_aval.cargo AS avaliador_cargo
      FROM 
        avaliacoes a
        LEFT JOIN funcionarios f_func ON a.funcionario_id = f_func.id
        LEFT JOIN funcionarios f_aval ON a.avaliador_id = f_aval.id
      WHERE 
        a.deleted_at IS NULL;
    `;

    try {
      const { error: viewError } = await supabaseAdmin.rpc('execute_sql', {
        sql: createViewSQL
      });

      if (viewError) {
        console.error('Error creating view:', viewError);
        results['view'] = {
          success: false,
          error: viewError.message
        };
      } else {
        console.log('View created or replaced successfully');
        results['view'] = {
          success: true
        };
      }
    } catch (err) {
      console.error('Exception creating view:', err);
      results['view'] = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Tables setup completed'
    });
  } catch (error) {
    console.error('Error setting up tables:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * API endpoint to check if all necessary tables exist
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    console.log('Checking evaluation tables...');
    const checkResults: Record<string, any> = {};

    // Check criterios table
    try {
      const { data: criterios, error: criteriosError } = await supabaseAdmin
        .from('criterios')
        .select('id')
        .limit(1);

      if (criteriosError) {
        checkResults['criterios'] = {
          exists: false,
          error: criteriosError.message
        };
      } else {
        const { count, error: countError } = await supabaseAdmin
          .from('criterios')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null);

        checkResults['criterios'] = {
          exists: true,
          count: count || 0
        };
      }
    } catch (err) {
      checkResults['criterios'] = {
        exists: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    // Check avaliacoes table
    try {
      const { data: avaliacoes, error: avaliacoesError } = await supabaseAdmin
        .from('avaliacoes')
        .select('id')
        .limit(1);

      if (avaliacoesError) {
        checkResults['avaliacoes'] = {
          exists: false,
          error: avaliacoesError.message
        };
      } else {
        const { count, error: countError } = await supabaseAdmin
          .from('avaliacoes')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null);

        checkResults['avaliacoes'] = {
          exists: true,
          count: count || 0
        };
      }
    } catch (err) {
      checkResults['avaliacoes'] = {
        exists: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    // Check pontuacoes table
    try {
      const { data: pontuacoes, error: pontuacoesError } = await supabaseAdmin
        .from('pontuacoes')
        .select('id')
        .limit(1);

      if (pontuacoesError) {
        checkResults['pontuacoes'] = {
          exists: false,
          error: pontuacoesError.message
        };
      } else {
        const { count, error: countError } = await supabaseAdmin
          .from('pontuacoes')
          .select('id', { count: 'exact', head: true });

        checkResults['pontuacoes'] = {
          exists: true,
          count: count || 0
        };
      }
    } catch (err) {
      checkResults['pontuacoes'] = {
        exists: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }

    return NextResponse.json({
      success: true,
      tables: checkResults
    });
  } catch (error) {
    console.error('Error checking tables:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
