import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

/**
 * API para executar a migration do módulo de avaliação
 * POST /api/avaliacao/run-migration
 */
export async function POST(request: NextRequest) {
  try {
    // Verificação simplificada e direta de admin
    const authHeader = request.headers.get('authorization');
    console.log('=== DEBUG RUN-MIGRATION ===');
    console.log('Authorization header present:', !!authHeader);

    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação não fornecido' },
        { status: 401 }
      );
    }

    // Extrair e verificar token
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    console.log('Token verified for user:', payload.userId);

    // Verificar se o usuário é admin diretamente no Supabase
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      console.log('User not found:', userError);
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 403 }
      );
    }

    // Verificar se é admin (role ADMIN ou email/telefone do admin principal)
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isAdmin = user.role === 'ADMIN' || user.email === adminEmail || user.phone_number === adminPhone;

    console.log('User role:', user.role, '| Is admin:', isAdmin);

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Apenas administradores podem executar migrations',
          debug: { role: user.role, email: user.email }
        },
        { status: 403 }
      );
    }

    console.log('Admin check passed, proceeding with migration');

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
    let needsManualExecution = false;

    // Executar migrations via SQL direto usando a REST API do Supabase
    for (let i = 0; i < migrations.length; i++) {
      try {
        console.log(`Executing migration step ${i + 1}/${migrations.length}`);

        // Tentar primeiro via RPC se existir
        const { error } = await supabaseAdmin.rpc('execute_sql', { sql: migrations[i] });

        if (error) {
          console.warn(`Step ${i + 1} via RPC failed:`, error.message);

          // Verificar se a função execute_sql não existe
          if (error.message.includes('Could not find the function') ||
              error.message.includes('function') && error.message.includes('does not exist')) {
            console.log(`Step ${i + 1}: execute_sql function not available, will require manual execution`);
            needsManualExecution = true;
            results.push({
              step: i + 1,
              success: true,
              note: 'Requires manual execution - execute_sql function not available'
            });
          }
          // Continuar mesmo com erro, pois pode ser porque já existe
          else if (error.message.includes('already exists')) {
            results.push({ step: i + 1, success: true, note: 'Already applied or not needed' });
          } else {
            // Outros erros que não são relacionados à função execute_sql
            errors.push({ step: i + 1, error: error.message });
          }
        } else {
          results.push({ step: i + 1, success: true });
        }
      } catch (err) {
        console.error(`Error in migration step ${i + 1}:`, err);
        // Verificar se é um erro de função não encontrada
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('Could not find the function') ||
            errMsg.includes('function') && errMsg.includes('does not exist')) {
          console.log(`Step ${i + 1}: execute_sql function not available (caught in catch), will require manual execution`);
          needsManualExecution = true;
          results.push({
            step: i + 1,
            success: true,
            note: 'Requires manual execution - execute_sql function not available'
          });
        } else {
          errors.push({ step: i + 1, error: errMsg });
        }
      }
    }

    // Se precisa execução manual ou tem erros, preparar SQL
    if (needsManualExecution || errors.length > 0) {
      return NextResponse.json({
        success: needsManualExecution && errors.length === 0, // Sucesso se só precisa execução manual
        message: needsManualExecution
          ? 'Migration preparada! Execute o SQL manualmente no Supabase SQL Editor'
          : 'Migration executada com erros',
        results,
        errors: errors.length > 0 ? errors : undefined,
        needsManualExecution,
        manualSql: migrations.join('\n\n'),
        instructions: needsManualExecution ? [
          '1. Acesse o Supabase Dashboard',
          '2. Vá para SQL Editor',
          '3. Cole o SQL abaixo e execute',
          '4. Aguarde a confirmação de sucesso'
        ] : undefined
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Migration executada com sucesso!',
      results,
      needsManualExecution: false
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
