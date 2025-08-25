import { NextRequest, NextResponse } from 'next/server';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Dados de exemplo para notícias
const mockNews = [
  {
    id: '1',
    title: 'Novo Projeto Iniciado',
    description: 'A ABZ Group iniciou um novo projeto de desenvolvimento sustentável.',
    content: 'A ABZ Group tem o prazer de anunciar o início de um novo projeto de desenvolvimento sustentável que visa reduzir o impacto ambiental das operações de petróleo e gás.',
    date: new Date('2023-10-15').toISOString(),
    file: '/documents/projeto-sustentavel.pdf',
    enabled: true,
    featured: true,
    category: 'Projetos',
    author: 'Equipe ABZ',
    thumbnail: '/images/thumbnails/projeto-sustentavel.jpg',
    createdAt: new Date('2023-10-15').toISOString(),
    updatedAt: new Date('2023-10-15').toISOString()
  },
  {
    id: '2',
    title: 'Treinamento de Segurança',
    description: 'Novo treinamento de segurança disponível para todos os funcionários.',
    content: 'A ABZ Group está oferecendo um novo treinamento de segurança para todos os funcionários. O treinamento abordará procedimentos de emergência, uso de equipamentos de proteção e protocolos de segurança.',
    date: new Date('2023-09-20').toISOString(),
    file: '/documents/treinamento-seguranca.pdf',
    enabled: true,
    featured: false,
    category: 'Treinamentos',
    author: 'Departamento de Segurança',
    thumbnail: '/images/thumbnails/treinamento-seguranca.jpg',
    createdAt: new Date('2023-09-20').toISOString(),
    updatedAt: new Date('2023-09-20').toISOString()
  },
  {
    id: '3',
    title: 'Resultados Financeiros Q3',
    description: 'Resultados financeiros do terceiro trimestre de 2023.',
    content: 'A ABZ Group divulga os resultados financeiros do terceiro trimestre de 2023, mostrando um crescimento de 15% em relação ao mesmo período do ano anterior.',
    date: new Date('2023-11-05').toISOString(),
    file: '/documents/resultados-q3-2023.pdf',
    enabled: true,
    featured: true,
    category: 'Financeiro',
    author: 'Departamento Financeiro',
    thumbnail: '/images/thumbnails/resultados-financeiros.jpg',
    createdAt: new Date('2023-11-05').toISOString(),
    updatedAt: new Date('2023-11-05').toISOString()
  },
  {
    id: '4',
    title: 'Novo Escritório em Macaé',
    description: 'ABZ Group inaugura novo escritório em Macaé.',
    content: 'A ABZ Group tem o prazer de anunciar a inauguração de seu novo escritório em Macaé, expandindo sua presença na região e melhorando o atendimento aos clientes locais.',
    date: new Date('2023-08-10').toISOString(),
    file: '/documents/novo-escritorio-macae.pdf',
    enabled: true,
    featured: false,
    category: 'Expansão',
    author: 'Diretoria',
    thumbnail: '/images/thumbnails/escritorio-macae.jpg',
    createdAt: new Date('2023-08-10').toISOString(),
    updatedAt: new Date('2023-08-10').toISOString()
  },
  {
    id: '5',
    title: 'Certificação ISO 9001',
    description: 'ABZ Group recebe certificação ISO 9001.',
    content: 'A ABZ Group tem o orgulho de anunciar que recebeu a certificação ISO 9001, reconhecendo a qualidade de seus processos e serviços.',
    date: new Date('2023-07-15').toISOString(),
    file: '/documents/certificacao-iso-9001.pdf',
    enabled: true,
    featured: false,
    category: 'Certificações',
    author: 'Departamento de Qualidade',
    thumbnail: '/images/thumbnails/certificacao-iso.jpg',
    createdAt: new Date('2023-07-15').toISOString(),
    updatedAt: new Date('2023-07-15').toISOString()
  }
];

// GET - Obter todas as notícias de exemplo
export async function GET(request: NextRequest) {
  try {
    // Runtime check to ensure this only runs during actual HTTP requests
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'Esta rota só pode ser executada no servidor' },
        { status: 500 }
      );
    }

    // Check if we're in a static generation context
    if (!request || !request.url) {
      return NextResponse.json(
        { error: 'Rota não disponível durante geração estática' },
        { status: 503 }
      );
    }

    console.log('API de notícias mock - Iniciando busca');
    
    let category = null;
    let featured = null;
    
    try {
      const { searchParams } = new URL(request.url);
      category = searchParams.get('category');
      featured = searchParams.get('featured');
    } catch (error) {
      console.error('Erro ao processar URL:', error);
      // Continue sem os parâmetros se houver erro
    }
    
    console.log('Parâmetros de busca:', { category, featured });
    
    // Filtrar notícias de acordo com os parâmetros
    let filteredNews = [...mockNews];
    
    if (category) {
      filteredNews = filteredNews.filter(news => news.category === category);
    }
    
    if (featured === 'true') {
      filteredNews = filteredNews.filter(news => news.featured);
    }
    
    console.log(`Retornando ${filteredNews.length} notícias de exemplo`);
    
    return NextResponse.json(filteredNews);
  } catch (error) {
    console.error('Erro ao obter notícias de exemplo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
