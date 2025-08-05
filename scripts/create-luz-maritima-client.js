/**
 * Script para cadastrar o cliente LUZ Marítima no sistema de folha de pagamento
 * Cliente específico para a planilha AN-FIN-005-R0
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createLuzMaritimaClient() {
  try {
    console.log('🚢 Cadastrando cliente LUZ Marítima...');

    // Dados do cliente LUZ Marítima
    const luzMaritimaData = {
      name: 'LUZ MARÍTIMA LTDA',
      cnpj: '12.345.678/0001-99', // CNPJ fictício - substituir pelo real
      address: 'Porto de Santos, SP',
      phone: '+55 13 99999-9999',
      email: 'contato@luzmaritima.com.br',
      contact_person: 'Gerente Operacional',
      is_active: true
    };

    // Verificar se o cliente já existe
    const { data: existingClient, error: checkError } = await supabase
      .from('payroll_companies')
      .select('id, name')
      .eq('name', luzMaritimaData.name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar cliente existente:', checkError);
      return;
    }

    if (existingClient) {
      console.log('✅ Cliente LUZ Marítima já existe:', existingClient.id);
      return existingClient.id;
    }

    // Criar o cliente
    const { data: newClient, error: createError } = await supabase
      .from('payroll_companies')
      .insert([luzMaritimaData])
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar cliente LUZ Marítima:', createError);
      return;
    }

    console.log('✅ Cliente LUZ Marítima criado com sucesso!');
    console.log('📋 ID:', newClient.id);
    console.log('🏢 Nome:', newClient.name);
    console.log('📄 CNPJ:', newClient.cnpj);

    // Criar departamento padrão para o cliente
    await createDefaultDepartment(newClient.id);

    return newClient.id;

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function createDefaultDepartment(companyId) {
  try {
    console.log('🏗️ Criando departamento padrão...');

    const departmentData = {
      company_id: companyId,
      code: 'OPERACIONAL',
      name: 'Operacional Marítimo',
      description: 'Departamento operacional para atividades marítimas',
      is_active: true
    };

    // Verificar se o departamento já existe
    const { data: existingDept, error: checkError } = await supabase
      .from('payroll_departments')
      .select('id')
      .eq('company_id', companyId)
      .eq('code', departmentData.code)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar departamento:', checkError);
      return;
    }

    if (existingDept) {
      console.log('✅ Departamento já existe:', existingDept.id);
      return existingDept.id;
    }

    // Criar departamento
    const { data: newDept, error: createError } = await supabase
      .from('payroll_departments')
      .insert([departmentData])
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar departamento:', createError);
      return;
    }

    console.log('✅ Departamento criado:', newDept.name);
    return newDept.id;

  } catch (error) {
    console.error('❌ Erro ao criar departamento:', error);
  }
}

// Executar o script
if (require.main === module) {
  createLuzMaritimaClient()
    .then((clientId) => {
      if (clientId) {
        console.log('\n🎉 Cliente LUZ Marítima configurado com sucesso!');
        console.log('🆔 ID do Cliente:', clientId);
        console.log('\n📝 Próximos passos:');
        console.log('1. Criar estrutura de banco para planilha AN-FIN-005-R0');
        console.log('2. Implementar importação de dados');
        console.log('3. Configurar interface de preenchimento manual');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha na execução:', error);
      process.exit(1);
    });
}

module.exports = { createLuzMaritimaClient, createDefaultDepartment };
