import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getEmployeeFullRecord } from '@/lib/employee-hub/employee-hub-service';
import { usuarioPodeVerColaborador } from '@/lib/gestao-tripulantes/empresa-acesso';
import { MENSAGEM_DOCUMENTOS_RESTRITOS } from '@/lib/gestao-tripulantes/documento-escopo';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ID do colaborador obrigatório' }, { status: 400 });
    }
    if (!(await usuarioPodeVerColaborador({ id: payload.userId, role: payload.role }, id))) {
      return NextResponse.json({ error: MENSAGEM_DOCUMENTOS_RESTRITOS }, { status: 403 });
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
