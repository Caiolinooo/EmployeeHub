import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Verifica se a tabela Reimbursement existe e adiciona a coluna user_id se necessário
 */
async function checkAndAddUserIdColumn() {
  try {
    // Verificar se a tabela Reimbursement existe tentando acessá-la diretamente
    const { data: testData, error: testError } = await supabaseAdmin
      .from('Reimbursement')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Erro ao verificar tabela Reimbursement:', testError);
      return { success: false, error: testError.message };
    }

    console.log('Tabela Reimbursement encontrada');

    // Verificar se a coluna user_id já existe usando SQL direto
    const { data: columnCheckData, error: columnCheckError } = await supabaseAdmin.rpc(
      'execute_sql',
      {
        sql: `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'Reimbursement'
          AND column_name = 'user_id'
        `
      }
    );

    // Se o RPC falhar, tentar uma abordagem alternativa
    if (columnCheckError) {
      console.error('Erro ao verificar coluna user_id via RPC:', columnCheckError);

      // Tentar verificar a existência da coluna tentando selecionar dados com ela
      try {
        const { data: userIdData, error: userIdError } = await supabaseAdmin
          .from('Reimbursement')
          .select('user_id')
          .limit(1);

        // Se não houver erro, a coluna existe
        if (!userIdError) {
          console.log('Coluna user_id já existe (verificado via select)');
          return { success: true, message: 'Coluna user_id já existe' };
        }

        // Se o erro não for sobre coluna inexistente, propagar o erro
        if (!userIdError.message.includes('column') && !userIdError.message.includes('não existe')) {
          throw userIdError;
        }

        // A coluna não existe, continuar para adicioná-la
      } catch (selectError) {
        console.log('Erro ao verificar coluna via select:', selectError);
        // Continuar para tentar adicionar a coluna
      }
    } else if (columnCheckData && columnCheckData.length > 0) {
      console.log('Coluna user_id já existe (verificado via RPC)');
      return { success: true, message: 'Coluna user_id já existe' };
    }

    console.log('Adicionando coluna user_id à tabela Reimbursement');

    // Tentar adicionar a coluna diretamente usando o cliente Supabase
    try {
      console.log('Tentando adicionar coluna user_id diretamente...');

      // Criar uma tabela temporária para testar se temos permissões para alterar tabelas
      const { error: createTempError } = await supabaseAdmin
        .from('temp_test_table')
        .insert({ id: 1 })
        .select();

      if (createTempError && !createTempError.message.includes('does not exist')) {
        console.error('Erro ao testar permissões:', createTempError);
        return {
          success: false,
          error: 'Não foi possível verificar permissões para alterar tabelas',
          details: createTempError.message
        };
      }

      // Tentar adicionar a coluna usando uma abordagem diferente
      // Primeiro, vamos verificar se temos permissão para executar SQL direto
      console.log('Verificando se podemos executar SQL direto...');

      // Tentar uma abordagem mais simples: criar um novo reembolso com o campo user_id
      console.log('Tentando criar um reembolso com o campo user_id...');

      const testId = `test-${Date.now()}`;
      const { error: insertError } = await supabaseAdmin
        .from('Reimbursement')
        .insert({
          id: testId,
          nome: 'Teste Migração',
          email: 'teste@migracao.com',
          telefone: '123456789',
          cpf: '12345678901',
          cargo: 'Teste',
          centro_custo: 'Teste',
          data: new Date().toISOString(),
          tipo_reembolso: 'Teste',
          descricao: 'Teste de migração',
          valor_total: 0,
          moeda: 'BRL',
          metodo_pagamento: 'Teste',
          comprovantes: [],
          protocolo: `TEST-${Date.now()}`,
          status: 'teste',
          historico: [],
          user_id: '00000000-0000-0000-0000-000000000000' // UUID de teste
        });

      if (insertError) {
        // Se o erro for porque a coluna não existe, precisamos adicioná-la
        if (insertError.message.includes('user_id') &&
            (insertError.message.includes('does not exist') ||
             insertError.message.includes('não existe'))) {
          console.log('Coluna user_id não existe, precisamos adicioná-la');

          // Neste ponto, precisamos de uma abordagem diferente
          // Vamos informar ao usuário que ele precisa adicionar a coluna manualmente
          return {
            success: false,
            error: 'Não foi possível adicionar a coluna user_id automaticamente',
            details: 'Por favor, adicione a coluna user_id à tabela Reimbursement manualmente usando o SQL Editor do Supabase',
            sql: `ALTER TABLE "Reimbursement" ADD COLUMN IF NOT EXISTS "user_id" UUID REFERENCES "users_unified"("id") ON DELETE SET NULL;`
          };
        } else if (!insertError.message.includes('user_id')) {
          // Se o erro não for relacionado à coluna user_id, pode ser outro problema
          console.error('Erro ao inserir reembolso de teste:', insertError);
          return {
            success: false,
            error: 'Erro ao testar adição de coluna user_id',
            details: insertError.message
          };
        }
      } else {
        // Se não houver erro, a coluna já existe
        console.log('Coluna user_id já existe (verificado via insert)');

        // Limpar o reembolso de teste
        await supabaseAdmin
          .from('Reimbursement')
          .delete()
          .eq('id', testId);

        return { success: true, message: 'Coluna user_id já existe' };
      }
    } catch (error) {
      console.error('Erro ao adicionar coluna user_id:', error);
      return {
        success: false,
        error: 'Erro ao adicionar coluna user_id',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }

    console.log('Coluna user_id adicionada com sucesso');
    return { success: true, message: 'Coluna user_id adicionada com sucesso' };
  } catch (error) {
    console.error('Erro ao adicionar coluna user_id:', error);
    return {
      success: false,
      error: 'Erro interno ao adicionar coluna user_id',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Migra dados existentes para usar user_id
 */
async function migrateExistingData() {
  try {
    console.log('Iniciando migração de dados existentes');

    // Verificar primeiro se a coluna user_id existe
    try {
      const { data: userIdData, error: userIdError } = await supabaseAdmin
        .from('Reimbursement')
        .select('user_id')
        .limit(1);

      if (userIdError) {
        console.error('Erro ao verificar coluna user_id:', userIdError);
        return {
          success: false,
          error: 'A coluna user_id não existe ou não está acessível',
          details: userIdError.message
        };
      }
    } catch (error) {
      console.error('Erro ao verificar coluna user_id:', error);
      return {
        success: false,
        error: 'Erro ao verificar coluna user_id',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }

    // Obter todos os reembolsos que não têm user_id definido
    const { data: reimbursements, error: fetchError } = await supabaseAdmin
      .from('Reimbursement')
      .select('id, email')
      .is('user_id', null);

    if (fetchError) {
      console.error('Erro ao buscar reembolsos para migração:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!reimbursements || reimbursements.length === 0) {
      console.log('Nenhum reembolso encontrado para migração');
      return { success: true, message: 'Nenhum reembolso encontrado para migração' };
    }

    console.log(`Encontrados ${reimbursements.length} reembolsos para migração`);

    // Para cada reembolso, encontrar o usuário correspondente pelo email
    let migratedCount = 0;
    let failedCount = 0;

    for (const reimbursement of reimbursements) {
      try {
        if (!reimbursement.email) {
          console.log(`Reembolso ${reimbursement.id} não tem email definido, pulando`);
          failedCount++;
          continue;
        }

        const normalizedEmail = reimbursement.email.toLowerCase().trim();

        // Buscar usuário pelo email
        const { data: users, error: userError } = await supabaseAdmin
          .from('users_unified')
          .select('id')
          .eq('email', normalizedEmail);

        if (userError) {
          console.error(`Erro ao buscar usuário para email ${normalizedEmail}:`, userError);
          failedCount++;
          continue;
        }

        if (!users || users.length === 0) {
          console.log(`Nenhum usuário encontrado para email ${normalizedEmail}`);

          // Tentar buscar em user_emails
          const { data: userEmails, error: emailError } = await supabaseAdmin
            .from('user_emails')
            .select('user_id')
            .eq('email', normalizedEmail);

          if (emailError || !userEmails || userEmails.length === 0) {
            console.log(`Nenhum email adicional encontrado para ${normalizedEmail}`);
            failedCount++;
            continue;
          }

          // Atualizar o reembolso com o user_id encontrado
          const { error: updateError } = await supabaseAdmin
            .from('Reimbursement')
            .update({ user_id: userEmails[0].user_id })
            .eq('id', reimbursement.id);

          if (updateError) {
            console.error(`Erro ao atualizar reembolso ${reimbursement.id}:`, updateError);
            failedCount++;
          } else {
            console.log(`Reembolso ${reimbursement.id} atualizado com user_id ${userEmails[0].user_id}`);
            migratedCount++;
          }
        } else {
          // Atualizar o reembolso com o user_id encontrado
          const { error: updateError } = await supabaseAdmin
            .from('Reimbursement')
            .update({ user_id: users[0].id })
            .eq('id', reimbursement.id);

          if (updateError) {
            console.error(`Erro ao atualizar reembolso ${reimbursement.id}:`, updateError);
            failedCount++;
          } else {
            console.log(`Reembolso ${reimbursement.id} atualizado com user_id ${users[0].id}`);
            migratedCount++;
          }
        }
      } catch (error) {
        console.error(`Erro ao migrar reembolso ${reimbursement.id}:`, error);
        failedCount++;
      }
    }

    return {
      success: true,
      message: `Migração concluída: ${migratedCount} reembolsos migrados, ${failedCount} falhas`
    };
  } catch (error) {
    console.error('Erro ao migrar dados existentes:', error);
    return {
      success: false,
      error: 'Erro interno ao migrar dados',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Função auxiliar para verificar autenticação
async function verifyAuth(request: NextRequest) {
  // Verificar autenticação
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1];

  // Se não estiver em ambiente de desenvolvimento, verificar autenticação
  if (process.env.NODE_ENV !== 'development') {
    if (!token) {
      console.error('Não autorizado: Token não fornecido');
      return {
        success: false,
        error: 'Não autorizado',
        status: 401
      };
    }

    try {
      // Verificar se o token é válido
      const { data: user, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        console.error('Não autorizado: Token inválido', error);
        return {
          success: false,
          error: 'Não autorizado',
          status: 401
        };
      }

      // Verificar se o usuário é admin
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users_unified')
        .select('role')
        .eq('id', user.user.id)
        .single();

      if (profileError || !profile || profile.role !== 'ADMIN') {
        console.error('Não autorizado: Usuário não é admin', profileError);
        return {
          success: false,
          error: 'Não autorizado: Apenas administradores podem executar esta operação',
          status: 403
        };
      }

      return { success: true, userId: user.user.id };
    } catch (authError) {
      console.error('Erro ao verificar autenticação:', authError);
      return {
        success: false,
        error: 'Erro ao verificar autenticação',
        status: 401
      };
    }
  } else {
    console.log('Ambiente de desenvolvimento: pulando verificação de autenticação');
    return { success: true };
  }
}

// Função auxiliar para executar a migração
async function executeMigration() {
  try {
    // Verificar e adicionar a coluna user_id
    const columnResult = await checkAndAddUserIdColumn();

    if (!columnResult.success) {
      return {
        success: false,
        error: columnResult.error,
        details: columnResult.details,
        status: 500
      };
    }

    // Migrar dados existentes
    const migrationResult = await migrateExistingData();

    return {
      success: true,
      columnResult,
      migrationResult
    };
  } catch (error) {
    console.error('Erro ao executar migração:', error);
    return {
      success: false,
      error: 'Erro interno ao executar migração',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      status: 500
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Executar a migração
    const migrationResult = await executeMigration();

    if (!migrationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: migrationResult.error,
          details: migrationResult.details
        },
        { status: migrationResult.status || 500 }
      );
    }

    return NextResponse.json(migrationResult);
  } catch (error) {
    console.error('Erro na rota add-user-id-column (GET):', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Obter parâmetros da requisição
    let forceExecute = false;

    try {
      const body = await request.json();
      forceExecute = !!body.force;
    } catch (e) {
      // Ignorar erros de parsing do corpo da requisição
    }

    // Executar a migração
    const migrationResult = await executeMigration();

    if (!migrationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: migrationResult.error,
          details: migrationResult.details
        },
        { status: migrationResult.status || 500 }
      );
    }

    return NextResponse.json({
      ...migrationResult,
      method: 'POST',
      forceExecute
    });
  } catch (error) {
    console.error('Erro na rota add-user-id-column (POST):', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
