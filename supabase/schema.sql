-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de usuários (deprecated - use users_unified instead)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'MANAGER')),
  position TEXT,
  department TEXT,
  avatar TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  password_last_changed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de usuários unificados
CREATE TABLE IF NOT EXISTS users_unified (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'MANAGER')),
  position TEXT,
  department TEXT,
  avatar TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  password_last_changed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de permissões de usuários
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  user_unified_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  module TEXT,
  feature TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module, feature)
);

-- Tabela de documentos
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  file_url TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  created_by UUID NOT NULL REFERENCES users_unified(id),
  updated_by UUID REFERENCES users_unified(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de notícias
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES users_unified(id),
  updated_by UUID REFERENCES users_unified(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de itens do menu
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  parent_id UUID REFERENCES menu_items(id),
  "order" INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_auth BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de cards do dashboard
CREATE TABLE IF NOT EXISTS dashboard_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  url TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de configurações
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de histórico de acesso
CREATE TABLE IF NOT EXISTS access_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users_unified(id),
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de códigos de verificação
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_unified(id),
  phone_number TEXT,
  email TEXT,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de códigos de convite
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  email TEXT,
  phone_number TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users_unified(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de usuários autorizados
CREATE TABLE IF NOT EXISTS authorized_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  phone_number TEXT UNIQUE,
  domain TEXT,
  invite_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'rejected', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users_unified(id),
  updated_by UUID REFERENCES users_unified(id),
  notes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Criar índices para melhorar a performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_unified_email ON users_unified(email);
CREATE INDEX IF NOT EXISTS idx_users_unified_phone ON users_unified(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_unified_role ON users_unified(role);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_unified_id ON user_permissions(user_unified_id);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(published);
CREATE INDEX IF NOT EXISTS idx_menu_items_parent ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_order ON menu_items("order");
CREATE INDEX IF NOT EXISTS idx_dashboard_cards_order ON dashboard_cards("order");
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_authorized_users_email ON authorized_users(email);
CREATE INDEX IF NOT EXISTS idx_authorized_users_phone ON authorized_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_authorized_users_domain ON authorized_users(domain);
CREATE INDEX IF NOT EXISTS idx_authorized_users_invite_code ON authorized_users(invite_code);
CREATE INDEX IF NOT EXISTS idx_authorized_users_status ON authorized_users(status);

-- Criar funções e triggers para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger a todas as tabelas que têm o campo updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_unified_updated_at
BEFORE UPDATE ON users_unified
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON user_permissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_news_updated_at
BEFORE UPDATE ON news
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_dashboard_cards_updated_at
BEFORE UPDATE ON dashboard_cards
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_authorized_users_updated_at
BEFORE UPDATE ON authorized_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Criar políticas de segurança RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_unified ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_users ENABLE ROW LEVEL SECURITY;

-- Política para usuários (apenas administradores podem ver todos os usuários)
CREATE POLICY users_select_policy ON users
FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_insert_policy ON users
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_update_policy ON users
FOR UPDATE USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_delete_policy ON users
FOR DELETE USING (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Política para usuários unificados (apenas administradores podem ver todos os usuários)
CREATE POLICY users_unified_select_policy ON users_unified
FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_unified_insert_policy ON users_unified
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_unified_update_policy ON users_unified
FOR UPDATE USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY users_unified_delete_policy ON users_unified
FOR DELETE USING (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Inserir usuário administrador padrão
INSERT INTO users_unified (
  id,
  email,
  first_name,
  last_name,
  phone_number,
  role,
  position,
  department,
  active
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'caio.correia@groupabz.com',
  'Admin',
  'ABZ',
  '+5522997847289',
  'ADMIN',
  'Administrador do Sistema',
  'TI',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- Inserir permissões para o usuário administrador
INSERT INTO user_permissions (
  user_id,
  module,
  feature
) VALUES
('00000000-0000-0000-0000-000000000000', 'dashboard', NULL),
('00000000-0000-0000-0000-000000000000', 'manual', NULL),
('00000000-0000-0000-0000-000000000000', 'procedimentos', NULL),
('00000000-0000-0000-0000-000000000000', 'politicas', NULL),
('00000000-0000-0000-0000-000000000000', 'calendario', NULL),
('00000000-0000-0000-0000-000000000000', 'noticias', NULL),
('00000000-0000-0000-0000-000000000000', 'reembolso', NULL),
('00000000-0000-0000-0000-000000000000', 'contracheque', NULL),
('00000000-0000-0000-0000-000000000000', 'ponto', NULL),
('00000000-0000-0000-0000-000000000000', 'avaliacao', NULL),
('00000000-0000-0000-0000-000000000000', 'admin', NULL)
ON CONFLICT (user_id, module, feature) DO NOTHING;

-- Políticas para a tabela authorized_users (apenas administradores podem gerenciar)
CREATE POLICY authorized_users_select_policy ON authorized_users
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY authorized_users_insert_policy ON authorized_users
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY authorized_users_update_policy ON authorized_users
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY authorized_users_delete_policy ON authorized_users
FOR DELETE USING (
  EXISTS (SELECT 1 FROM users_unified WHERE id = auth.uid() AND role = 'ADMIN')
);
