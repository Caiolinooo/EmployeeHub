import { NextRequest, NextResponse } from 'next/server';
import { initAvaliacaoModule } from '@/lib/avaliacao-module';
import { verifyTokenFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * PUT - Atualizar critério
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await verifyTokenFromRequest(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const avaliacaoModule = await initAvaliacaoModule();
    const data = await request.json();
    const { id } = params;

    const criterio = await avaliacaoModule.updateCriterio(id, data);

    return NextResponse.json({
      success: true,
      data: criterio,
      message: 'Critério atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar critério:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * DELETE - Deletar critério
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await verifyTokenFromRequest(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const avaliacaoModule = await initAvaliacaoModule();
    const { id } = params;

    await avaliacaoModule.deleteCriterio(id);

    return NextResponse.json({
      success: true,
      message: 'Critério deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar critério:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
