const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkReimbursementTable() {
  try {
    console.log('Verificando estrutura da tabela Reimbursement...');
    
    // Primeiro, vamos tentar uma query simples para ver se a tabela existe
    const { data, error } = await supabase
      .from('Reimbursement')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Erro ao consultar tabela Reimbursement:', error);
      
      if (error.code === '42P01') {
        console.log('Tabela Reimbursement não existe. Vamos criar com a estrutura correta...');
        
        // Criar a tabela com camelCase
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS "Reimbursement" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "nome" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "telefone" TEXT NOT NULL,
            "cpf" TEXT NOT NULL,
            "cargo" TEXT NOT NULL,
            "centroCusto" TEXT NOT NULL,
            "data" TIMESTAMP NOT NULL,
            "tipoReembolso" TEXT NOT NULL,
            "iconeReembolso" TEXT,
            "descricao" TEXT NOT NULL,
            "valorTotal" NUMERIC NOT NULL,
            "moeda" TEXT NOT NULL DEFAULT 'BRL',
            "metodoPagamento" TEXT NOT NULL,
            "banco" TEXT,
            "agencia" TEXT,
            "conta" TEXT,
            "pixTipo" TEXT,
            "pixChave" TEXT,
            "comprovantes" JSONB NOT NULL,
            "observacoes" TEXT,
            "protocolo" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'pendente',
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            "historico" JSONB,
            "user_id" UUID
          );
        `;
        
        console.log('SQL para criar tabela:', createTableSQL);
        return { exists: false, sql: createTableSQL };
      }
    } else {
      console.log('Tabela Reimbursement existe!');
      
      if (data && data.length > 0) {
        console.log('Campos disponíveis na tabela:');
        Object.keys(data[0]).forEach(field => {
          console.log(`- ${field}`);
        });
      } else {
        console.log('Tabela existe mas está vazia.');
      }
      
      return { exists: true, fields: data && data.length > 0 ? Object.keys(data[0]) : [] };
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
    return { exists: false, error: error.message };
  }
}

checkReimbursementTable().then(result => {
  console.log('\nResultado:', result);
});
