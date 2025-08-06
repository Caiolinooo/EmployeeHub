-- Script para criar tabelas do sistema de notícias estilo Instagram
-- Execução segura: não afeta tabelas existentes

-- 1. Categorias de Notícias
CREATE TABLE IF NOT EXISTS news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Azul padrão
  icon VARCHAR(50) DEFAULT 'FiRss',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Posts de Notícias (estilo Instagram)
CREATE TABLE IF NOT EXISTS news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  excerpt TEXT, -- Resumo para o feed
  media_urls JSONB DEFAULT '[]', -- Array de URLs de imagens/vídeos
  external_links JSONB DEFAULT '[]', -- Array de links externos
  author_id UUID REFERENCES users_unified(id) ON DELETE SET NULL,
  category_id UUID REFERENCES news_categories(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]',
  visibility_settings JSONB DEFAULT '{"public": true, "roles": [], "users": []}',
  scheduled_for TIMESTAMP WITH TIME ZONE, -- Para posts agendados
  published_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Interações (Likes)
CREATE TABLE IF NOT EXISTS news_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES news_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 4. Comentários
CREATE TABLE IF NOT EXISTS news_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES news_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES news_post_comments(id) ON DELETE CASCADE, -- Para respostas
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Visualizações de Posts
CREATE TABLE IF NOT EXISTS news_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES news_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 6. Sistema de Notificações Unificado
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'news_post', 'comment', 'like', 'reminder', 'system', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}', -- Dados específicos da notificação
  read_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(500), -- URL para onde a notificação leva
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Permissões ACL Hierárquicas
CREATE TABLE IF NOT EXISTS acl_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES acl_permissions(id) ON DELETE CASCADE,
  resource VARCHAR(100) NOT NULL, -- 'news', 'comments', 'admin', etc.
  action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete', 'publish', etc.
  level INTEGER DEFAULT 0, -- Nível na hierarquia
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Atribuição de Permissões ACL para Usuários
CREATE TABLE IF NOT EXISTS user_acl_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES acl_permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users_unified(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, permission_id)
);

-- 9. Permissões ACL por Role
CREATE TABLE IF NOT EXISTS role_acl_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  permission_id UUID REFERENCES acl_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- 10. Lembretes e Agendamentos
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  post_id UUID REFERENCES news_posts(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  target_roles JSONB DEFAULT '[]', -- Roles que devem receber o lembrete
  target_users JSONB DEFAULT '[]', -- Usuários específicos
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_news_posts_status ON news_posts(status);
CREATE INDEX IF NOT EXISTS idx_news_posts_published_at ON news_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_author_id ON news_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_category_id ON news_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_news_post_likes_post_id ON news_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_news_post_likes_user_id ON news_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_news_post_comments_post_id ON news_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_news_post_comments_user_id ON news_post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_acl_permissions_resource ON acl_permissions(resource);
CREATE INDEX IF NOT EXISTS idx_acl_permissions_parent_id ON acl_permissions(parent_id);
CREATE INDEX IF NOT EXISTS idx_user_acl_permissions_user_id ON user_acl_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_role_acl_permissions_role ON role_acl_permissions(role);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- Inserir categorias padrão
INSERT INTO news_categories (name, description, color, icon) VALUES
('Comunicados', 'Comunicados oficiais da empresa', '#EF4444', 'FiMegaphone'),
('Notícias', 'Notícias gerais e atualizações', '#3B82F6', 'FiRss'),
('Eventos', 'Eventos e atividades da empresa', '#10B981', 'FiCalendar'),
('Treinamentos', 'Materiais de treinamento e capacitação', '#F59E0B', 'FiBookOpen'),
('Benefícios', 'Informações sobre benefícios', '#8B5CF6', 'FiGift'),
('Tecnologia', 'Atualizações tecnológicas e sistemas', '#06B6D4', 'FiMonitor')
ON CONFLICT (name) DO NOTHING;

-- Inserir permissões ACL básicas
INSERT INTO acl_permissions (name, description, resource, action, level) VALUES
-- Permissões de Notícias
('news.read', 'Visualizar notícias', 'news', 'read', 0),
('news.create', 'Criar notícias', 'news', 'create', 1),
('news.update', 'Editar notícias próprias', 'news', 'update', 1),
('news.update.all', 'Editar qualquer notícia', 'news', 'update', 2),
('news.delete', 'Excluir notícias próprias', 'news', 'delete', 1),
('news.delete.all', 'Excluir qualquer notícia', 'news', 'delete', 2),
('news.publish', 'Publicar notícias', 'news', 'publish', 2),
('news.schedule', 'Agendar notícias', 'news', 'schedule', 2),
('news.moderate', 'Moderar notícias', 'news', 'moderate', 3),
('news.analytics', 'Ver estatísticas de notícias', 'news', 'analytics', 2),

-- Permissões de Comentários
('comments.read', 'Ver comentários', 'comments', 'read', 0),
('comments.create', 'Comentar em notícias', 'comments', 'create', 0),
('comments.update', 'Editar comentários próprios', 'comments', 'update', 0),
('comments.delete', 'Excluir comentários próprios', 'comments', 'delete', 0),
('comments.moderate', 'Moderar comentários', 'comments', 'moderate', 2),

-- Permissões de Notificações
('notifications.send', 'Enviar notificações', 'notifications', 'send', 1),
('notifications.broadcast', 'Enviar notificações para todos', 'notifications', 'broadcast', 3),
('notifications.schedule', 'Agendar notificações', 'notifications', 'schedule', 2),

-- Permissões de Lembretes
('reminders.create', 'Criar lembretes', 'reminders', 'create', 1),
('reminders.manage', 'Gerenciar lembretes', 'reminders', 'manage', 2)
ON CONFLICT (name) DO NOTHING;

-- Atribuir permissões padrão por role
INSERT INTO role_acl_permissions (role, permission_id)
SELECT 'ADMIN', id FROM acl_permissions
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_acl_permissions (role, permission_id)
SELECT 'MANAGER', id FROM acl_permissions
WHERE level <= 2
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_acl_permissions (role, permission_id)
SELECT 'USER', id FROM acl_permissions
WHERE level = 0 OR name IN ('comments.create', 'comments.update', 'comments.delete')
ON CONFLICT (role, permission_id) DO NOTHING;
