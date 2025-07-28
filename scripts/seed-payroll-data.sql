-- Script para popular dados iniciais do módulo de folha de pagamento
-- Sistema de Folha de Pagamento - Painel ABZ

-- Inserir códigos padrão do sistema (INSS, IRRF, FGTS)
INSERT INTO payroll_codes (code, type, name, description, calculation_type, legal_type, is_system, is_active) VALUES
-- Descontos obrigatórios
('104', 'desconto', 'INSS', 'Contribuição Previdenciária', 'legal', 'inss', true, true),
('108', 'desconto', 'IRRF', 'Imposto de Renda Retido na Fonte', 'legal', 'irrf', true, true),

-- Outros (FGTS)
('119', 'outros', 'FGTS 8%', 'Fundo de Garantia do Tempo de Serviço', 'legal', 'fgts', true, true),

-- Proventos comuns
('001', 'provento', 'Dias Normais', 'Salário base por dias trabalhados', 'fixed', null, false, true),
('063', 'provento', 'Adicional de Sobreaviso 20%', 'Adicional por sobreaviso', 'percentage', null, false, true),
('125', 'provento', 'Folga Indenizada', 'Pagamento de folga não gozada', 'fixed', null, false, true),
('127', 'provento', 'Reflexo DSR s/adicional noturno', 'Reflexo do adicional noturno no DSR', 'formula', null, false, true),
('131', 'provento', 'Adicional Noturno 20%', 'Adicional por trabalho noturno', 'percentage', null, false, true),
('138', 'provento', 'Dobra', 'Pagamento em dobro por trabalho em feriado', 'percentage', null, false, true),
('213', 'provento', 'Adicional de Periculosidade 30%', 'Adicional por atividade perigosa', 'percentage', null, false, true),

-- Outros proventos comuns
('002', 'provento', 'Horas Extras 50%', 'Horas extras com adicional de 50%', 'percentage', null, false, true),
('003', 'provento', 'Horas Extras 100%', 'Horas extras com adicional de 100%', 'percentage', null, false, true),
('004', 'provento', 'DSR', 'Descanso Semanal Remunerado', 'formula', null, false, true),
('005', 'provento', 'Férias', 'Pagamento de férias', 'fixed', null, false, true),
('006', 'provento', '1/3 Férias', 'Terço constitucional de férias', 'percentage', null, false, true),
('007', 'provento', '13º Salário', 'Décimo terceiro salário', 'fixed', null, false, true),

-- Descontos comuns
('201', 'desconto', 'Vale Transporte', 'Desconto de vale transporte (6%)', 'percentage', null, false, true),
('202', 'desconto', 'Vale Refeição', 'Desconto de vale refeição', 'fixed', null, false, true),
('203', 'desconto', 'Plano de Saúde', 'Desconto de plano de saúde', 'fixed', null, false, true),
('204', 'desconto', 'Seguro de Vida', 'Desconto de seguro de vida', 'fixed', null, false, true),
('205', 'desconto', 'Empréstimo', 'Desconto de empréstimo', 'fixed', null, false, true),
('206', 'desconto', 'Pensão Alimentícia', 'Desconto de pensão alimentícia', 'percentage', null, false, true),
('207', 'desconto', 'Sindicato', 'Contribuição sindical', 'fixed', null, false, true),

-- Outros
('301', 'outros', 'Aviso Prévio', 'Aviso prévio indenizado', 'fixed', null, false, true),
('302', 'outros', 'Multa 40% FGTS', 'Multa rescisória do FGTS', 'percentage', null, false, true)

ON CONFLICT (code, type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  calculation_type = EXCLUDED.calculation_type,
  legal_type = EXCLUDED.legal_type,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Inserir empresa exemplo (ABZ Group)
INSERT INTO payroll_companies (id, name, cnpj, address, phone, email, contact_person, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'AGUAS BRASILEIRAS SERVICOS E CONSULTORIAS EM ATIVIDADES MARITIMAS LTDA', '17.784.306/0001-89', 'Endereço da empresa', '+55 22 99999-9999', 'contato@groupabz.com', 'Caio Correia', true)
ON CONFLICT (cnpj) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  contact_person = EXCLUDED.contact_person,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Inserir departamento exemplo
INSERT INTO payroll_departments (id, company_id, code, name, description, is_active) VALUES
('660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '33', 'ABZ - FMS - FIRST MARINE SOLUTIONS', 'Departamento de soluções marítimas', true)
ON CONFLICT (company_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Inserir funcionários exemplo
INSERT INTO payroll_employees (id, company_id, department_id, registration_number, name, cpf, position, base_salary, admission_date, status) VALUES
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '579', 'BIANCA FILIPPI', '000.000.000-00', 'Processador de Dados', 5466.67, '2024-01-01', 'active'),
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '565', 'DANIEL ARAGAO MAGALHAES', '000.000.000-01', 'Processador de Dados', 5466.67, '2024-01-01', 'active')
ON CONFLICT (company_id, registration_number) DO UPDATE SET
  name = EXCLUDED.name,
  cpf = EXCLUDED.cpf,
  position = EXCLUDED.position,
  base_salary = EXCLUDED.base_salary,
  admission_date = EXCLUDED.admission_date,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Inserir perfil de cálculo padrão
INSERT INTO payroll_calculation_profiles (id, name, description, company_id, rules, is_default, is_active) VALUES
('880e8400-e29b-41d4-a716-446655440000', 'Perfil Padrão CLT', 'Perfil de cálculo padrão para funcionários CLT', '550e8400-e29b-41d4-a716-446655440000', 
'{"inss": {"enabled": true, "type": "legal"}, "irrf": {"enabled": true, "type": "legal"}, "fgts": {"enabled": true, "type": "legal"}, "vale_transporte": {"enabled": true, "percentage": 6, "max_percentage_salary": 20}}', 
true, true);

-- Inserir dados de DEV (Caio Correia) como funcionário exemplo
INSERT INTO payroll_employees (id, company_id, department_id, registration_number, name, cpf, position, base_salary, admission_date, status, bank_code, bank_agency, bank_account) VALUES
('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '001', 'CAIO CORREIA', '000.000.000-02', 'Desenvolvedor Full Stack', 8000.00, '2024-01-01', 'active', '001', '1234', '12345678-9')
ON CONFLICT (company_id, registration_number) DO UPDATE SET
  name = EXCLUDED.name,
  cpf = EXCLUDED.cpf,
  position = EXCLUDED.position,
  base_salary = EXCLUDED.base_salary,
  admission_date = EXCLUDED.admission_date,
  status = EXCLUDED.status,
  bank_code = EXCLUDED.bank_code,
  bank_agency = EXCLUDED.bank_agency,
  bank_account = EXCLUDED.bank_account,
  updated_at = NOW();

-- Criar uma folha de exemplo para junho/2025
INSERT INTO payroll_sheets (id, company_id, department_id, reference_month, reference_year, period_start, period_end, status, total_employees, created_at) VALUES
('990e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 6, 2025, '2025-06-01', '2025-06-30', 'draft', 3, NOW())
ON CONFLICT (company_id, department_id, reference_month, reference_year) DO UPDATE SET
  period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end,
  status = EXCLUDED.status,
  total_employees = EXCLUDED.total_employees,
  updated_at = NOW();

-- Comentários para documentação
COMMENT ON TABLE payroll_companies IS 'Empresas/clientes para cálculo de folha de pagamento';
COMMENT ON TABLE payroll_departments IS 'Departamentos das empresas';
COMMENT ON TABLE payroll_employees IS 'Funcionários para cálculo de folha (integração com sistema existente)';
COMMENT ON TABLE payroll_calculation_profiles IS 'Perfis de cálculo personalizáveis';
COMMENT ON TABLE payroll_codes IS 'Códigos de proventos, descontos e outros';
COMMENT ON TABLE payroll_sheets IS 'Folhas de pagamento por período';
COMMENT ON TABLE payroll_sheet_items IS 'Itens individuais da folha de pagamento';
COMMENT ON TABLE payroll_employee_summaries IS 'Resumos calculados por funcionário';
COMMENT ON TABLE payroll_audit_log IS 'Log de auditoria para rastreamento de alterações';
