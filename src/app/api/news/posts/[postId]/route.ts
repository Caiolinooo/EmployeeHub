import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermissionOrGrant } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

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

function normalizePost(post: any) {
  if (!post) return post;
  return {
    ...post,
    media_urls: safeParseArray(post?.media_urls),
    external_links: safeParseArray(post?.external_links),
    tags: safeParseArray(post?.tags),
  };
}

// GET - Obter post específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    console.log(`🔄 API News Post - Buscando post: ${postId}`);

    const { data: post, error } = await supabaseAdmin
      .from('news_posts')
      .select(`
        *,
        author:users_unified!author_id (
          id,
          first_name,
          last_name,
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
      .eq('id', postId)
      .single();

    if (error || !post) {
      console.error('Post não encontrado:', error);
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Tracking de visualização REAL (sessão-based)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Importar dinamicamente para evitar problemas com edge runtime
    const { trackPostView } = await import('@/lib/viewTracking');

    // Registrar view (só incrementa se for nova sessão)
    await trackPostView(postId, undefined, ip, userAgent).catch(err => {
      console.error('Erro ao registrar view:', err);
      // Não bloqueia a resposta se o tracking falhar
    });

    console.log(`✅ Post carregado: ${post.title}`);
    return NextResponse.json(normalizePost(post));

  } catch (error) {
    console.error('Erro ao buscar post:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar post (somente ADMIN ou MANAGER)
export const PUT = withPermissionOrGrant('manager', ['news.update', 'news.update.all'], async (
  request: NextRequest,
  _user: any,
  { params }: { params: Promise<{ postId: string }> }
) => {
  try {
    const { postId } = await params;
    const body = await request.json();
    const {
      title,
      content,
      excerpt,
      media_urls,
      external_links,
      category_id,
      tags,
      visibility_settings,
      scheduled_for,
      featured,
      pinned,
      status,
      metadata
    } = body;

    console.log(`🔄 API News Post - Atualizando post: ${postId}`);

    // Verificar se o post existe
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('news_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Sincronizar com Calendário se for um evento
    if (existingPost.metadata?.eventId && (title || content)) {
      try {
        const eventUpdate: any = {
          updated_at: new Date().toISOString()
        };
        if (title) eventUpdate.summary = title;
        if (content) eventUpdate.description = content; // Simplificação

        await supabaseAdmin
          .from('calendar_events')
          .update(eventUpdate)
          .eq('id', existingPost.metadata.eventId);

        console.log(`📅 Evento de calendário sincronizado: ${existingPost.metadata.eventId}`);
      } catch (syncError) {
        console.error('Erro ao sincronizar com calendário:', syncError);
      }
    }

    // Preparar dados de atualização
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (media_urls !== undefined) updateData.media_urls = JSON.stringify(media_urls);
    if (external_links !== undefined) updateData.external_links = JSON.stringify(external_links);
    if (category_id !== undefined) updateData.category_id = category_id;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (visibility_settings !== undefined) updateData.visibility_settings = JSON.stringify(visibility_settings);
    if (scheduled_for !== undefined) updateData.scheduled_for = scheduled_for;
    if (featured !== undefined) updateData.featured = featured;
    if (pinned !== undefined) updateData.pinned = pinned;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (status !== undefined) {
      updateData.status = status;
      // Se estiver publicando pela primeira vez, definir published_at
      if (status === 'published' && !existingPost.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('news_posts')
      .update(updateData)
      .eq('id', postId)
      .select(`
        *,
        author:users_unified!author_id (
          id,
          first_name,
          last_name,
          email,
          role
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

    if (updateError) {
      console.error('Erro ao atualizar post:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar post' },
        { status: 500 }
      );
    }

    console.log(`✅ Post atualizado: ${updatedPost.title}`);
    return NextResponse.json(updatedPost);

  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});

// DELETE - Excluir post (somente ADMIN ou MANAGER)
export const DELETE = withPermissionOrGrant('manager', ['news.delete', 'news.delete.all'], async (
  request: NextRequest,
  _user: any,
  { params }: { params: Promise<{ postId: string }> }
) => {
  try {
    const { postId } = await params;
    console.log(`🔄 API News Post - Excluindo post: ${postId}`);

    // Verificar se o post existe e obter media_urls
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('news_posts')
      .select('title, metadata, media_urls')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Limpar arquivos de mídia do Storage
    if (existingPost.media_urls) {
      try {
        const mediaUrls = typeof existingPost.media_urls === 'string'
          ? JSON.parse(existingPost.media_urls)
          : existingPost.media_urls;

        if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
          console.log(`🗑️ Removendo ${mediaUrls.length} arquivo(s) de mídia do Storage...`);

          for (const url of mediaUrls) {
            try {
              // Extrair o caminho do arquivo da URL
              // Formato esperado: https://[project].supabase.co/storage/v1/object/public/news-media/posts/[filename]
              const urlParts = url.split('/storage/v1/object/public/');
              if (urlParts.length > 1) {
                const [bucket, ...pathParts] = urlParts[1].split('/');
                const filePath = pathParts.join('/');

                console.log(`  - Removendo: ${bucket}/${filePath}`);

                const { error: storageError } = await supabaseAdmin
                  .storage
                  .from(bucket)
                  .remove([filePath]);

                if (storageError) {
                  console.error(`  ❌ Erro ao remover arquivo: ${filePath}`, storageError);
                } else {
                  console.log(`  ✅ Arquivo removido: ${filePath}`);
                }
              }
            } catch (urlError) {
              console.error('  ❌ Erro ao processar URL:', url, urlError);
            }
          }
        }
      } catch (mediaError) {
        console.error('❌ Erro ao limpar arquivos de mídia:', mediaError);
        // Continuar com a exclusão do post mesmo se houver erro na limpeza de mídia
      }
    }

    // Sincronizar exclusão com Calendário
    if (existingPost.metadata?.eventId) {
      try {
        await supabaseAdmin
          .from('calendar_events')
          .delete()
          .eq('id', existingPost.metadata.eventId);
        console.log(`📅 Evento de calendário removido: ${existingPost.metadata.eventId}`);
      } catch (syncError) {
        console.error('Erro ao remover evento do calendário:', syncError);
      }
    }

    // Excluir o post (cascata irá remover likes, comentários e visualizações)
    const { error: deleteError } = await supabaseAdmin
      .from('news_posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('Erro ao excluir post:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao excluir post' },
        { status: 500 }
      );
    }

    console.log(`✅ Post excluído: ${existingPost.title}`);
    return NextResponse.json({
      success: true,
      message: 'Post excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir post:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
});
