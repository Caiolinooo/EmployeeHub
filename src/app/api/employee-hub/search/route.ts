import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { searchEmployees } from '@/lib/employee-hub/employee-hub-service';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const cpf = searchParams.get('cpf') || undefined;
    const nome = searchParams.get('nome') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!cpf && !nome) {
      return NextResponse.json({ error: 'Informe cpf ou nome para busca' }, { status: 400 });
    }

    const results = await searchEmployees({ cpf, nome, limit });
    return NextResponse.json({ results, count: results.length });
  } catch (err: any) {
    console.error('[employee-hub/search] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
