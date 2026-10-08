import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: newsId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`💬 Buscando comentários da notícia ${newsId}`);

    // Buscar comentários da notícia
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('news_comments')
      .select(`
        id,
        content,
        parent_id,
        edited,
        created_at,
        updated_at,
        user:users_unified!inner(
          id,
          first_name,
          last_name,
          email,
          role
        )
      `)
      .eq('news_id', newsId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (commentsError && commentsError.code !== 'PGRST116') {
      console.error('Erro ao buscar comentários:', commentsError);
      return NextResponse.json(
        { error: 'Erro ao buscar comentários' },
        { status: 500 }
      );
    }

    // Se a tabela não existir, retornar dados simulados
    if (commentsError && commentsError.code === 'PGRST116') {
      return NextResponse.json({
        comments: [],
        total: 0,
        hasMore: false,
        message: 'Tabela de comentários não existe - dados simulados'
      });
    }

    // Organizar comentários em árvore (comentários e respostas)
    const organized = organizeComments(comments || []);

    return NextResponse.json({
      comments: organized.tree,
      total: organized.total,
      hasMore: (comments?.length || 0) === limit
    });

  } catch (error) {
    console.error('Erro ao buscar comentários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;
  try {
    const { id: newsId } = await params;
    const body = await request.json();
    const { content, parentId } = body;
    const userId = user.id;

    if (body.userId && body.userId !== userId) {
      return NextResponse.json({ error: 'userId diverge do usuário autenticado' }, { status: 403 });
    }

    if (!content) {
      return NextResponse.json(
        { error: 'content é obrigatório' },
        { status: 400 }
      );
    }

    if (content.trim().length < 1) {
      return NextResponse.json(
        { error: 'Comentário não pode estar vazio' },
        { status: 400 }
      );
    }

    console.log(`💬 Criando comentário na notícia ${newsId} pelo usuário ${userId}`);

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

    // Se parentId foi fornecido, verificar se o comentário pai existe
    if (parentId) {
      const { data: parentComment, error: parentError } = await supabaseAdmin
        .from('news_comments')
        .select('id')
        .eq('id', parentId)
        .eq('news_id', newsId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: 'Comentário pai não encontrado' },
          { status: 404 }
        );
      }
    }

    // Criar o comentário
    const commentData = {
      news_id: newsId,
      user_id: userId,
      content: content.trim(),
      parent_id: parentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newComment, error: insertError } = await supabaseAdmin
      .from('news_comments')
      .insert(commentData)
      .select(`
        id,
        content,
        parent_id,
        edited,
        created_at,
        updated_at,
        user:users_unified!inner(
          id,
          first_name,
          last_name,
          email,
          role
        )
      `)
      .single();

    if (insertError) {
      console.error('Erro ao criar comentário:', insertError);
      
      // Se a tabela não existir, criar uma entrada temporária
      if (insertError.code === 'PGRST116') {
        console.log('Tabela news_comments não existe, simulando comentário...');
        return NextResponse.json({
          id: `temp-${Date.now()}`,
          news_id: newsId,
          user_id: userId,
          content: content.trim(),
          parent_id: parentId || null,
          edited: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role
          },
          message: 'Comentário registrado (simulado - tabela não existe)'
        });
      }

      return NextResponse.json(
        { error: 'Erro ao criar comentário' },
        { status: 500 }
      );
    }

    // Atualizar contador de comentários na notícia (se a coluna existir)
    const { error: updateError } = await supabaseAdmin
      .from('News')
      .update({ 
        comments_count: supabaseAdmin.rpc('increment_comments', { news_id: newsId })
      })
      .eq('id', newsId);

    if (updateError) {
      console.log('Não foi possível atualizar contador de comentários:', updateError);
    }

    console.log(`✅ Comentário criado com sucesso na notícia ${newsId}`);

    return NextResponse.json(newComment, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função auxiliar para organizar comentários em árvore e contar total
function organizeComments(comments: any[]): { tree: any[]; total: number } {
  const commentMap = new Map();
  const rootComments: any[] = [];

  comments.forEach(comment => {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  });

  comments.forEach(comment => {
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  });

  return { tree: rootComments, total: comments.length };
}
