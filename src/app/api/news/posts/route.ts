import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermissionOrGrant } from '@/lib/api-auth';
import { sendCustomEmail } from '@/lib/notifications';
import { newsPostTemplate } from '@/lib/emailTemplates';
import { sendPushToUserIds } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Helpers para garantir tipos consistentes ao retornar os posts
function safeParseArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeParseObject<T = Record<string, any>>(value: any): T {
  if (value && typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return (parsed && typeof parsed === 'object') ? (parsed as T) : ({} as T);
    } catch {
      return {} as T;
    }
  }
  return {} as T;
}

function normalizePost(post: any) {
  if (!post) return post;
  return {
    ...post,
    media_urls: safeParseArray(post?.media_urls),
    external_links: safeParseArray(post?.external_links),
    tags: safeParseArray(post?.tags),
    visibility_settings: safeParseObject(post?.visibility_settings),
  };
}

// GET - Listar posts de notícias
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || 'published';
    const category = searchParams.get('category');
    const author = searchParams.get('author');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search');

    console.log(`🔄 API News Posts - Listando posts (página ${page}, limite ${limit})`);

    // Obter usuário atual (se houver) para verificar likes
    let currentUserId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const { verifyToken } = await import('@/lib/auth');
        const decoded = verifyToken(token);
        if (decoded && typeof decoded === 'object') {
          currentUserId = (decoded as any).userId;
          console.log(`🔑 Token verificado. UserID: ${currentUserId}`);
        }
      } catch (e) {
        console.error('❌ Erro ao verificar token no header:', e);
        // Token inválido ou expirado, ignorar
      }
    }

    // Construir query base
    let query = supabaseAdmin
      .from('news_posts')
      .select(`
        *,
        author:users_unified!author_id (
          id,
          first_name,
          last_name,
          email,
          email,
          role,
          avatar,
          drive_photo_url
        ),
        category:news_categories!category_id (
          id,
          name,
          description,
          color,
          icon
        )
      `)
      .order('published_at', { ascending: false });

    // Aplicar filtros
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category_id', category);
    }

    if (author) {
      query = query.eq('author_id', author);
    }

    if (featured === 'true') {
      query = query.eq('featured', true);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    // Aplicar paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar posts:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar posts de notícias' },
        { status: 500 }
      );
    }

    // Normalizar campos serializados para arrays/objetos
    let normalizedPosts = (posts || []).map(normalizePost);

    // Enriquecer posts com user_liked e latest_likes
    if (normalizedPosts.length > 0) {
      const postIds = normalizedPosts.map(p => p.id);

      // 1. Verificar visualizações/likes do usuário atual
      const userLikesMap = new Set<string>();
      if (currentUserId) {
        console.log(`🔍 Verificando likes para usuário: ${currentUserId}`);
        const { data: userLikes } = await supabaseAdmin
          .from('news_post_likes')
          .select('post_id')
          .in('post_id', postIds)
          .eq('user_id', currentUserId);

        userLikes?.forEach(l => userLikesMap.add(l.post_id));
        console.log(`❤️ Likes encontrados: ${userLikesMap.size}`, Array.from(userLikesMap));
      } else {
        console.log('⚠️ Nenhum currentUserId identificado para verificar likes.');
      }

      // 2. Buscar últimas curtidas para cada post (para mostrar "Curtido por X e outros")
      // Isso é um pouco mais pesado, mas necessário para a UI estilo Instagram
      // Faremos em paralelo para não demorar
      normalizedPosts = await Promise.all(normalizedPosts.map(async (post) => {
        // Definir se o usuário curtiu
        const userLiked = userLikesMap.has(post.id);

        // Debug específico para um post (opcional, pode ser removido depois)
        // console.log(`Post ${post.id} liked by user? ${userLiked}`);

        // Buscar últimas 3 curtidas
        const { data: latestLikes } = await supabaseAdmin
          .from('news_post_likes')
          .select(`
            user_id,
            user:users_unified!user_id (
              id,
              first_name,
              last_name,
              avatar,
              drive_photo_url
            )
          `)
          .eq('post_id', post.id)
          .order('created_at', { ascending: false })
          .limit(3);

        const formattedLatestLikes = latestLikes?.map((l: any) => ({
          userId: l.user_id,
          firstName: l.user.first_name,
          lastName: l.user.last_name,
          avatar: l.user.avatar || l.user.drive_photo_url
        })) || [];

        return {
          ...post,
          user_liked: userLiked,
          latest_likes: formattedLatestLikes
        };
      }));
    }

    // Buscar contagem total para paginação
    let totalQuery = supabaseAdmin
      .from('news_posts')
      .select('*', { count: 'exact', head: true });

    if (status && status !== 'all') {
      totalQuery = totalQuery.eq('status', status);
    }
    if (category) {
      totalQuery = totalQuery.eq('category_id', category);
    }
    if (author) {
      totalQuery = totalQuery.eq('author_id', author);
    }
    if (featured === 'true') {
      totalQuery = totalQuery.eq('featured', true);
    }
    if (search) {
      totalQuery = totalQuery.or(`title.ilike.%${search}%,content.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    const { count: totalCount } = await totalQuery;

    console.log(`✅ ${normalizedPosts?.length || 0} posts carregados de ${totalCount || 0} total`);

    return NextResponse.json({
      posts: normalizedPosts,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNext: page * limit < (totalCount || 0),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Erro ao listar posts:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo post de notícia (somente ADMIN, MANAGER ou EDITOR DE NOTÍCIAS)
export const POST = withPermissionOrGrant('news_editor', ['news.create'], async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      title,
      content,
      excerpt,
      media_urls = [],
      external_links = [],
      author_id,
      category_id,
      tags = [],
      visibility_settings = { public: true, roles: [], users: [] },
      scheduled_for,
      featured = false,
      pinned = false,
      status = 'draft',
      metadata = {}
    } = body;

    if (!title || !author_id) {
      return NextResponse.json(
        { error: 'Título e autor são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔄 API News Posts - Criando post: ${title}`);

    // Verificar se o autor existe
    const { data: author, error: authorError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, role')
      .eq('id', author_id)
      .single();

    if (authorError || !author) {
      return NextResponse.json(
        { error: 'Autor não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se a categoria existe (se fornecida)
    let category: any = null;
    if (category_id) {
      const { data: catData, error: categoryError } = await supabaseAdmin
        .from('news_categories')
        .select('id, name')
        .eq('id', category_id)
        .single();

      if (categoryError || !catData) {
        return NextResponse.json(
          { error: 'Categoria não encontrada' },
          { status: 404 }
        );
      }
      category = catData;
    }

    // Preparar dados do post
    const postData = {
      title,
      content: content || '',
      excerpt: excerpt || content?.substring(0, 200) + '...' || '',
      media_urls: JSON.stringify(media_urls),
      external_links: JSON.stringify(external_links),
      author_id,
      category_id: category_id || null,
      tags: JSON.stringify(tags),
      visibility_settings: JSON.stringify(visibility_settings),
      scheduled_for: scheduled_for || null,
      published_at: status === 'published' ? new Date().toISOString() : null,
      status,
      featured,
      pinned,
      metadata: metadata || {},
      likes_count: 0,
      comments_count: 0,
      views_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('news_posts')
      .insert(postData)
      .select(`
        *,
        author:users_unified!author_id (
          id,
          first_name,
          last_name,
          email,
          email,
          role,
          avatar,
          drive_photo_url
        ),
        category:news_categories!category_id (
          id,
          name,
          description,
          color,
          icon
        )
      `)
      .single();

    const newPost = normalizePost(inserted);

    if (insertError) {
      console.error('Erro ao criar post:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar post de notícia' },
        { status: 500 }
      );
    }

    console.log(`✅ Post criado: ${newPost.title} (ID: ${newPost.id})`);

    // Notificar usuários ativos sobre nova publicação
    try {
      const { data: settingsRow } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'notifications')
        .maybeSingle();
      const notifSettings: any = (settingsRow?.value as any) || {};
      const shouldNotify = notifSettings.autoNotifyNewsPosts !== false;

      if (shouldNotify) {
        const { data: users } = await supabaseAdmin
          .from('users_unified')
          .select('id, email, first_name, last_name, role, profile_data')
          .eq('active', true)
          .neq('id', author_id);

        if (users && users.length > 0) {
          const titleTpl = notifSettings.newsPostTitle || 'Nova publicação no ABZ News';
          const msgTpl = notifSettings.newsPostMessage || '{{author}} publicou: {{title}}';
          const resolvedTitle = titleTpl;
          const resolvedMessage = msgTpl
            .replace('{{author}}', author?.first_name || 'Alguém')
            .replace('{{title}}', title);

          const notifications = users.map(u => ({
            user_id: u.id,
            type: 'news_post',
            title: resolvedTitle,
            message: resolvedMessage,
            actor_id: author_id, // <-- who published the post
            data: { post_id: newPost.id, category_id: category_id || null, featured: !!featured },
            action_url: `/noticias?post_id=${newPost.id}`,
            priority: (notifSettings.defaultPriority as any) || 'normal',
            created_at: new Date().toISOString()
          }));
          await supabaseAdmin.from('notifications').insert(notifications as any);

          // Enviar e-mails (opt-in por prefer encias do usu e1rio)
          const emailsToSend = (users || []).filter((u: any) => {
            const pd = (u.profile_data as any) || {};
            const np = (pd.notification_prefs as any) || {};
            const typePrefs = (np.types && np.types.news_post) || {};
            const channels = np.channels || {};
            // por padr e3o email permitido (true) se n e3o configurado
            const emailAllowed = (typePrefs.email ?? channels.email ?? true) === true;
            return emailAllowed && u.email;
          });

          if (emailsToSend.length > 0) {
            console.log('📧 Preparando envio de emails para:', emailsToSend.map((u: any) => u.email).join(', '));
            const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
            const postUrl = `${baseUrl}/noticias?post_id=${newPost.id}`;
            const subject = resolvedTitle;
            const previewText = (excerpt || content || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 240);
            const html = newsPostTemplate(author?.first_name || 'Alguém', title, previewText, postUrl, {
              categoryName: category?.name,
              featured: !!featured,
              publishedAt: newPost.published_at || new Date().toISOString()
            });
            const results = await Promise.allSettled(emailsToSend.map((u: any) => sendCustomEmail(u.email, subject, html)));
            console.log('📧 Resultados do envio:', results.map(r => r.status));
          } else {
            console.log('⚠️ Nenhum usuário elegível para receber email (verifique preferências e emails válidos)');
          }

          // Enviar push (respeitando preferências do usuário)
          const pushUsers = (users || []).filter((u: any) => {
            const pd = (u.profile_data as any) || {};
            const np = (pd.notification_prefs as any) || {};
            const typePrefs = (np.types && np.types.news_post) || {};
            const channels = np.channels || {};
            const pushAllowed = (typePrefs.push ?? channels.push ?? false) === true;
            return pushAllowed;
          }).map((u: any) => u.id);

          if (pushUsers.length > 0) {
            await sendPushToUserIds(pushUsers, {
              title: resolvedTitle,
              body: resolvedMessage,
              url: `/noticias?post_id=${newPost.id}`
            });
          }

        }
      }
    } catch (notifyError) {
      console.warn('Falha ao criar notificações de novo post:', notifyError);
    }

    // TODO: Agendar publicação se scheduled_for estiver definido

    return NextResponse.json(newPost, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar post:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
