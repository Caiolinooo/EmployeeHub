# 🚀 PLANO COMPLETO: ABZ ACADEMY & SOCIAL/NEWS

## 📋 **VISÃO GERAL**

Este documento detalha a implementação de dois sistemas complexos e robustos:

### 🎓 **ABZ Academy - Sistema de Aprendizagem**
- Sistema completo de LMS (Learning Management System)
- Gestão de usuários editores através do admin atual
- Upload de vídeos, cursos, progresso e certificados
- Interface moderna e intuitiva

### 📱 **Social/News - Plataforma Social**
- Sistema estilo Instagram para comunicação interna
- Feed de posts, comentários, likes e stories
- Gestão de usuários editores para conteúdo oficial
- Hashtags, menções e sistema de seguidores

---

## 🏗️ **ARQUITETURA E INTEGRAÇÃO**

### **Sistema de Usuários Existente**
- Utiliza tabela `users_unified` atual
- Estende `access_permissions.features` com novas permissões:
  ```json
  {
    "modules": { ... },
    "features": {
      "academy_editor": true,
      "social_editor": true,
      "academy_moderator": false,
      "social_moderator": true
    }
  }
  ```

### **Seleção de Editores**
- Interface no painel admin atual (`/admin/settings`)
- Administradores podem selecionar usuários como editores
- Permissões granulares (editor vs moderador)
- Sistema de auditoria para ações de editores

---

## 🗄️ **ESTRUTURA DO BANCO DE DADOS**

### **ABZ Academy**
```sql
-- Cursos e categorias
CREATE TABLE academy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  duration INTEGER, -- em segundos
  category_id UUID REFERENCES academy_categories(id),
  instructor_id UUID REFERENCES users_unified(id),
  difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Matrículas e progresso
CREATE TABLE academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id),
  course_id UUID REFERENCES academy_courses(id),
  enrolled_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  certificate_url VARCHAR(500),
  UNIQUE(user_id, course_id)
);

CREATE TABLE academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES academy_enrollments(id),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_watched_position INTEGER DEFAULT 0, -- em segundos
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Interações
CREATE TABLE academy_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES academy_courses(id),
  user_id UUID REFERENCES users_unified(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES academy_comments(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE academy_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES academy_courses(id),
  user_id UUID REFERENCES users_unified(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);
```

### **Social/News System**
```sql
-- Posts e mídia
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id),
  content TEXT NOT NULL,
  post_type VARCHAR(20) DEFAULT 'post' CHECK (post_type IN ('post', 'announcement', 'news')),
  is_official BOOLEAN DEFAULT false,
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE social_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES social_posts(id),
  media_type VARCHAR(20) CHECK (media_type IN ('image', 'video', 'document')),
  media_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  alt_text TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Interações
CREATE TABLE social_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES social_posts(id),
  user_id UUID REFERENCES users_unified(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES social_posts(id),
  user_id UUID REFERENCES users_unified(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES social_comments(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sistema social
CREATE TABLE social_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users_unified(id),
  following_id UUID REFERENCES users_unified(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE social_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag VARCHAR(100) UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE social_post_hashtags (
  post_id UUID REFERENCES social_posts(id),
  hashtag_id UUID REFERENCES social_hashtags(id),
  PRIMARY KEY (post_id, hashtag_id)
);

-- Stories temporários
CREATE TABLE social_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id),
  content TEXT,
  media_url VARCHAR(500),
  story_type VARCHAR(20) DEFAULT 'image' CHECK (story_type IN ('image', 'video', 'text')),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎯 **FUNCIONALIDADES PRINCIPAIS**

### **ABZ Academy**

#### **Para Usuários Normais:**
- ✅ Navegar catálogo de cursos por categoria
- ✅ Assistir vídeos com player avançado
- ✅ Tracking automático de progresso
- ✅ Comentar e avaliar cursos
- ✅ Certificados de conclusão
- ✅ Dashboard pessoal de aprendizagem

#### **Para Editores:**
- ✅ Criar e editar cursos
- ✅ Upload de vídeos para Google Drive
- ✅ Gerenciar categorias
- ✅ Moderar comentários
- ✅ Analytics de engajamento
- ✅ Relatórios de progresso dos usuários

### **Social/News**

#### **Para Usuários Normais:**
- ✅ Feed personalizado de posts
- ✅ Criar posts com texto/imagens
- ✅ Curtir e comentar
- ✅ Seguir outros usuários
- ✅ Stories temporários (24h)
- ✅ Sistema de hashtags

#### **Para Editores:**
- ✅ Criar posts oficiais/anúncios
- ✅ Moderar conteúdo
- ✅ Gerenciar hashtags trending
- ✅ Analytics de engajamento
- ✅ Ferramentas de moderação avançadas
- ✅ Agendamento de posts

---

## 📁 **ESTRUTURA DE ARQUIVOS**

```
src/
├── app/
│   ├── academy/
│   │   ├── page.tsx                 # Lista de cursos
│   │   ├── course/[id]/page.tsx     # Curso específico
│   │   ├── editor/page.tsx          # Interface do editor
│   │   ├── my-courses/page.tsx      # Cursos do usuário
│   │   └── category/[id]/page.tsx   # Cursos por categoria
│   ├── social/
│   │   ├── page.tsx                 # Feed principal
│   │   ├── post/[id]/page.tsx       # Post específico
│   │   ├── editor/page.tsx          # Interface do editor
│   │   ├── profile/[id]/page.tsx    # Perfil do usuário
│   │   └── hashtag/[tag]/page.tsx   # Posts por hashtag
│   └── api/
│       ├── academy/
│       │   ├── courses/route.ts
│       │   ├── enrollments/route.ts
│       │   ├── progress/route.ts
│       │   ├── comments/route.ts
│       │   └── ratings/route.ts
│       └── social/
│           ├── posts/route.ts
│           ├── comments/route.ts
│           ├── likes/route.ts
│           ├── follows/route.ts
│           └── stories/route.ts
├── components/
│   ├── Academy/
│   │   ├── CourseCard.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── CourseEditor.tsx
│   │   ├── ProgressTracker.tsx
│   │   ├── CommentSection.tsx
│   │   └── RatingSystem.tsx
│   ├── Social/
│   │   ├── PostCard.tsx
│   │   ├── PostEditor.tsx
│   │   ├── CommentSection.tsx
│   │   ├── StoryViewer.tsx
│   │   ├── HashtagInput.tsx
│   │   └── FollowButton.tsx
│   └── Admin/
│       ├── EditorSelector.tsx
│       ├── PermissionManager.tsx
│       └── AnalyticsDashboard.tsx
└── lib/
    ├── academy.ts               # Utilitários do Academy
    ├── social.ts                # Utilitários do Social
    ├── permissions.ts           # Sistema de permissões
    └── media-upload.ts          # Upload otimizado
```

---

## ⚡ **TECNOLOGIAS E OTIMIZAÇÕES**

### **Performance**
- Paginação infinita nos feeds
- Lazy loading de componentes
- Cache de queries frequentes
- Otimização automática de imagens
- CDN para arquivos de mídia

### **Segurança**
- Validação rigorosa de uploads
- Rate limiting nas APIs
- Sanitização de conteúdo
- Logs de auditoria
- Verificação de permissões em todas as operações

### **UX/UI**
- Interface consistente com design atual
- Componentes reutilizáveis
- Estados de loading e erro
- Responsividade mobile-first
- Animações suaves

---

## 🚀 **PRÓXIMOS PASSOS**

1. **Revisar e aprovar** este plano detalhado
2. **Iniciar Fase 1** - Fundação e infraestrutura
3. **Implementar Academy MVP** - Funcionalidades básicas
4. **Implementar Social MVP** - Feed e interações básicas
5. **Adicionar funcionalidades avançadas** - Stories, certificados, analytics
6. **Testes abrangentes** - Performance, segurança, usabilidade
7. **Deploy e monitoramento** - Lançamento gradual com feedback

**Tempo estimado total: 6-8 semanas**
**Entrega incremental: MVP em 4 semanas**
