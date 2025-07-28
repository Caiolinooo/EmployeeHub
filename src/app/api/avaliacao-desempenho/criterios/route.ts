import { NextRequest, NextResponse } from 'next/server';
import { initAvaliacaoModule } from '@/lib/avaliacao-module';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

/**
 * Rota para listar critérios de avaliação
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Inicializar o módulo
    const avaliacaoModule = await initAvaliacaoModule();

    // Obter parâmetros da URL
    const url = new URL(request.url);
    const categoria = url.searchParams.get('categoria');

    // Buscar critérios
    let criterios;
    if (categoria) {
      criterios = await avaliacaoModule.getCriteriosByCategoria(categoria);
    } else {
      criterios = await avaliacaoModule.getCriterios();
    }

    return NextResponse.json({
      success: true,
      data: criterios,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao obter critérios:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para criar um novo critério
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    // Inicializar o módulo
    const avaliacaoModule = await initAvaliacaoModule();

    // Obter dados do corpo da requisição
    const data = await request.json();

    // Validar dados
    if (!data.nome || !data.descricao || !data.categoria) {
      return NextResponse.json({
        success: false,
        error: 'Dados incompletos. Nome, descrição e categoria são obrigatórios.'
      }, { status: 400 });
    }

    // Criar critério
    const criterio = await avaliacaoModule.createCriterio({
      ...data,
      peso: data.peso || 1.0,
      notaMaxima: data.notaMaxima || 5
    });

    return NextResponse.json({
      success: true,
      data: criterio,
      message: 'Critério criado com sucesso',
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar critério:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
