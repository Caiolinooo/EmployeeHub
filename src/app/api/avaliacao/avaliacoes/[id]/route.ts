import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Rota para redirecionar requisições de /api/avaliacao/avaliacoes/[id] para /api/avaliacao-desempenho/avaliacoes/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`API avaliacao/avaliacoes GET: Redirecionando requisição para avaliacao-desempenho/avaliacoes/${id}`);

    // Construir a URL para o redirecionamento
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUrl = `${baseUrl}/api/avaliacao-desempenho/avaliacoes/${id}`;

    // Preservar os cabeçalhos de autorização
    const headers = new Headers();
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers.set('authorization', authHeader);
    }

    // Fazer a requisição para a API correta
    const response = await fetch(redirectUrl, {
      method: 'GET',
      headers
    });

    // Retornar a resposta da API correta
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Erro ao redirecionar requisição de avaliação:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para redirecionar requisições PUT de /api/avaliacao/avaliacoes/[id] para /api/avaliacao-desempenho/avaliacoes/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`API avaliacao/avaliacoes PUT: Redirecionando requisição para avaliacao-desempenho/avaliacoes/${id}`);

    // Construir a URL para o redirecionamento
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUrl = `${baseUrl}/api/avaliacao-desempenho/avaliacoes/${id}`;

    // Preservar os cabeçalhos de autorização
    const headers = new Headers();
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers.set('authorization', authHeader);
    }
    headers.set('Content-Type', 'application/json');

    // Obter o corpo da requisição
    const body = await request.json();

    // Fazer a requisição para a API correta
    const response = await fetch(redirectUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    // Retornar a resposta da API correta
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Erro ao redirecionar requisição de atualização de avaliação:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para redirecionar requisições DELETE de /api/avaliacao/avaliacoes/[id] para /api/avaliacao-desempenho/avaliacoes/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);

    // Validar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('ID inválido, não é um UUID válido:', id);
      return NextResponse.json({
        success: false,
        error: 'ID inválido. O ID deve ser um UUID válido.',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`API avaliacao/avaliacoes DELETE: Redirecionando requisição para avaliacao-desempenho/avaliacoes/${id}`);

    // Construir a URL para o redirecionamento
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUrl = `${baseUrl}/api/avaliacao-desempenho/avaliacoes/${id}`;

    // Preservar os cabeçalhos de autorização
    const headers = new Headers();
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers.set('authorization', authHeader);
    }

    // Fazer a requisição para a API correta
    const response = await fetch(redirectUrl, {
      method: 'DELETE',
      headers
    });

    // Retornar a resposta da API correta
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Erro ao redirecionar requisição de exclusão de avaliação:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
