const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configurações do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://arzvingdtnttiejcvucs.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenZpbmdkdG50dGllamN2dWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDk0NjcyOSwiZXhwIjoyMDYwNTIyNzI5fQ.Rfo5jOH3iFxFBPyV7mNtG7Ja29AFskUQYYA4fgG2HAk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addEmailVerificationColumns() {
  try {
    console.log('Adicionando colunas de verificação de email...');

    // Ler o arquivo SQL
    const sqlFile = path.join(__dirname, 'add-email-verification-columns.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Dividir em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    // Executar cada comando
    for (const command of commands) {
      if (command.trim()) {
        console.log('Executando:', command.substring(0, 50) + '...');
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: command
        });

        if (error) {
          console.error('Erro ao executar comando:', error);
          console.error('Comando:', command);
        } else {
          console.log('✓ Comando executado com sucesso');
        }
      }
    }

    console.log('✅ Colunas de verificação de email adicionadas com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao adicionar colunas:', error);
  }
}

addEmailVerificationColumns();
