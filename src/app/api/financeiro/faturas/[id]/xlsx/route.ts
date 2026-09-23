import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { renderFaturaXlsx } from '@/lib/financeiro/invoice/render-xlsx';
import { montarFaturaRenderInput } from '../../../_lib/render-input';
import { finErro, finFail } from '../../../_lib/http';
import type { FaturaTemplateDef } from '@/lib/financeiro/invoice/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/faturas/[id]/xlsx — renderiza o template xlsx da fatura
 * (template_id da fatura, ou o template default) a partir do bucket
 * financeiro-templates (§6).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    const { id } = await params;

    const input = await montarFaturaRenderInput(id);

    const { data: faturaRow } = await supabaseAdmin
      .from('fin_faturas')
      .select('template_id')
      .eq('id', id)
      .maybeSingle();
    const templateId = (faturaRow as { template_id: string | null } | null)?.template_id;

    let query = supabaseAdmin
      .from('fin_fatura_templates')
      .select('id, nome, tipo, storage_path, mapping')
      .eq('is_active', true)
      .limit(1);
    query = templateId ? query.eq('id', templateId) : query.eq('is_default', true);
    const { data: template } = await query.maybeSingle();
    if (!template) return finFail('Nenhum template xlsx configurado para a fatura', 404);

    const t = template as { id: string; nome: string; tipo: string; storage_path: string; mapping: FaturaTemplateDef['mapping'] };
    if (t.tipo !== 'xlsx') return finFail('Template da fatura não é xlsx', 409);

    const buffer = await renderFaturaXlsx(input, { storagePath: t.storage_path, tipo: 'xlsx', mapping: t.mapping });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="fatura-${input.fatura.numero}-${input.fatura.ano}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return finErro(e);
  }
}
