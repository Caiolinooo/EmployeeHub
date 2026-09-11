import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getEmployeeFullRecord } from '@/lib/employee-hub/employee-hub-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ID do colaborador obrigatório' }, { status: 400 });
    }

    const record = await getEmployeeFullRecord(id);
    if (!record) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (err: any) {
    console.error('[employee-hub] Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
