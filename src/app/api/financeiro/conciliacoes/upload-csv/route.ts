import { NextRequest } from 'next/server';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { importarConciliacoes } from '@/lib/financeiro/service';
import { parseCsvExtrato } from '@/lib/financeiro/banks/csv-extrato';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk, texto } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/conciliacoes/upload-csv (multipart {contaBancariaId,
 * arquivo}) — parser XP genérico (banks/csv-extrato.ts) → movimentos →
 * importação com casamento automático (§6).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const form = await request.formData();
    const contaField = form.get('contaBancariaId') ?? form.get('conta_bancaria_id');
    const contaBancariaId = texto(contaField);
    const arquivo = form.get('arquivo') ?? form.get('file');
    if (!contaBancariaId) return finFail('contaBancariaId é obrigatório', 400);
    if (!(arquivo instanceof File)) return finFail('arquivo CSV é obrigatório', 400);

    const conteudo = await arquivo.text();
    let movimentos;
    try {
      movimentos = parseCsvExtrato(conteudo);
    } catch (e) {
      return finFail(`CSV inválido: ${(e as Error).message}`, 400);
    }
    if (movimentos.length === 0) return finFail('CSV sem movimentos reconhecidos', 400);

    const resultado = await importarConciliacoes(
      { contaBancariaId, movimentos, origem: 'csv' },
      await atorDeUserId(gate.user.userId),
    );
    return finOk(resultado);
  } catch (e) {
    return finErro(e);
  }
}
