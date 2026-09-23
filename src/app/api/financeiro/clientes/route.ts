import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finFail, finOk, corpoJson, paginacao, texto } from '../_lib/http';
import type { FinCliente } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/clientes?empresaId=&busca=&page=&limit=
 * Lista paginada de clientes de faturação (fin_clientes).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const busca = searchParams.get('busca');
    const ativo = searchParams.get('isActive');
    const { page, limit, from, to } = paginacao(request.url);

    let query = supabaseAdmin
      .from('fin_clientes')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(from, to);
    if (empresaId) query = query.eq('empresa_id', empresaId);
    if (busca) query = query.or(`nome.ilike.%${busca}%,client_key.ilike.%${busca}%,documento.ilike.%${busca}%`);
    if (ativo === 'true' || ativo === 'false') query = query.eq('is_active', ativo === 'true');

    const { data, error, count } = await query;
    if (error) return finFail(error.message, 500);

    return NextResponse.json({
      success: true,
      data: {
        items: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
    });
  } catch (e) {
    return finErro(e);
  }
}

/**
 * POST /api/financeiro/clientes — cria cliente (gate edit).
 * UNIQUE (empresa_id, client_key) → 409 cliente_key_duplicada.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const empresaId = texto(body.empresa_id ?? body.empresaId);
    const clientKey = texto(body.client_key ?? body.clientKey);
    const nome = texto(body.nome);
    if (!empresaId || !clientKey || !nome) {
      return finFail('empresa_id, client_key e nome são obrigatórios', 400);
    }

    const { data: existente } = await supabaseAdmin
      .from('fin_clientes')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('client_key', clientKey)
      .maybeSingle();
    if (existente) return finFail('client_key já existe para esta empresa', 409);

    const registro = {
      empresa_id: empresaId,
      client_key: clientKey,
      nome,
      documento: texto(body.documento) || null,
      email: texto(body.email) || null,
      endereco: (body.endereco ?? null) as Record<string, unknown> | null,
      moeda: (texto(body.moeda) || 'BRL').toUpperCase(),
      condicao_pagamento: texto(body.condicao_pagamento ?? body.condicaoPagamento) || null,
      categoria: texto(body.categoria) || null,
      subcategoria: texto(body.subcategoria) || null,
      metadados: (body.metadados ?? {}) as Record<string, unknown>,
      is_active: body.is_active !== false,
    };
    const { data, error } = await supabaseAdmin
      .from('fin_clientes')
      .insert(registro)
      .select('*')
      .single();
    if (error) return finFail(error.message, 500);
    return finOk(data as FinCliente, 201);
  } catch (e) {
    return finErro(e);
  }
}
