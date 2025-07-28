import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

/**
 * API route para adicionar a coluna reimbursement_email_settings à tabela users_unified
 * Esta rota é chamada automaticamente quando a coluna não existe
 */
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/setup-user-reimbursement-column - Iniciando adição da coluna');
    
    // Verificar se a coluna já existe
    try {
      const { data, error } = await supabaseAdmin
        .from('users_unified')
        .select('reimbursement_email_settings')
        .limit(1);
      
      if (!error) {
        console.log('Coluna reimbursement_email_settings já existe na tabela users_unified');
        return NextResponse.json({
          success: true,
          message: 'Coluna já existe'
        });
      }
      
      // Se o erro não for relacionado à coluna não existente, retornar erro
      if (error.code !== '42703') {
        console.error('Erro ao verificar coluna:', error);
        return NextResponse.json(
          { error: `Erro ao verificar coluna: ${error.message}` },
          { status: 500 }
        );
      }
      
      console.log('Coluna reimbursement_email_settings não existe, adicionando...');
    } catch (checkError) {
      console.error('Erro ao verificar coluna:', checkError);
    }
    
    // Método 1: Tentar adicionar a coluna usando a API REST do Supabase
    try {
      // Usar a API REST do Supabase para executar SQL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('Variáveis de ambiente do Supabase não definidas');
        return NextResponse.json(
          { error: 'Variáveis de ambiente do Supabase não definidas' },
          { status: 500 }
        );
      }
      
      // Tentar executar SQL via API REST
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          query: `ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS reimbursement_email_settings JSONB;`
        })
      });
      
      if (response.ok) {
        console.log('Coluna adicionada com sucesso via API REST');
        
        // Criar índice para melhorar performance
        try {
          const indexResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
              query: `CREATE INDEX IF NOT EXISTS idx_users_unified_reimbursement_email_settings ON users_unified USING GIN (reimbursement_email_settings);`
            })
          });
          
          if (indexResponse.ok) {
            console.log('Índice criado com sucesso');
          } else {
            console.error('Erro ao criar índice:', await indexResponse.text());
            // Não retornar erro aqui, pois o índice é opcional
          }
        } catch (indexError) {
          console.error('Erro ao criar índice:', indexError);
          // Não retornar erro aqui, pois o índice é opcional
        }
        
        // Atualizar usuários existentes com configurações padrão
        try {
          const updateResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
              query: `UPDATE users_unified SET reimbursement_email_settings = '{"enabled": false, "recipients": []}'::jsonb WHERE reimbursement_email_settings IS NULL;`
            })
          });
          
          if (updateResponse.ok) {
            console.log('Usuários atualizados com configurações padrão');
          } else {
            console.error('Erro ao atualizar usuários:', await updateResponse.text());
            // Não retornar erro aqui, pois a atualização é opcional
          }
        } catch (updateError) {
          console.error('Erro ao atualizar usuários:', updateError);
          // Não retornar erro aqui, pois a atualização é opcional
        }
        
        return NextResponse.json({
          success: true,
          message: 'Coluna adicionada com sucesso'
        });
      } else {
        console.error('Erro ao executar SQL via API REST:', await response.text());
        
        // Se a função execute_sql não existir, tentar criar
        if ((await response.text()).includes('function execute_sql') && (await response.text()).includes('does not exist')) {
          console.log('Função execute_sql não existe, tentando criar...');
          
          // Tentar criar a função execute_sql
          const createFunctionResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
              query: `
                CREATE OR REPLACE FUNCTION execute_sql(query text)
                RETURNS VOID AS $$
                BEGIN
                  EXECUTE query;
                END;
                $$ LANGUAGE plpgsql SECURITY DEFINER;
              `
            })
          });
          
          if (createFunctionResponse.ok) {
            console.log('Função execute_sql criada com sucesso, tentando adicionar coluna novamente...');
            
            // Tentar adicionar a coluna novamente
            const retryResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                query: `ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS reimbursement_email_settings JSONB;`
              })
            });
            
            if (retryResponse.ok) {
              console.log('Coluna adicionada com sucesso após criar função');
              return NextResponse.json({
                success: true,
                message: 'Coluna adicionada com sucesso após criar função'
              });
            } else {
              console.error('Erro ao adicionar coluna após criar função:', await retryResponse.text());
            }
          } else {
            console.error('Erro ao criar função execute_sql:', await createFunctionResponse.text());
          }
        }
      }
    } catch (sqlError) {
      console.error('Erro ao executar SQL:', sqlError);
    }
    
    // Método 2: Tentar usar a API de inserção para criar a coluna
    try {
      console.log('Tentando método alternativo para adicionar coluna...');
      
      // Tentar inserir um registro com a coluna para ver se ela é criada automaticamente
      const { error: insertError } = await supabaseAdmin
        .from('users_unified')
        .update({
          reimbursement_email_settings: { enabled: false, recipients: [] }
        })
        .eq('id', '00000000-0000-0000-0000-000000000000'); // ID que não existe
      
      if (!insertError || insertError.code !== '42703') {
        console.log('Coluna possivelmente adicionada via método alternativo');
        return NextResponse.json({
          success: true,
          message: 'Coluna possivelmente adicionada via método alternativo'
        });
      } else {
        console.error('Erro ao adicionar coluna via método alternativo:', insertError);
      }
    } catch (insertError) {
      console.error('Erro ao adicionar coluna via método alternativo:', insertError);
    }
    
    // Método 3: Instruções para adicionar manualmente
    console.log('Não foi possível adicionar a coluna automaticamente, retornando instruções manuais');
    
    // Salvar as instruções em um arquivo para referência futura
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const instructionsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(instructionsDir)) {
        fs.mkdirSync(instructionsDir, { recursive: true });
      }
      
      const instructionsFile = path.join(instructionsDir, 'add_reimbursement_email_settings_column.sql');
      fs.writeFileSync(instructionsFile, `
        -- Execute este SQL no SQL Editor do Supabase para adicionar a coluna reimbursement_email_settings
        ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS reimbursement_email_settings JSONB;
        
        -- Criar índice para melhorar performance
        CREATE INDEX IF NOT EXISTS idx_users_unified_reimbursement_email_settings ON users_unified USING GIN (reimbursement_email_settings);
        
        -- Atualizar usuários existentes com configurações padrão
        UPDATE users_unified SET reimbursement_email_settings = '{"enabled": false, "recipients": []}'::jsonb WHERE reimbursement_email_settings IS NULL;
      `);
      
      console.log('Instruções salvas em:', instructionsFile);
    } catch (fsError) {
      console.error('Erro ao salvar instruções:', fsError);
    }
    
    return NextResponse.json({
      success: false,
      message: 'Não foi possível adicionar a coluna automaticamente',
      manualInstructions: `
        Para adicionar a coluna manualmente, execute o seguinte SQL no SQL Editor do Supabase:
        
        ALTER TABLE users_unified ADD COLUMN IF NOT EXISTS reimbursement_email_settings JSONB;
        
        CREATE INDEX IF NOT EXISTS idx_users_unified_reimbursement_email_settings ON users_unified USING GIN (reimbursement_email_settings);
        
        UPDATE users_unified SET reimbursement_email_settings = '{"enabled": false, "recipients": []}'::jsonb WHERE reimbursement_email_settings IS NULL;
      `
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
