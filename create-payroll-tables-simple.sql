-- Script simplificado para criar as tabelas do módulo de folha de pagamento
-- Execute este script no SQL Editor do Supabase

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de empresas/clientes para folha de pagamento
CREATE TABLE IF NOT EXISTS payroll_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Tabela de funcionários da folha
CREATE TABLE IF NOT EXISTS payroll_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Tabela de códigos de folha (proventos, descontos, etc.)
CREATE TABLE IF NOT EXISTS payroll_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('provento', 'desconto', 'outros')),
  calculation_type VARCHAR(20) DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'formula', 'legal')),
  legal_type VARCHAR(20) CHECK (legal_type IN ('inss', 'irrf', 'fgts')),
  formula TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de folhas de pagamento
CREATE TABLE IF NOT EXISTS payroll_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, reference_month, reference_year)
);

-- Tabela de itens da folha de pagamento
CREATE TABLE IF NOT EXISTS payroll_sheet_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  code_id UUID REFERENCES payroll_codes(id),
  code VARCHAR(10) NOT NULL,
  description VARCHAR(255) NOT NULL,
  reference_value DECIMAL(10,2),
  calculated_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  type VARCHAR(20) NOT NULL CHECK (type IN ('provento', 'desconto', 'outros')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir dados iniciais
INSERT INTO payroll_companies (id, name, cnpj, address, phone, email, contact_person) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'ABZ Group', '12.345.678/0001-90', 'Rua Principal, 123', '(11) 99999-9999', 'contato@groupabz.com', 'Administrador')
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO payroll_departments (id, company_id, code, name, description) VALUES
('660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'ADM', 'Administrativo', 'Departamento Administrativo')
ON CONFLICT (company_id, code) DO NOTHING;

-- Inserir códigos básicos de folha
INSERT INTO payroll_codes (code, name, description, type, calculation_type) VALUES
('001', 'Salário Base', 'Salário base do funcionário', 'provento', 'fixed'),
('002', 'Horas Extras', 'Pagamento de horas extras', 'provento', 'formula'),
('101', 'INSS', 'Contribuição INSS', 'desconto', 'legal'),
('102', 'IRRF', 'Imposto de Renda Retido na Fonte', 'desconto', 'legal'),
('103', 'FGTS', 'Fundo de Garantia', 'desconto', 'legal')
ON CONFLICT (code) DO NOTHING;

-- Verificar se as tabelas foram criadas
SELECT 'payroll_companies' as tabela, COUNT(*) as registros FROM payroll_companies
UNION ALL
SELECT 'payroll_departments' as tabela, COUNT(*) as registros FROM payroll_departments
UNION ALL
SELECT 'payroll_employees' as tabela, COUNT(*) as registros FROM payroll_employees
UNION ALL
SELECT 'payroll_codes' as tabela, COUNT(*) as registros FROM payroll_codes
UNION ALL
SELECT 'payroll_sheets' as tabela, COUNT(*) as registros FROM payroll_sheets
UNION ALL
SELECT 'payroll_sheet_items' as tabela, COUNT(*) as registros FROM payroll_sheet_items;
