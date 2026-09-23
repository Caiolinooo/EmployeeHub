import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, paginacao } from '../_lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/templates — lista de templates (gate view). */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { page, limit, from, to } = paginacao(request.url);
    const { data, error, count } = await supabaseAdmin
      .from('fin_fatura_templates')
      .select('id, nome, tipo, mapping, is_default, is_active, created_at, updated_at', { count: 'exact' })
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) return finFail(error.message, 500);
    return finOk({
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    });
  } catch (e) {
    return finErro(e);
  }
}

/**
 * POST /api/financeiro/templates (multipart {nome, tipo, arquivo} — gate admin)
 * Upload do xlsx/html para o bucket privado financeiro-templates.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'admin');
    if (!gate.ok) return gate.error;

    const form = await request.formData();
    const nome = typeof form.get('nome') === 'string' ? (form.get('nome') as string).trim() : '';
    const tipo = typeof form.get('tipo') === 'string' ? (form.get('tipo') as string).trim() : '';
    const arquivo = form.get('arquivo') ?? form.get('file');
    if (!nome) return finFail('nome é obrigatório', 400);
    if (!['xlsx', 'html'].includes(tipo)) return finFail("tipo deve ser 'xlsx' ou 'html'", 400);
    if (!(arquivo instanceof File)) return finFail('arquivo é obrigatório', 400);
    if (tipo === 'xlsx' && !/\.xlsx$/i.test(arquivo.name)) return finFail('template xlsx deve ser .xlsx', 400);
    if (tipo === 'html' && !/\.html?$/i.test(arquivo.name)) return finFail('template html deve ser .html', 400);

    const buf = Buffer.from(await arquivo.arrayBuffer());
    const storagePath = `templates/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, '_')}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('financeiro-templates')
      .upload(storagePath, buf, { upsert: true });
    if (upErr) return finFail(`Falha no upload: ${upErr.message}`, 500);

    const mappingBruto = form.get('mapping');
    let mapping: Record<string, unknown> = {};
    if (typeof mappingBruto === 'string' && mappingBruto.trim()) {
      try {
        mapping = JSON.parse(mappingBruto);
      } catch {
        return finFail('mapping deve ser JSON válido', 400);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('fin_fatura_templates')
      .insert({ nome, tipo, storage_path: storagePath, mapping })
      .select('id, nome, tipo, mapping, is_default, is_active, created_at, updated_at')
      .single();
    if (error) return finFail(error.message, 500);
    return finOk(data, 201);
  } catch (e) {
    return finErro(e);
  }
}
