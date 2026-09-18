import { NextRequest, NextResponse } from 'next/server';
import { analisarPlanilha } from '@/lib/indicadores/xlsx-import';
import { garantirNivelIndicadores } from '@/lib/indicadores/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/indicadores/import/analyze
 * FormData { arquivo: File } → prévia das abas (cabeçalho detectado, colunas
 * tipadas e linhas) SEM gravar nada. Gate: podeImportarIndicadores.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelIndicadores(request, 'import');
    if (gate.error) return gate.error;

    const form = await request.formData();
    const arquivo = form.get('arquivo');
    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Arquivo .xlsx é obrigatório (campo "arquivo")' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const analise = analisarPlanilha(buffer, { arquivoNome: arquivo.name });

    if (analise.abas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma aba com cabeçalho detectado no arquivo' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: analise });
  } catch (error) {
    console.error('[indicadores import/analyze]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao analisar planilha' },
      { status: 500 },
    );
  }
}
