import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: newsId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`👍 Curtindo notícia ${newsId} pelo usuário ${userId}`);

    // Verificar se a notícia existe
    const { data: news, error: newsError } = await supabaseAdmin
      .from('News')
      .select('id, title')
      .eq('id', newsId)
      .single();

    if (newsError || !news) {
      return NextResponse.json(
        { error: 'Notícia não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o usuário já curtiu
    const { data: existingLike, error: likeCheckError } = await supabaseAdmin
      .from('news_likes')
      .select('id')
      .eq('news_id', newsId)
      .eq('user_id', userId)
      .single();

    if (likeCheckError && likeCheckError.code !== 'PGRST116') {
      console.error('Erro ao verificar like existente:', likeCheckError);
    }

    if (existingLike) {
      return NextResponse.json(
        { error: 'Usuário já curtiu esta notícia' },
        { status: 400 }
      );
    }

    // Criar o like
    const { data: newLike, error: insertError } = await supabaseAdmin
      .from('news_likes')
      .insert({
        news_id: newsId,
        user_id: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar like:', insertError);
      
      // Se a tabela não existir, criar uma entrada temporária
      if (insertError.code === 'PGRST116') {
        console.log('Tabela news_likes não existe, simulando like...');
        return NextResponse.json({
          id: `temp-${Date.now()}`,
          news_id: newsId,
          user_id: userId,
          created_at: new Date().toISOString(),
          message: 'Like registrado (simulado - tabela não existe)'
        });
      }

      return NextResponse.json(
        { error: 'Erro ao curtir notícia' },
        { status: 500 }
      );
    }

    // Atualizar contador de likes na notícia (se a coluna existir)
    const { error: updateError } = await supabaseAdmin
      .from('News')
      .update({ 
        likes_count: supabaseAdmin.rpc('increment_likes', { news_id: newsId })
      })
      .eq('id', newsId);

    if (updateError) {
      console.log('Não foi possível atualizar contador de likes:', updateError);
    }

    console.log(`✅ Like criado com sucesso para notícia ${newsId}`);

    return NextResponse.json(newLike);

  } catch (error) {
    console.error('Erro ao processar like:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: newsId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`👎 Removendo like da notícia ${newsId} pelo usuário ${userId}`);

    // Verificar se o like existe
    const { data: existingLike, error: likeCheckError } = await supabaseAdmin
      .from('news_likes')
      .select('id')
      .eq('news_id', newsId)
      .eq('user_id', userId)
      .single();

    if (likeCheckError) {
      if (likeCheckError.code === 'PGRST116') {
        return NextResponse.json(
          { message: 'Like removido (simulado - tabela não existe)' }
        );
      }
      
      return NextResponse.json(
        { error: 'Like não encontrado' },
        { status: 404 }
      );
    }

    // Remover o like
    const { error: deleteError } = await supabaseAdmin
      .from('news_likes')
      .delete()
      .eq('news_id', newsId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Erro ao remover like:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao remover like' },
        { status: 500 }
      );
    }

    // Atualizar contador de likes na notícia (se a coluna existir)
    const { error: updateError } = await supabaseAdmin
      .from('News')
      .update({ 
        likes_count: supabaseAdmin.rpc('decrement_likes', { news_id: newsId })
      })
      .eq('id', newsId);

    if (updateError) {
      console.log('Não foi possível atualizar contador de likes:', updateError);
    }

    console.log(`✅ Like removido com sucesso da notícia ${newsId}`);

    return NextResponse.json({ message: 'Like removido com sucesso' });

  } catch (error) {
    console.error('Erro ao remover like:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: newsId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log(`📊 Buscando likes da notícia ${newsId}`);

    // Buscar todos os likes da notícia
    const { data: likes, error: likesError } = await supabaseAdmin
      .from('news_likes')
      .select(`
        id,
        user_id,
        created_at,
        users_unified!inner(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('news_id', newsId)
      .order('created_at', { ascending: false });

    if (likesError && likesError.code !== 'PGRST116') {
      console.error('Erro ao buscar likes:', likesError);
      return NextResponse.json(
        { error: 'Erro ao buscar likes' },
        { status: 500 }
      );
    }

    // Se a tabela não existir, retornar dados simulados
    if (likesError && likesError.code === 'PGRST116') {
      return NextResponse.json({
        likes: [],
        total: 0,
        userLiked: false,
        message: 'Tabela de likes não existe - dados simulados'
      });
    }

    const userLiked = userId ? likes?.some(like => like.user_id === userId) : false;

    return NextResponse.json({
      likes: likes || [],
      total: likes?.length || 0,
      userLiked
    });

  } catch (error) {
    console.error('Erro ao buscar likes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
