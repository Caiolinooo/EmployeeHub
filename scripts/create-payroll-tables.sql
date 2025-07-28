-- Script para criar as tabelas do módulo de folha de pagamento
-- Sistema de Folha de Pagamento - Painel ABZ

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

-- Tabela de funcionários da folha (integração com sistema existente)
CREATE TABLE IF NOT EXISTS payroll_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID, -- Referência ao sistema existente (pode ser NULL para funcionários externos)
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
  pis_pasep VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, registration_number)
);

-- Tabela de perfis de cálculo
CREATE TABLE IF NOT EXISTS payroll_calculation_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  company_id UUID REFERENCES payroll_companies(id),
  rules JSONB DEFAULT '{}', -- Regras específicas do perfil
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de códigos de proventos/descontos/outros
CREATE TABLE IF NOT EXISTS payroll_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('provento', 'desconto', 'outros')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  calculation_type VARCHAR(20) DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'formula', 'legal')),
  value DECIMAL(10,4) DEFAULT 0,
  formula TEXT,
  legal_type VARCHAR(20), -- 'inss', 'irrf', 'fgts', etc.
  is_system BOOLEAN DEFAULT false, -- Códigos do sistema (INSS, IRRF, FGTS)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(code, type)
);

-- Tabela de folhas de pagamento
CREATE TABLE IF NOT EXISTS payroll_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES payroll_departments(id),
  reference_month INTEGER NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year INTEGER NOT NULL CHECK (reference_year >= 2024),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'paid', 'cancelled')),
  total_employees INTEGER DEFAULT 0,
  total_gross DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  total_net DECIMAL(12,2) DEFAULT 0,
  total_inss DECIMAL(12,2) DEFAULT 0,
  total_irrf DECIMAL(12,2) DEFAULT 0,
  total_fgts DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID, -- Referência ao usuário que criou
  approved_by UUID, -- Referência ao usuário que aprovou
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, department_id, reference_month, reference_year)
);

-- Tabela de itens da folha de pagamento
CREATE TABLE IF NOT EXISTS payroll_sheet_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  code_id UUID REFERENCES payroll_codes(id),
  quantity DECIMAL(10,2) DEFAULT 1,
  reference_value DECIMAL(10,2) DEFAULT 0, -- Valor de referência (salário base, etc.)
  calculated_value DECIMAL(10,2) NOT NULL DEFAULT 0, -- Valor calculado final
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de resumos por funcionário
CREATE TABLE IF NOT EXISTS payroll_employee_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_others DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Bases de cálculo
  inss_base DECIMAL(10,2) DEFAULT 0,
  irrf_base DECIMAL(10,2) DEFAULT 0,
  fgts_base DECIMAL(10,2) DEFAULT 0,
  -- Valores calculados
  inss_value DECIMAL(10,2) DEFAULT 0,
  irrf_value DECIMAL(10,2) DEFAULT 0,
  fgts_value DECIMAL(10,2) DEFAULT 0,
  -- Resultado final
  gross_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sheet_id, employee_id)
);

-- Tabela de histórico de alterações
CREATE TABLE IF NOT EXISTS payroll_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_payroll_employees_company ON payroll_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employees_status ON payroll_employees(status);
CREATE INDEX IF NOT EXISTS idx_payroll_sheets_company_period ON payroll_sheets(company_id, reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_payroll_sheet_items_sheet ON payroll_sheet_items(sheet_id);
CREATE INDEX IF NOT EXISTS idx_payroll_sheet_items_employee ON payroll_sheet_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_summaries_sheet ON payroll_employee_summaries(sheet_id);

-- Triggers para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers nas tabelas
CREATE TRIGGER update_payroll_companies_updated_at BEFORE UPDATE ON payroll_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_departments_updated_at BEFORE UPDATE ON payroll_departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_employees_updated_at BEFORE UPDATE ON payroll_employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_calculation_profiles_updated_at BEFORE UPDATE ON payroll_calculation_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_codes_updated_at BEFORE UPDATE ON payroll_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_sheets_updated_at BEFORE UPDATE ON payroll_sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_sheet_items_updated_at BEFORE UPDATE ON payroll_sheet_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_employee_summaries_updated_at BEFORE UPDATE ON payroll_employee_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
