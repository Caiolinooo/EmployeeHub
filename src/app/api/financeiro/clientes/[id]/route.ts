import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, texto } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/clientes/[id] — registro (gate view). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('fin_clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Cliente não encontrado', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}

/** PUT /api/financeiro/clientes/[id] — atualização parcial (gate edit). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const body = await corpoJson(request);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('nome' in body) {
      const nome = texto(body.nome);
      if (!nome) return finFail('nome não pode ser vazio', 400);
      updates.nome = nome;
    }
    if ('client_key' in body || 'clientKey' in body) {
      const key = texto(body.client_key ?? body.clientKey);
      if (!key) return finFail('client_key não pode ser vazio', 400);
      updates.client_key = key;
    }
    for (const campo of ['documento', 'email', 'condicao_pagamento', 'categoria', 'subcategoria'] as const) {
      if (campo in body) updates[campo] = texto(body[campo]) || null;
    }
    if ('condicaoPagamento' in body) updates.condicao_pagamento = texto(body.condicaoPagamento) || null;
    if ('endereco' in body) updates.endereco = body.endereco ?? null;
    if ('metadados' in body) updates.metadados = body.metadados ?? {};
    if ('moeda' in body) updates.moeda = (texto(body.moeda) || 'BRL').toUpperCase();
    if ('is_active' in body) updates.is_active = body.is_active === true;

    const { data, error } = await supabaseAdmin
      .from('fin_clientes')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Cliente não encontrado', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}

/**
 * DELETE /api/financeiro/clientes/[id] — com faturas vinculadas vira soft-delete
 * (is_active=false); sem faturas, remove de fato (gate edit).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const { count } = await supabaseAdmin
      .from('fin_faturas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', id);
    if ((count || 0) > 0) {
      const { error } = await supabaseAdmin
        .from('fin_clientes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return finFail(error.message, 500);
      return finOk({ ok: true, modo: 'desativado' });
    }
    const { error } = await supabaseAdmin.from('fin_clientes').delete().eq('id', id);
    if (error) return finFail(error.message, 500);
    return finOk({ ok: true, modo: 'removido' });
  } catch (e) {
    return finErro(e);
  }
}
