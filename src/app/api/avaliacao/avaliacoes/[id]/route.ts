import { NextRequest, NextResponse } from 'next/server';
import {
  GET as getAvaliacaoDesempenho,
  PUT as putAvaliacaoDesempenho,
  DELETE as deleteAvaliacaoDesempenho,
} from '@/app/api/avaliacao-desempenho/avaliacoes/[id]/route';
import { delegateAvaliacaoById } from './alias';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Alias de /api/avaliacao/avaliacoes/[id] → handlers de avaliacao-desempenho.
 * Sem fetch HTTP e sem host derivado do request (fecha SSRF #99/#100/#101).
 */
async function handle(
  request: NextRequest,
  context: RouteContext,
  run: (request: NextRequest, context: RouteContext) => Promise<Response>,
): Promise<Response> {
  const { id } = await context.params;
  const result = await delegateAvaliacaoById(id, () => run(request, context));
  if (!result.delegated) {
    return NextResponse.json(result.body, { status: 400 });
  }
  return result.value;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context, getAvaliacaoDesempenho);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handle(request, context, putAvaliacaoDesempenho);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handle(request, context, deleteAvaliacaoDesempenho);
}
