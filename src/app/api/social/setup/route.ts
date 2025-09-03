import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('🔍 Verificando status das tabelas do sistema social...');

    const tables = [
      'social_posts',
      'social_likes', 
      'social_comments',
      'social_stories',
      'social_story_views',
      'social_follows',
      'social_notifications'
    ];

    const results: Record<string, any> = {};

    for (const table of tables) {
      try {
        console.log(`📋 Verificando tabela ${table}...`);
        
        // Tentar buscar dados da tabela
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ Erro na tabela ${table}:`, error.message);
          results[table] = {
            exists: false,
            error: error.message,
            code: error.code,
            count: 0
          };
        } else {
          console.log(`✅ Tabela ${table} OK - ${count} registros`);
          results[table] = {
            exists: true,
            count: count || 0,
            status: 'OK'
          };
        }
      } catch (err) {
        console.log(`❌ Erro ao verificar tabela ${table}:`, err);
        results[table] = {
          exists: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          count: 0
        };
      }
    }

    // Verificar se pelo menos uma tabela existe
    const existingTables = Object.keys(results).filter(table => results[table].exists);
    const missingTables = Object.keys(results).filter(table => !results[table].exists);

    console.log(`📊 Resumo: ${existingTables.length} tabelas existem, ${missingTables.length} estão faltando`);

    return NextResponse.json({
      success: true,
      message: 'Verificação das tabelas do sistema social concluída',
      summary: {
        total: tables.length,
        existing: existingTables.length,
        missing: missingTables.length,
        existingTables,
        missingTables
      },
      tables: results,
      sqlToCreate: missingTables.length > 0 ? `
-- SQL para criar as tabelas faltantes do Sistema Social
-- Execute este SQL no Supabase SQL Editor:

-- Social Posts
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url VARCHAR(500),
  image_urls TEXT[],
  hashtags TEXT[],
  mentions UUID[],
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'followers')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Likes
CREATE TABLE IF NOT EXISTS social_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Social Comments
CREATE TABLE IF NOT EXISTS social_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES social_comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Stories
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

-- Social Story Views
CREATE TABLE IF NOT EXISTS social_story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES social_stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

-- Social Follows
CREATE TABLE IF NOT EXISTS social_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Social Notifications
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

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_likes_post_id ON social_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_post_id ON social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_stories_user_id ON social_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_social_notifications_user_id ON social_notifications(user_id);
      ` : null
    });

  } catch (error) {
    console.error('❌ Erro ao verificar tabelas do sistema social:', error);
    return NextResponse.json({
      error: 'Erro interno ao verificar tabelas do sistema social',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    console.log('🌱 Populando dados de exemplo do sistema social...');

    // Buscar um usuário admin para criar posts de exemplo
    const { data: adminUser } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('role', 'admin')
      .limit(1)
      .single();

    if (!adminUser) {
      return NextResponse.json({
        error: 'Nenhum usuário admin encontrado para criar posts de exemplo'
      }, { status: 404 });
    }

    // Criar posts de exemplo
    const samplePosts = [
      {
        user_id: adminUser.id,
        content: 'Bem-vindos ao novo sistema social da ABZ! 🎉 Aqui poderemos compartilhar novidades, conquistas e momentos especiais da nossa equipe.',
        hashtags: ['ABZTeam', 'NovoSistema', 'BemVindos']
      },
      {
        user_id: adminUser.id,
        content: 'Que tal compartilharmos nossas conquistas e projetos aqui? Este espaço é nosso para fortalecer ainda mais nossa comunicação interna! 💪',
        hashtags: ['Equipe', 'Comunicacao', 'Projetos']
      }
    ];

    const { data: posts, error: postsError } = await supabaseAdmin
      .from('social_posts')
      .upsert(samplePosts, { onConflict: 'id' })
      .select();

    if (postsError) {
      console.error('Erro ao inserir posts de exemplo:', postsError);
      return NextResponse.json({
        error: 'Erro ao inserir posts de exemplo',
        details: postsError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Dados de exemplo do sistema social populados com sucesso',
      data: {
        posts: posts?.length || 0,
        admin: `${adminUser.first_name} ${adminUser.last_name}`
      }
    });

  } catch (error) {
    console.error('❌ Erro ao popular dados do sistema social:', error);
    return NextResponse.json({
      error: 'Erro interno ao popular dados do sistema social',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
