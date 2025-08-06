import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Listar lembretes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Reminders - Listando lembretes do usuário ${user_id}`);

    // Construir query
    let query = supabaseAdmin
      .from('reminders')
      .select(`
        *,
        user:users_unified!user_id (
          id,
          first_name,
          last_name,
          email
        ),
        post:news_posts!post_id (
          id,
          title,
          status
        )
      `)
      .eq('user_id', user_id)
      .order('remind_at', { ascending: true });

    // Aplicar filtros
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Aplicar paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: reminders, error } = await query;

    if (error) {
      console.error('Erro ao buscar lembretes:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar lembretes' },
        { status: 500 }
      );
    }

    // Buscar contagem total
    const { count: totalCount } = await supabaseAdmin
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    console.log(`✅ ${reminders?.length || 0} lembretes carregados`);

    return NextResponse.json({
      reminders: reminders || [],
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
    console.error('Erro ao listar lembretes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo lembrete
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      post_id,
      title,
      message,
      remind_at,
      target_roles = [],
      target_users = []
    } = body;

    if (!user_id || !title || !remind_at) {
      return NextResponse.json(
        { error: 'user_id, title e remind_at são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Reminders - Criando lembrete: ${title}`);

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o post existe (se fornecido)
    if (post_id) {
      const { data: post, error: postError } = await supabaseAdmin
        .from('news_posts')
        .select('id, title')
        .eq('id', post_id)
        .single();

      if (postError || !post) {
        return NextResponse.json(
          { error: 'Post não encontrado' },
          { status: 404 }
        );
      }
    }

    // Validar data do lembrete
    const remindDate = new Date(remind_at);
    if (remindDate <= new Date()) {
      return NextResponse.json(
        { error: 'Data do lembrete deve ser no futuro' },
        { status: 400 }
      );
    }

    // Criar lembrete
    const reminderData = {
      user_id,
      post_id: post_id || null,
      title,
      message: message || '',
      remind_at,
      target_roles: JSON.stringify(target_roles),
      target_users: JSON.stringify(target_users),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data: newReminder, error: insertError } = await supabaseAdmin
      .from('reminders')
      .insert(reminderData)
      .select(`
        *,
        user:users_unified!user_id (
          id,
          first_name,
          last_name,
          email
        ),
        post:news_posts!post_id (
          id,
          title,
          status
        )
      `)
      .single();

    if (insertError) {
      console.error('Erro ao criar lembrete:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar lembrete' },
        { status: 500 }
      );
    }

    console.log(`✅ Lembrete criado: ${newReminder.title} para ${remindDate.toLocaleString('pt-BR')}`);

    return NextResponse.json(newReminder, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar lembrete:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
