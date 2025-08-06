-- Script para criar tabela de permissões por role

-- Criar tabela role_permissions se não existir
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role VARCHAR(50) NOT NULL UNIQUE,
  modules JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Inserir permissões padrão para cada role
INSERT INTO role_permissions (role, modules, features) VALUES 
(
  'ADMIN',
  '{
    "dashboard": true,
    "manual": true,
    "procedimentos": true,
    "politicas": true,
    "calendario": true,
    "noticias": true,
    "reembolso": true,
    "contracheque": true,
    "ponto": true,
    "admin": true,
    "avaliacao": true
  }',
  '{
    "reimbursement_approval": true,
    "reimbursement_edit": true,
    "reimbursement_view": true
  }'
),
(
  'MANAGER',
  '{
    "dashboard": true,
    "manual": true,
    "procedimentos": true,
    "politicas": true,
    "calendario": true,
    "noticias": true,
    "reembolso": true,
    "contracheque": true,
    "ponto": true,
    "admin": false,
    "avaliacao": true
  }',
  '{
    "reimbursement_approval": true,
    "reimbursement_view": true,
    "reimbursement_edit": false
  }'
),
(
  'USER',
  '{
    "dashboard": true,
    "manual": true,
    "procedimentos": true,
    "politicas": true,
    "calendario": true,
    "noticias": true,
    "reembolso": true,
    "contracheque": true,
    "ponto": true,
    "admin": false,
    "avaliacao": false
  }',
  '{
    "reimbursement_approval": false,
    "reimbursement_view": true,
    "reimbursement_edit": false
  }'
)
ON CONFLICT (role) DO UPDATE SET
  modules = EXCLUDED.modules,
  features = EXCLUDED.features,
  updated_at = NOW();

-- Verificar se as permissões foram inseridas
SELECT role, modules, features FROM role_permissions ORDER BY role;
