import { NextRequest, NextResponse } from 'next/server';
import { initAvaliacaoModule } from '@/lib/avaliacao-module';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

/**
 * Rota para listar funcionários
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

    // Buscar todos os funcionários
    const funcionarios = await avaliacaoModule.getFuncionarios();

    return NextResponse.json({
      success: true,
      data: funcionarios,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao listar funcionários:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Rota para criar um novo funcionário
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
    if (!data.nome || !data.cargo || !data.departamento) {
      return NextResponse.json({
        success: false,
        error: 'Dados incompletos. Nome, cargo e departamento são obrigatórios.'
      }, { status: 400 });
    }

    // Criar funcionário
    const funcionario = await avaliacaoModule.createFuncionario({
      ...data,
      status: data.status || 'ativo',
      dataAdmissao: data.dataAdmissao || new Date().toISOString().split('T')[0]
    });

    return NextResponse.json({
      success: true,
      data: funcionario,
      message: 'Funcionário criado com sucesso',
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar funcionário:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
