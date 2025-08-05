-- Script para criar tabelas do módulo de folha de pagamento
-- Específico para o cliente LUZ Marítima e planilha AN-FIN-005-R0
-- Execute este script no SQL Editor do Supabase

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de empresas/clientes para folha de pagamento
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

-- Tabelas específicas para LUZ Marítima e planilha AN-FIN-005-R0

-- Tabela para dados importados do Sheet 1 (Payroll) - colunas A até AB
CREATE TABLE IF NOT EXISTS luz_maritima_payroll_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
  
  -- Dados importados da planilha (colunas A-AB)
  column_a TEXT,
  column_b TEXT,
  column_c TEXT,
  column_d TEXT,
  column_e TEXT,
  column_f TEXT,
  column_g TEXT,
  column_h TEXT,
  column_i TEXT,
  column_j TEXT,
  column_k TEXT,
  column_l TEXT,
  column_m TEXT,
  column_n TEXT,
  column_o TEXT,
  column_p TEXT,
  column_q TEXT,
  column_r TEXT,
  column_s TEXT,
  column_t TEXT,
  column_u TEXT,
  column_v TEXT,
  column_w TEXT,
  column_x TEXT,
  column_y TEXT,
  column_z TEXT,
  column_aa TEXT,
  column_ab TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para dados do Sheet 2 (Cost) - custos fixos e manuais
CREATE TABLE IF NOT EXISTS luz_maritima_cost_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
  
  -- Colunas de preenchimento manual (D, E, F, J, M)
  manual_d DECIMAL(10,2) DEFAULT 0,
  manual_e DECIMAL(10,2) DEFAULT 0,
  manual_f DECIMAL(10,2) DEFAULT 0,
  manual_j DECIMAL(10,2) DEFAULT 0,
  manual_m DECIMAL(10,2) DEFAULT 0,
  
  -- Colunas de custos fixos importados (G, H, I, K, N)
  fixed_g DECIMAL(10,2) DEFAULT 0,
  fixed_h DECIMAL(10,2) DEFAULT 0,
  fixed_i DECIMAL(10,2) DEFAULT 0,
  fixed_k DECIMAL(10,2) DEFAULT 0,
  fixed_n DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, sheet_id)
);

-- Tabela para configurações específicas do cliente LUZ Marítima
CREATE TABLE IF NOT EXISTS luz_maritima_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
  
  -- Configurações da planilha AN-FIN-005-R0
  template_version VARCHAR(50) DEFAULT 'AN-FIN-005-R0',
  calculation_method VARCHAR(100),
  cost_center_code VARCHAR(50),
  
  -- Mapeamento de colunas
  payroll_column_mapping JSONB,
  cost_column_mapping JSONB,
  
  -- Configurações de exportação
  export_format VARCHAR(50) DEFAULT 'xlsx',
  include_invoice_sheet BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id)
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

-- Inserir departamento padrão para LUZ Marítima
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

-- Inserir configurações específicas para LUZ Marítima
INSERT INTO luz_maritima_settings (
  company_id, 
  template_version, 
  calculation_method, 
  cost_center_code,
  payroll_column_mapping,
  cost_column_mapping
)
SELECT 
  pc.id,
  'AN-FIN-005-R0',
  'LUZ_MARITIMA_METHOD',
  'LUZ_MAR_001',
  '{"A": "employee_name", "B": "registration", "C": "position"}',
  '{"D": "manual_cost_1", "E": "manual_cost_2", "F": "manual_cost_3", "G": "fixed_cost_1", "H": "fixed_cost_2"}'
FROM payroll_companies pc 
WHERE pc.name = 'LUZ MARÍTIMA LTDA'
ON CONFLICT (company_id) DO NOTHING;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_luz_payroll_employee ON luz_maritima_payroll_data(employee_id);
CREATE INDEX IF NOT EXISTS idx_luz_payroll_sheet ON luz_maritima_payroll_data(sheet_id);
CREATE INDEX IF NOT EXISTS idx_luz_cost_employee ON luz_maritima_cost_data(employee_id);
CREATE INDEX IF NOT EXISTS idx_luz_cost_sheet ON luz_maritima_cost_data(sheet_id);

-- Comentários para documentação
COMMENT ON TABLE luz_maritima_payroll_data IS 'Dados importados do Sheet 1 (Payroll) da planilha AN-FIN-005-R0 para LUZ Marítima';
COMMENT ON TABLE luz_maritima_cost_data IS 'Dados do Sheet 2 (Cost) - custos fixos importados e valores manuais para LUZ Marítima';
COMMENT ON TABLE luz_maritima_settings IS 'Configurações específicas do cliente LUZ Marítima para processamento da planilha AN-FIN-005-R0';
