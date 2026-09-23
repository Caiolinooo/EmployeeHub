import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson } from '../../_lib/http';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/financeiro/templates/[id] — mapping, default, ativo (gate admin).
 * is_default=true desmarca os demais (unicidade do default).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const body = await corpoJson(request);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('nome' in body) updates.nome = String(body.nome || '').trim();
    if ('mapping' in body) {
      if (body.mapping != null && (typeof body.mapping !== 'object' || Array.isArray(body.mapping))) {
        return finFail('mapping deve ser objeto JSONB', 400);
      }
      updates.mapping = body.mapping ?? {};
    }
    if ('is_active' in body) updates.is_active = body.is_active === true;
    if (body.is_default === true) {
      await supabaseAdmin
        .from('fin_fatura_templates')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .neq('id', id);
      updates.is_default = true;
    } else if (body.is_default === false) {
      updates.is_default = false;
    }

    const { data, error } = await supabaseAdmin
      .from('fin_fatura_templates')
      .update(updates)
      .eq('id', id)
      .select('id, nome, tipo, mapping, is_default, is_active, created_at, updated_at')
      .maybeSingle();
    if (error) return finFail(error.message, 500);
    if (!data) return finFail('Template não encontrado', 404);
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}

/** DELETE /api/financeiro/templates/[id] — soft-delete (gate admin). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('fin_fatura_templates')
      .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return finFail(error.message, 500);
    return finOk({ ok: true });
  } catch (e) {
    return finErro(e);
  }
}
