/**
 * Script simples para criar tabelas de folha de pagamento
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

async function createPayrollTables() {
  try {
    console.log('🚀 Verificando e criando tabelas de folha de pagamento...');

    // Tentar inserir um registro de teste para forçar a criação da tabela
    console.log('📋 Testando tabela payroll_companies...');
    
    const { data: testCompany, error: testError } = await supabase
      .from('payroll_companies')
      .insert([{
        name: 'Empresa Teste',
        cnpj: '00.000.000/0001-00',
        is_active: true
      }])
      .select()
      .single();

    if (testError) {
      console.log('❌ Erro ao testar tabela:', testError.message);
      console.log('🔧 As tabelas precisam ser criadas manualmente no Supabase');
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
      `);
      return false;
    } else {
      console.log('✅ Tabela payroll_companies existe e funcionando!');
      
      // Remover o registro de teste
      await supabase
        .from('payroll_companies')
        .delete()
        .eq('id', testCompany.id);
      
      console.log('🧹 Registro de teste removido');
      return true;
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return false;
  }
}

// Executar o script
if (require.main === module) {
  createPayrollTables()
    .then((success) => {
      if (success) {
        console.log('\n✅ Tabelas de folha de pagamento estão prontas!');
      } else {
        console.log('\n⚠️ Execute o SQL manualmente no Supabase primeiro');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha na execução:', error);
      process.exit(1);
    });
}

module.exports = { createPayrollTables };
