const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  try {
    console.log('Verificando estrutura da tabela Reimbursement...');
    
    // Tentar fazer uma query simples para ver os campos
    const { data, error } = await supabase
      .from('Reimbursement')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Erro ao consultar tabela:', error);
      
      // Se a tabela não existir, vamos tentar criar
      if (error.code === '42P01') {
        console.log('Tabela não existe, tentando criar...');
        
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS "Reimbursement" (
              "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              "nome" TEXT NOT NULL,
              "email" TEXT NOT NULL,
              "telefone" TEXT NOT NULL,
              "cpf" TEXT NOT NULL,
              "cargo" TEXT NOT NULL,
              "centroCusto" TEXT NOT NULL,
              "data" TIMESTAMP NOT NULL,
              "tipo_reembolso" TEXT NOT NULL,
              "icone_reembolso" TEXT,
              "descricao" TEXT NOT NULL,
              "valor_total" NUMERIC NOT NULL,
              "moeda" TEXT NOT NULL DEFAULT 'BRL',
              "metodo_pagamento" TEXT NOT NULL,
              "banco" TEXT,
              "agencia" TEXT,
              "conta" TEXT,
              "pix_tipo" TEXT,
              "pix_chave" TEXT,
              "comprovantes" JSONB NOT NULL,
              "observacoes" TEXT,
              "protocolo" TEXT NOT NULL,
              "status" TEXT NOT NULL DEFAULT 'pendente',
              "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              "historico" JSONB,
              "user_id" UUID
            );
          `
        });
        
        if (createError) {
          console.error('Erro ao criar tabela:', createError);
        } else {
          console.log('Tabela criada com sucesso!');
        }
      }
    } else {
      console.log('Tabela existe. Estrutura encontrada:');
      if (data && data.length > 0) {
        console.log('Campos disponíveis:', Object.keys(data[0]));
      } else {
        console.log('Tabela vazia, mas existe.');
      }
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkTableStructure();
