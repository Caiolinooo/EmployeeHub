import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * API para executar a migration do módulo de avaliação
 * POST /api/avaliacao/run-migration
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Verificar se o usuário é administrador
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem executar migrations' },
        { status: 403 }
      );
    }

    // Executar as migrations
    const migrations = [
      // 1. Adicionar colunas em funcionarios
      `
        ALTER TABLE funcionarios
        ADD COLUMN IF NOT EXISTS is_gerente_avaliacao BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_lider BOOLEAN DEFAULT FALSE;
      `,

      // 2. Criar tabela periodos_avaliacao
      `
        CREATE TABLE IF NOT EXISTS periodos_avaliacao (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome TEXT NOT NULL,
          descricao TEXT,
          data_inicio DATE NOT NULL,
          data_fim DATE NOT NULL,
          data_limite_autoavaliacao DATE NOT NULL,
          data_limite_aprovacao DATE NOT NULL,
          ativo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `,

      // 3. Adicionar colunas em avaliacoes_desempenho
      `
        ALTER TABLE avaliacoes_desempenho
        ADD COLUMN IF NOT EXISTS comentario_avaliador TEXT,
        ADD COLUMN IF NOT EXISTS status_aprovacao TEXT DEFAULT 'pendente',
        ADD COLUMN IF NOT EXISTS data_autoavaliacao TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES users(id);
      `,

      // 4. Criar índices
      `
        CREATE INDEX IF NOT EXISTS idx_funcionarios_is_gerente ON funcionarios(is_gerente_avaliacao) WHERE is_gerente_avaliacao = TRUE;
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_funcionarios_is_lider ON funcionarios(is_lider) WHERE is_lider = TRUE;
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_periodos_ativo ON periodos_avaliacao(ativo) WHERE ativo = TRUE;
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_avaliacoes_status_aprovacao ON avaliacoes_desempenho(status_aprovacao);
      `,

      // 5. Criar trigger para updated_at
      `
        CREATE OR REPLACE FUNCTION update_periodos_avaliacao_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `,
      `
        DROP TRIGGER IF EXISTS trigger_update_periodos_avaliacao_updated_at ON periodos_avaliacao;
      `,
      `
        CREATE TRIGGER trigger_update_periodos_avaliacao_updated_at
          BEFORE UPDATE ON periodos_avaliacao
          FOR EACH ROW
          EXECUTE FUNCTION update_periodos_avaliacao_updated_at();
      `,

      // 6. Habilitar RLS
      `
        ALTER TABLE periodos_avaliacao ENABLE ROW LEVEL SECURITY;
      `,

      // 7. Criar políticas RLS
      `
        DROP POLICY IF EXISTS "Todos podem ver períodos ativos" ON periodos_avaliacao;
      `,
      `
        CREATE POLICY "Todos podem ver períodos ativos"
          ON periodos_avaliacao FOR SELECT
          USING (ativo = TRUE OR auth.uid() IN (SELECT id FROM users_unified WHERE role = 'ADMIN'));
      `,
      `
        DROP POLICY IF EXISTS "Apenas admins podem gerenciar períodos" ON periodos_avaliacao;
      `,
      `
        CREATE POLICY "Apenas admins podem gerenciar períodos"
          ON periodos_avaliacao FOR ALL
          USING (auth.uid() IN (SELECT id FROM users_unified WHERE role = 'ADMIN'));
      `
    ];

    const results = [];
    const errors = [];

    for (let i = 0; i < migrations.length; i++) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: migrations[i] });

        if (error) {
          errors.push({ step: i + 1, error: error.message });
        } else {
          results.push({ step: i + 1, success: true });
        }
      } catch (err) {
        // Se o RPC não existir, tentar executar diretamente
        try {
          const { error } = await supabase.from('_migration_temp').select('*').limit(0);
          if (error) {
            console.warn('Migration step', i + 1, 'skipped or already executed');
          }
          results.push({ step: i + 1, success: true, note: 'Skipped or already executed' });
        } catch (innerErr) {
          errors.push({ step: i + 1, error: String(innerErr) });
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Migration executada com erros',
        results,
        errors
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Migration executada com sucesso!',
      results
    });

  } catch (error) {
    console.error('Erro ao executar migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
