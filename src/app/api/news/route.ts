import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/db';
import { withPermission } from '@/lib/api-auth';

// GET - Obter todas as notícias
export async function GET(request: NextRequest) {
  try {
    console.log('API de notícias - Iniciando busca');
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');

    console.log('Parâmetros de busca:', { category, featured });

    // Priorizar posts publicados do sistema novo (news_posts)
    try {
      let postsQuery = supabaseAdmin
        .from('news_posts')
        .select(`
          id,
          title,
          content,
          excerpt,
          published_at,
          featured,
          category:news_categories!category_id ( name ),
          author:users_unified!author_id ( first_name, last_name )
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (category) postsQuery = postsQuery.eq('category_id', category);
      if (featured === 'true') postsQuery = postsQuery.eq('featured', true);

      const { data: posts, error: postsError } = await postsQuery as any;

      if (!postsError && posts && posts.length > 0) {
        const normalizedFromPosts = posts.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.excerpt || p.content || '',
          content: p.content || '',
          date: p.published_at || new Date().toISOString(),
          file: '',
          enabled: true,
          featured: !!p.featured,
          category: p.category?.name || '',
          author: ((p.author?.first_name || '') + ' ' + (p.author?.last_name || '')).trim(),
          thumbnail: ''
        }));

        return NextResponse.json(normalizedFromPosts);
      }
    } catch (err) {
      console.warn('Falha ao buscar primeiro em news_posts:', err);
    }


    // 1) Tentar primeiro a tabela minúscula 'news' (padrão Supabase)
    let queryLower = supabaseAdmin
      .from('news')
      .select('*')
      .order('date', { ascending: false });

    if (category) queryLower = queryLower.eq('category', category);
    if (featured === 'true') queryLower = queryLower.eq('featured', true);

    console.log('Executando consulta Supabase (news)...');
    const { data: newsLower, error: errorLower } = await queryLower;

    // 2) Se falhar ou vier vazio, tentar a tabela 'News' (maiúscula)
    let newsUpper: any[] | null = null;
    if (errorLower || (newsLower && newsLower.length === 0)) {
      let queryUpper = supabaseAdmin
        .from('News')
        .select('*')
        .order('date', { ascending: false });

      if (category) queryUpper = queryUpper.eq('category', category);
      if (featured === 'true') queryUpper = queryUpper.eq('featured', true);

      console.log('Executando consulta Supabase (News)...');
      const { data, error } = await queryUpper;
      if (error) {
        console.error('Erro ao buscar notícias (News):', error);
      } else {
        newsUpper = data || [];
      }
    }

    // 3) Consolidar resultados
    const news = (newsLower && newsLower.length > 0) ? newsLower : (newsUpper || []);

    // Se ambas deram erro real, cairá no bloco de catch mais abaixo; caso contrário, seguimos.

    // Se não houver resultados mas sem erro, ainda retornamos lista vazia normalizada abaixo.


    // Se não encontrou nada em news/News, buscar posts publicados do novo sistema (news_posts)
    if (!news || news.length === 0) {
      try {
        let postsQuery = supabaseAdmin
          .from('news_posts')
          .select(`
            id,
            title,
            content,
            excerpt,
            published_at,
            featured,
            category:news_categories!category_id ( name ),
            author:users_unified!author_id ( first_name, last_name )
          `)
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (category) postsQuery = postsQuery.eq('category_id', category);
        if (featured === 'true') postsQuery = postsQuery.eq('featured', true);

        const { data: posts, error: postsError } = await postsQuery as any;

        if (!postsError && posts && posts.length > 0) {
          const normalizedFromPosts = posts.map((p: any) => ({
            id: p.id,
            title: p.title,
            description: p.excerpt || p.content || '',
            content: p.content || '',
            date: p.published_at || new Date().toISOString(),
            file: '',
            enabled: true,
            featured: !!p.featured,
            category: p.category?.name || '',
            author: ((p.author?.first_name || '') + ' ' + (p.author?.last_name || '')).trim(),
            thumbnail: ''
          }));

          return NextResponse.json(normalizedFromPosts);
        }
      } catch (postsCatchError) {
        console.warn('Falha ao buscar posts em news_posts:', postsCatchError);
      }
    }

    // Prosseguir para normalização
    // (não entra no bloco de fallback de erro)

    console.log(`Encontradas ${news?.length || 0} notícias`);

    // Normalizar formato para o frontend (/noticias) não filtrar tudo
    const normalized = (news || []).map((n: any) => {
      // Se já tem 'enabled', assume formato antigo
      if (Object.prototype.hasOwnProperty.call(n, 'enabled')) return n;
      return {
        id: n.id,
        title: n.title,
        description: n.summary || n.content || '',
        content: n.content ?? n.description ?? '',
        date: n.published_at || n.created_at || n.updated_at || new Date().toISOString(),
        file: n.file || n.image_url || '',
        enabled: typeof n.published === 'boolean' ? n.published : true,
        featured: n.featured ?? false,
        category: n.category || '',
        author: n.author || '',
        thumbnail: n.thumbnail || n.image_url || ''
      };
    });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Erro ao obter notícias:', error);

    // Retornar dados de exemplo em caso de erro
    try {
      console.log('Retornando dados de exemplo devido a erro...');

      // Importar dados de exemplo
      const { mockNews } = await import('./mock/data');

      // Normalizar dados de exemplo para campos esperados pela UI
      const normalizedMock = (mockNews || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        description: n.description || n.summary || n.content || '',
        content: n.content ?? n.description ?? '',
        date: n.date || n.published_at || new Date().toISOString(),
        file: n.file || n.image_url || '',
        enabled: typeof n.enabled === 'boolean' ? n.enabled : true,
        featured: !!n.featured,
        category: n.category || '',
        author: n.author || '',
        thumbnail: n.thumbnail || n.image_url || ''
      }));

      console.log(`Retornando ${normalizedMock.length} notícias de exemplo`);
      return NextResponse.json(normalizedMock);
    } catch (mockError) {
      console.error('Erro ao carregar dados de exemplo:', mockError);
      return NextResponse.json(
        { error: 'Erro interno do servidor', details: String(error) },
        { status: 500 }
      );
    }
  }
}

// POST - Criar uma nova notícia (somente ADMIN ou MANAGER)
export const POST = withPermission('manager', async (request: NextRequest) => {
  try {
    console.log('API de notícias - Iniciando criação de notícia');
    const body = await request.json();
    console.log('Dados recebidos:', body);

    const { title, description, date, file, enabled, featured, category, author, thumbnail } = body;

    // Validar os dados de entrada
    if (!title || !description || !date || !category || !author) {
      console.log('Validação falhou - campos obrigatórios ausentes');
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Preparar dados para inserção
    const newsData = {
      title,
      description,
      content: description, // Usar a descrição como conteúdo por padrão
      date: new Date(date).toISOString(),
      file: file || '', // Tornar o arquivo opcional
      enabled: enabled !== false,
      featured: featured || false,
      category,
      author,
      thumbnail: thumbnail || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Tentar inserir na tabela News
    console.log('Inserindo notícia na tabela News...');
    const { data: newsData1, error: newsError1 } = await supabaseAdmin
      .from('News')
      .insert(newsData)
      .select()
      .single();

    // Se falhar, tentar com nome de tabela em minúsculas
    if (newsError1) {
      console.error('Erro ao inserir na tabela News:', newsError1);
      console.log('Tentando inserir na tabela news...');

      const { data: newsData2, error: newsError2 } = await supabaseAdmin
        .from('news')
        .insert(newsData)
        .select()
        .single();

      if (newsError2) {
        console.error('Erro ao inserir na tabela news:', newsError2);
        return NextResponse.json(
          { error: 'Erro ao criar notícia', details: newsError2.message },
          { status: 500 }
        );
      }

      console.log('Notícia criada com sucesso (tabela news):', newsData2?.id);
      return NextResponse.json(newsData2, { status: 201 });
    }

    console.log('Notícia criada com sucesso (tabela News):', newsData1?.id);
    return NextResponse.json(newsData1, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar notícia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
});
