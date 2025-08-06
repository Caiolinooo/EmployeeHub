const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configurações do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://arzvingdtnttiejcvucs.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenZpbmdkdG50dGllamN2dWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDk0NjcyOSwiZXhwIjoyMDYwNTIyNzI5fQ.Rfo5jOH3iFxFBPyV7mNtG7Ja29AFskUQYYA4fgG2HAk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runNewsSystemMigration() {
  try {
    console.log('🚀 Iniciando migração do sistema de notícias...');
    console.log('⚠️  Esta migração é segura e não afetará dados existentes');

    // Ler o arquivo SQL
    const sqlFile = path.join(__dirname, 'create-news-system-tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Dividir em comandos individuais (separados por ponto e vírgula)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 Encontrados ${commands.length} comandos SQL para executar`);

    let successCount = 0;
    let errorCount = 0;

    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        try {
          console.log(`\n[${i + 1}/${commands.length}] Executando: ${command.substring(0, 60)}...`);
          
          // Executar SQL usando a API REST do Supabase
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey
            },
            body: JSON.stringify({ sql_query: command })
          });

          const result = await response.json();
          const error = response.ok ? null : result;
          const data = response.ok ? result : null;

          if (error) {
            console.error(`❌ Erro no comando ${i + 1}:`, error.message);
            console.error(`   Comando: ${command.substring(0, 100)}...`);
            errorCount++;
            
            // Se for um erro crítico, parar a execução
            if (error.message.includes('permission denied') || 
                error.message.includes('does not exist') ||
                error.message.includes('syntax error')) {
              console.error('🛑 Erro crítico detectado. Parando execução.');
              break;
            }
          } else {
            console.log(`✅ Comando ${i + 1} executado com sucesso`);
            successCount++;
            
            // Se houver dados retornados, mostrar
            if (data && Array.isArray(data) && data.length > 0) {
              console.log(`   Resultado: ${data.length} registros afetados`);
            }
          }
        } catch (cmdError) {
          console.error(`❌ Exceção no comando ${i + 1}:`, cmdError.message);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Resumo da migração:');
    console.log(`✅ Comandos executados com sucesso: ${successCount}`);
    console.log(`❌ Comandos com erro: ${errorCount}`);
    console.log(`📝 Total de comandos: ${commands.length}`);

    if (errorCount === 0) {
      console.log('\n🎉 Migração concluída com sucesso!');
      console.log('✅ Todas as tabelas do sistema de notícias foram criadas');
      console.log('✅ Dados iniciais foram inseridos');
      console.log('✅ Índices de performance foram criados');
    } else {
      console.log('\n⚠️  Migração concluída com alguns erros');
      console.log('🔍 Verifique os erros acima e execute novamente se necessário');
    }

    // Verificar se as tabelas foram criadas
    console.log('\n🔍 Verificando tabelas criadas...');
    const tablesToCheck = [
      'news_categories',
      'news_posts', 
      'news_post_likes',
      'news_post_comments',
      'news_post_views',
      'notifications',
      'acl_permissions',
      'user_acl_permissions',
      'role_acl_permissions',
      'reminders'
    ];

    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ Tabela ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ Tabela ${tableName}: OK`);
        }
      } catch (tableError) {
        console.log(`❌ Tabela ${tableName}: ${tableError.message}`);
      }
    }

    console.log('\n🏁 Migração finalizada!');

  } catch (error) {
    console.error('💥 Erro fatal na migração:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Executar a migração
runNewsSystemMigration();
