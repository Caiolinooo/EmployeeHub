-- ============================================
-- ABZ SOCIAL SYSTEM - DATABASE TABLES
-- Sistema News estilo Instagram
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Social Posts Table
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url VARCHAR(500),
  image_urls TEXT[], -- Para múltiplas imagens
  hashtags TEXT[], -- Array de hashtags
  mentions UUID[], -- Array de IDs de usuários mencionados
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'followers')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Likes Table
CREATE TABLE IF NOT EXISTS social_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Social Comments Table
CREATE TABLE IF NOT EXISTS social_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES social_comments(id) ON DELETE CASCADE, -- Para comentários aninhados
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Stories Table (24h temporários)
CREATE TABLE IF NOT EXISTS social_stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  content TEXT,
  image_url VARCHAR(500),
  background_color VARCHAR(7) DEFAULT '#000000',
  text_color VARCHAR(7) DEFAULT '#FFFFFF',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Story Views Table
CREATE TABLE IF NOT EXISTS social_story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES social_stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

-- Social Follows Table (para sistema de seguir usuários)
CREATE TABLE IF NOT EXISTS social_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Social Notifications Table
CREATE TABLE IF NOT EXISTS social_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('like', 'comment', 'mention', 'follow', 'story_view')),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES social_comments(id) ON DELETE CASCADE,
  story_id UUID REFERENCES social_stories(id) ON DELETE CASCADE,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_hashtags ON social_posts USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_social_posts_mentions ON social_posts USING GIN(mentions);
CREATE INDEX IF NOT EXISTS idx_social_posts_visibility ON social_posts(visibility);

CREATE INDEX IF NOT EXISTS idx_social_likes_post_id ON social_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_likes_user_id ON social_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_social_comments_post_id ON social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_user_id ON social_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_parent_id ON social_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_social_stories_user_id ON social_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_social_stories_expires_at ON social_stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_social_stories_active ON social_stories(is_active);

CREATE INDEX IF NOT EXISTS idx_social_story_views_story_id ON social_story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_social_story_views_user_id ON social_story_views(user_id);

CREATE INDEX IF NOT EXISTS idx_social_follows_follower ON social_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_following ON social_follows(following_id);

CREATE INDEX IF NOT EXISTS idx_social_notifications_user_id ON social_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_social_notifications_read ON social_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_social_notifications_created_at ON social_notifications(created_at DESC);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger para atualizar updated_at
CREATE TRIGGER update_social_posts_updated_at BEFORE UPDATE ON social_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_comments_updated_at BEFORE UPDATE ON social_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Criar função para limpar stories expirados
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
    UPDATE social_stories 
    SET is_active = false 
    WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Criar view para posts com contadores
CREATE OR REPLACE VIEW social_posts_with_stats AS
SELECT 
    p.*,
    u.first_name,
    u.last_name,
    u.email,
    u.profile_photo_url,
    COALESCE(like_count.count, 0) as likes_count,
    COALESCE(comment_count.count, 0) as comments_count
FROM social_posts p
LEFT JOIN users_unified u ON p.user_id = u.id
LEFT JOIN (
    SELECT post_id, COUNT(*) as count
    FROM social_likes
    GROUP BY post_id
) like_count ON p.id = like_count.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) as count
    FROM social_comments
    WHERE parent_id IS NULL
    GROUP BY post_id
) comment_count ON p.id = comment_count.post_id
WHERE p.is_archived = false
ORDER BY p.created_at DESC;

-- Inserir dados de exemplo
INSERT INTO social_posts (user_id, content, hashtags) 
SELECT 
    id,
    'Bem-vindos ao novo sistema social da ABZ! 🎉 Aqui poderemos compartilhar novidades, conquistas e momentos especiais da nossa equipe. #ABZTeam #NovoSistema',
    ARRAY['ABZTeam', 'NovoSistema']
FROM users_unified 
WHERE role = 'admin' 
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO social_posts (user_id, content, hashtags)
SELECT 
    id,
    'Que tal compartilharmos nossas conquistas e projetos aqui? Este espaço é nosso para fortalecer ainda mais nossa comunicação interna! 💪 #Equipe #Comunicacao',
    ARRAY['Equipe', 'Comunicacao']
FROM users_unified 
WHERE role IN ('admin', 'gerente')
LIMIT 1
ON CONFLICT DO NOTHING;
