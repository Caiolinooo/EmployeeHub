import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

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
      .eq('id', postId)
      .single();

    if (error || !post) {
      console.error('Post não encontrado:', error);
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Incrementar contador de visualizações
    await supabaseAdmin
      .from('news_posts')
      .update({ views_count: post.views_count + 1 })
      .eq('id', postId);

    console.log(`✅ Post carregado: ${post.title}`);
    return NextResponse.json(post);

  } catch (error) {
    console.error('Erro ao buscar post:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar post (somente ADMIN ou MANAGER)
export const PUT = withPermission('manager', async (
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
      status
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
export const DELETE = withPermission('manager', async (
  request: NextRequest,
  _user: any,
  { params }: { params: Promise<{ postId: string }> }
) => {
  try {
    const { postId } = await params;
    console.log(`🔄 API News Post - Excluindo post: ${postId}`);

    // Verificar se o post existe
    const { data: existingPost, error: fetchError } = await supabaseAdmin
      .from('news_posts')
      .select('title')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
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
