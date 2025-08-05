/**
 * Script para configurar o cliente LUZ Marítima
 * Executa o SQL necessário e cadastra o cliente
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

async function setupLuzMaritima() {
  try {
    console.log('🚀 Configurando cliente LUZ Marítima...');

    // Primeiro, tentar criar as tabelas básicas
    console.log('📋 Criando tabelas básicas...');
    
    // Tentar inserir um registro de teste para verificar se as tabelas existem
    const { data: testData, error: testError } = await supabase
      .from('payroll_companies')
      .select('id')
      .limit(1);

    if (testError && testError.code === '42P01') {
      console.log('⚠️ Tabelas não existem. Você precisa executar o SQL manualmente no Supabase.');
      console.log('\n📝 Execute este SQL no SQL Editor do Supabase:');
      console.log(`
-- Tabela de empresas/clientes
CREATE TABLE IF NOT EXISTS payroll_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  contact_person VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de departamentos
CREATE TABLE IF NOT EXISTS payroll_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Tabela de funcionários
CREATE TABLE IF NOT EXISTS payroll_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID,
  company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES payroll_departments(id),
  registration_number VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  cpf VARCHAR(14),
  position VARCHAR(255),
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  admission_date DATE,
  termination_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  bank_code VARCHAR(10),
  bank_agency VARCHAR(20),
  bank_account VARCHAR(30),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de folhas de pagamento
CREATE TABLE IF NOT EXISTS payroll_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES payroll_departments(id),
  reference_month INTEGER NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year INTEGER NOT NULL CHECK (reference_year >= 2020),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'paid', 'cancelled')),
  total_employees INTEGER DEFAULT 0,
  total_gross DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  total_net DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, reference_month, reference_year)
);

-- Tabelas específicas para LUZ Marítima
CREATE TABLE IF NOT EXISTS luz_maritima_payroll_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
  column_a TEXT, column_b TEXT, column_c TEXT, column_d TEXT, column_e TEXT,
  column_f TEXT, column_g TEXT, column_h TEXT, column_i TEXT, column_j TEXT,
  column_k TEXT, column_l TEXT, column_m TEXT, column_n TEXT, column_o TEXT,
  column_p TEXT, column_q TEXT, column_r TEXT, column_s TEXT, column_t TEXT,
  column_u TEXT, column_v TEXT, column_w TEXT, column_x TEXT, column_y TEXT,
  column_z TEXT, column_aa TEXT, column_ab TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS luz_maritima_cost_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
  manual_d DECIMAL(10,2) DEFAULT 0,
  manual_e DECIMAL(10,2) DEFAULT 0,
  manual_f DECIMAL(10,2) DEFAULT 0,
  manual_j DECIMAL(10,2) DEFAULT 0,
  manual_m DECIMAL(10,2) DEFAULT 0,
  fixed_g DECIMAL(10,2) DEFAULT 0,
  fixed_h DECIMAL(10,2) DEFAULT 0,
  fixed_i DECIMAL(10,2) DEFAULT 0,
  fixed_k DECIMAL(10,2) DEFAULT 0,
  fixed_n DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, sheet_id)
);

-- Inserir cliente LUZ Marítima
INSERT INTO payroll_companies (name, cnpj, address, phone, email, contact_person, is_active)
VALUES (
  'LUZ MARÍTIMA LTDA',
  '12.345.678/0001-99',
  'Porto de Santos, SP',
  '+55 13 99999-9999',
  'contato@luzmaritima.com.br',
  'Gerente Operacional',
  true
) ON CONFLICT (cnpj) DO NOTHING;

-- Inserir departamento padrão
INSERT INTO payroll_departments (company_id, code, name, description, is_active)
SELECT 
  pc.id,
  'OPERACIONAL',
  'Operacional Marítimo',
  'Departamento operacional para atividades marítimas',
  true
FROM payroll_companies pc 
WHERE pc.name = 'LUZ MARÍTIMA LTDA'
ON CONFLICT (company_id, code) DO NOTHING;
      `);
      
      console.log('\n⚠️ Após executar o SQL, rode este script novamente.');
      return false;
    }

    // Se chegou aqui, as tabelas existem
    console.log('✅ Tabelas existem! Verificando cliente LUZ Marítima...');
    
    const { data: company, error: companyError } = await supabase
      .from('payroll_companies')
      .select('id, name')
      .eq('name', 'LUZ MARÍTIMA LTDA')
      .single();

    if (companyError && companyError.code === 'PGRST116') {
      console.log('📝 Cliente LUZ Marítima não encontrado. Criando...');
      
      const { data: newCompany, error: createError } = await supabase
        .from('payroll_companies')
        .insert([{
          name: 'LUZ MARÍTIMA LTDA',
          cnpj: '12.345.678/0001-99',
          address: 'Porto de Santos, SP',
          phone: '+55 13 99999-9999',
          email: 'contato@luzmaritima.com.br',
          contact_person: 'Gerente Operacional',
          is_active: true
        }])
        .select()
        .single();

      if (createError) {
        console.error('❌ Erro ao criar cliente:', createError);
        return false;
      }

      console.log('✅ Cliente LUZ Marítima criado:', newCompany.id);
      
      // Criar departamento
      const { error: deptError } = await supabase
        .from('payroll_departments')
        .insert([{
          company_id: newCompany.id,
          code: 'OPERACIONAL',
          name: 'Operacional Marítimo',
          description: 'Departamento operacional para atividades marítimas',
          is_active: true
        }]);

      if (!deptError) {
        console.log('✅ Departamento criado com sucesso');
      }
      
    } else if (company) {
      console.log('✅ Cliente LUZ Marítima já existe:', company.id);
    }

    console.log('\n🎉 Configuração concluída!');
    console.log('📋 Próximos passos:');
    console.log('1. Acesse /folha-pagamento/empresas');
    console.log('2. Encontre a empresa LUZ MARÍTIMA LTDA');
    console.log('3. Use o botão de importação para fazer upload da planilha AN-FIN-005-R0');
    console.log('4. Preencha os dados manuais conforme necessário');
    console.log('5. Exporte os resultados');
    
    return true;

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return false;
  }
}

// Executar o script
if (require.main === module) {
  setupLuzMaritima()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Falha na execução:', error);
      process.exit(1);
    });
}

module.exports = { setupLuzMaritima };
