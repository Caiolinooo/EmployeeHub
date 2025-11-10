import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

/**
 * API para aplicar foreign keys na tabela avaliacoes_desempenho
 * POST /api/avaliacao/apply-foreign-keys
 */
export async function POST(request: NextRequest) {
  try {
    // Verificação de autenticação
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação não fornecido' },
        { status: 401 }
      );
    }

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

    // Verificar se é admin
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 403 }
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
    const isAdmin = user.role === 'ADMIN' || user.email === adminEmail || user.phone_number === adminPhone;

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem aplicar foreign keys' },
        { status: 403 }
      );
    }

    console.log('Admin verificado, aplicando foreign keys...');

    // SQL para aplicar as foreign keys
    const sql = `
      DO $$
      BEGIN
          -- Remover constraints antigas se existirem
          ALTER TABLE avaliacoes_desempenho DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_funcionario_id_fkey;
          ALTER TABLE avaliacoes_desempenho DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_avaliador_id_fkey;

          -- Foreign key para funcionario_id
          ALTER TABLE avaliacoes_desempenho
          ADD CONSTRAINT avaliacoes_desempenho_funcionario_id_fkey
          FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
          ON DELETE CASCADE;

          -- Foreign key para avaliador_id
          ALTER TABLE avaliacoes_desempenho
          ADD CONSTRAINT avaliacoes_desempenho_avaliador_id_fkey
          FOREIGN KEY (avaliador_id) REFERENCES funcionarios(id)
          ON DELETE SET NULL;

          RAISE NOTICE 'Foreign keys criadas com sucesso!';
      EXCEPTION
          WHEN OTHERS THEN
              RAISE NOTICE 'Erro ao criar foreign keys: %', SQLERRM;
      END $$;
    `;

    // Tentar executar via RPC primeiro
    const { error: rpcError } = await supabaseAdmin.rpc('execute_sql', { sql });

    if (rpcError) {
      console.log('RPC execute_sql não disponível, retornando SQL para execução manual');

      // Se a função não existe, retornar SQL para execução manual
      if (rpcError.message.includes('Could not find the function') ||
          rpcError.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          needsManualExecution: true,
          message: 'A função execute_sql não está disponível. Execute o SQL manualmente.',
          sql: sql,
          instructions: [
            '1. Acesse o Supabase Dashboard',
            '2. Vá para SQL Editor (ícone de banco de dados no menu lateral)',
            '3. Clique em "New query"',
            '4. Cole o SQL fornecido no campo "sql"',
            '5. Clique em "Run" (ou pressione Ctrl+Enter)',
            '6. Aguarde a mensagem de sucesso',
            '7. Volte aqui e clique em "Verificar Foreign Keys" novamente'
          ],
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https:\/\/([^.]+)\..*/, 'https://supabase.com/dashboard/project/$1/sql/new')
        });
      }

      // Outro tipo de erro
      return NextResponse.json({
        success: false,
        error: 'Erro ao aplicar foreign keys via RPC',
        details: rpcError.message,
        needsManualExecution: true,
        sql: sql
      }, { status: 500 });
    }

    // Sucesso via RPC
    console.log('Foreign keys aplicadas com sucesso via RPC!');

    // Verificar se foram criadas
    const { data: checkData, error: checkError } = await supabaseAdmin.rpc('execute_sql', {
      sql: `
        SELECT conname AS constraint_name
        FROM pg_constraint
        WHERE conname IN (
          'avaliacoes_desempenho_funcionario_id_fkey',
          'avaliacoes_desempenho_avaliador_id_fkey'
        );
      `
    });

    const created = checkData || [];
    const hasFunc = created.some((c: any) => c.constraint_name === 'avaliacoes_desempenho_funcionario_id_fkey');
    const hasAval = created.some((c: any) => c.constraint_name === 'avaliacoes_desempenho_avaliador_id_fkey');

    return NextResponse.json({
      success: true,
      message: 'Foreign keys aplicadas com sucesso!',
      foreignKeys: {
        funcionario_id: hasFunc,
        avaliador_id: hasAval
      },
      allCreated: hasFunc && hasAval
    });

  } catch (error) {
    console.error('Erro ao aplicar foreign keys:', error);

    // Em caso de erro, retornar SQL para execução manual
    const manualSql = `
-- Execute este SQL no Supabase SQL Editor

DO $$
BEGIN
    -- Remover constraints antigas se existirem
    ALTER TABLE avaliacoes_desempenho DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_funcionario_id_fkey;
    ALTER TABLE avaliacoes_desempenho DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_avaliador_id_fkey;

    -- Foreign key para funcionario_id
    ALTER TABLE avaliacoes_desempenho
    ADD CONSTRAINT avaliacoes_desempenho_funcionario_id_fkey
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
    ON DELETE CASCADE;

    -- Foreign key para avaliador_id
    ALTER TABLE avaliacoes_desempenho
    ADD CONSTRAINT avaliacoes_desempenho_avaliador_id_fkey
    FOREIGN KEY (avaliador_id) REFERENCES funcionarios(id)
    ON DELETE SET NULL;

    RAISE NOTICE 'Foreign keys criadas com sucesso!';
END $$;

-- Verificar se foram criadas
SELECT conname AS constraint_name
FROM pg_constraint
WHERE conname IN (
  'avaliacoes_desempenho_funcionario_id_fkey',
  'avaliacoes_desempenho_avaliador_id_fkey'
);
    `;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        needsManualExecution: true,
        sql: manualSql,
        instructions: [
          '1. Copie o SQL do campo "sql" acima',
          '2. Acesse: https://supabase.com/dashboard',
          '3. Selecione seu projeto',
          '4. Vá em SQL Editor no menu lateral',
          '5. Cole e execute o SQL',
          '6. Volte aqui e verifique novamente'
        ]
      },
      { status: 500 }
    );
  }
}
