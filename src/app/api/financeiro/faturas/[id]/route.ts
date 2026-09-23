import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { obterFatura } from '@/lib/financeiro/service';
import { podeCancelarFatura, podeEditarFatura, calcularItensFatura } from '@/lib/financeiro/regras-financeiro';
import { registrarEvento, atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk, corpoJson, texto } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/faturas/[id] — fatura + itens. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    return finOk(await obterFatura(id));
  } catch (e) {
    return finErro(e);
  }
}

/** PUT /api/financeiro/faturas/[id] — parcial, só `rascunho` (§6). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const fatura = await obterFatura(id);
    if (!podeEditarFatura(fatura.status)) {
      return finFail(`Fatura em status '${fatura.status}' não pode ser editada`, 409);
    }

    const body = await corpoJson(request);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('clienteId' in body) updates.cliente_id = texto(body.clienteId) || null;
    if ('templateId' in body) updates.template_id = texto(body.templateId) || null;
    if ('moeda' in body) updates.moeda = (texto(body.moeda) || 'BRL').toUpperCase();
    if ('dataVencimento' in body) updates.data_vencimento = texto(body.dataVencimento) || null;
    if ('callOff' in body) updates.call_off = texto(body.callOff) || null;
    if ('observacoes' in body) updates.observacoes = texto(body.observacoes) || null;
    if ('condicaoPagamento' in body) updates.condicao_pagamento = texto(body.condicaoPagamento) || null;
    if ('competencia' in body) {
      const comp = texto(body.competencia);
      if (comp && !/^\d{4}-\d{2}$/.test(comp)) return finFail('competencia deve ser YYYY-MM', 400);
      updates.competencia_ano = comp ? Number(comp.slice(0, 4)) : null;
      updates.competencia_mes = comp ? Number(comp.slice(5, 7)) : null;
    }

    // Itens: lista completa substitui a existente (totais recalculados).
    if ('itens' in body) {
      const calculo = calcularItensFatura((body.itens as Record<string, unknown>[]) || []);
      if (!calculo.ok) return finFail(calculo.erro, 400);
      updates.valor_total = calculo.total;
      await supabaseAdmin.from('fin_fatura_itens').delete().eq('fatura_id', id);
      await supabaseAdmin.from('fin_fatura_itens').insert(
        calculo.itens.map((it, i) => ({
          fatura_id: id,
          ordem: i,
          descricao: it.descricao,
          referencia: (it as unknown as { referencia?: string }).referencia || null,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_total: it.valor_total,
          origem: 'manual',
        })),
      );
    }

    const { error } = await supabaseAdmin.from('fin_faturas').update(updates).eq('id', id);
    if (error) return finFail(error.message, 500);
    return finOk(await obterFatura(id));
  } catch (e) {
    return finErro(e);
  }
}

/**
 * DELETE /api/financeiro/faturas/[id] — status=cancelada; 409 se não
 * rascunho/emitida (§6). Evento fatura.cancelada.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const fatura = await obterFatura(id);
    if (!podeCancelarFatura(fatura.status)) {
      return finFail(`Fatura em status '${fatura.status}' não pode ser cancelada`, 409);
    }
    const { error } = await supabaseAdmin
      .from('fin_faturas')
      .update({ status: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return finFail(error.message, 500);
    await registrarEvento({
      entidade: 'fatura',
      entidadeId: id,
      tipo: 'fatura.cancelada',
      payload: { numero: fatura.numero, ano: fatura.ano },
      ator: await atorDeUserId(gate.user.userId),
    });
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
