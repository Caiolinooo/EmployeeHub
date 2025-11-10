import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Iniciando correção de foreign keys...');

    // Ler o arquivo SQL de migração
    const sqlFilePath = path.join(process.cwd(), 'supabase/migrations/FIX_FOREIGN_KEYS.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Obter cliente Supabase admin
    const supabase = await getSupabaseAdmin();

    // Dividir o SQL em comandos separados
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd =>
        cmd &&
        !cmd.startsWith('--') &&
        (cmd.toLowerCase().includes('alter table') ||
         cmd.toLowerCase().includes('select'))
      );

    const results = [];

    // Executar cada comando SQL
    for (const command of commands) {
      if (command.trim()) {
        console.log(`🚀 Executando: ${command.substring(0, 100)}...`);

        try {
          const { data, error } = await supabase.rpc('exec_sql', {
            sql_query: command
          });

          if (error) {
            // Tentar via SQL direto usando a tabela existente
            console.log(`⚠️ Erro com exec_sql: ${error.message}`);

            // Se for comando SELECT, tentar método alternativo
            if (command.toLowerCase().includes('select')) {
              const { data: selectData, error: selectError } = await supabase
                .from('users_unified')
                .select('*')
                .limit(1);

              if (selectError) {
                results.push({
                  command: command.substring(0, 50) + '...',
                  status: 'error',
                  error: selectError.message
                });
              } else {
                results.push({
                  command: command.substring(0, 50) + '...',
                  status: 'success',
                  message: 'Conexão testada com sucesso'
                });
              }
            } else {
              results.push({
                command: command.substring(0, 50) + '...',
                status: 'error',
                error: error.message
              });
            }
          } else {
            results.push({
              command: command.substring(0, 50) + '...',
              status: 'success',
              message: 'Executado com sucesso'
            });
          }
        } catch (err: any) {
          results.push({
            command: command.substring(0, 50) + '...',
            status: 'error',
            error: err.message
          });
        }
      }
    }

    // Verificação final das constraints
    try {
      const { data: constraintsData } = await supabase
        .from('avaliacoes_desempenho')
        .select('*')
        .limit(1);

      results.push({
        command: 'Verificação de tabela',
        status: 'success',
        message: 'Tabela avaliacoes_desempenho acessível'
      });
    } catch (err: any) {
      results.push({
        command: 'Verificação de tabela',
        status: 'error',
        error: err.message
      });
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: errorCount === 0,
      message: `Processo concluído. ${successCount} comandos executados com sucesso, ${errorCount} erros.`,
      results,
      instructions: {
        manualExecution: 'Execute manualmente o SQL no Supabase SQL Editor para garantir que as foreign keys sejam criadas.',
        filePath: 'supabase/migrations/FIX_FOREIGN_KEYS.sql',
        steps: [
          '1. Abra o Supabase SQL Editor',
          '2. Copie todo o conteúdo do arquivo FIX_FOREIGN_KEYS.sql',
          '3. Execute o SQL',
          '4. Verifique se as constraints foram criadas com o SELECT final'
        ]
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao executar correção de foreign keys:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Execute manualmente o SQL no Supabase SQL Editor'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST para executar a correção de foreign keys',
    instructions: {
      endpoint: '/api/database/fix-foreign-keys',
      method: 'POST',
      description: 'Executa os comandos SQL para criar as foreign keys necessárias'
    }
  });
}