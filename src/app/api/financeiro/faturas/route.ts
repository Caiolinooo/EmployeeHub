import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { criarFatura } from '@/lib/financeiro/service';
import { atorDeUserId } from '@/lib/financeiro/eventos';
import { finErro, finFail, finOk, corpoJson, paginacao } from '../_lib/http';
import { resolverEmpresaIdFiltro } from '../visao-geral/visao-geral';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/faturas?empresaId=&status=&clienteId=&ano=&page=&limit=
 * Lista paginada com nome do cliente.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const { page, limit, from, to } = paginacao(request.url);

    let query = supabaseAdmin
      .from('fin_faturas')
      .select('*, cliente:fin_clientes(id, nome, client_key)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    // 'todas'/'null'/'' = visão geral (sem filtro); uuid inválido = 400 (evita 500 do Postgres)
    const empresaFiltro = resolverEmpresaIdFiltro(searchParams.get('empresaId'));
    if (!empresaFiltro.ok) return finFail('empresaId inválido: informe um UUID ou "todas"', 400);
    if (empresaFiltro.empresaId) query = query.eq('empresa_id', empresaFiltro.empresaId);
    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);
    const clienteId = searchParams.get('clienteId');
    if (clienteId) query = query.eq('cliente_id', clienteId);
    const ano = searchParams.get('ano');
    if (ano) query = query.eq('ano', Number(ano));

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
 * POST /api/financeiro/faturas — cria fatura `rascunho` com nº sequencial
 * transacional por (empresa, ano) (§6).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'edit');
    if (!gate.ok) return gate.error;

    const body = await corpoJson(request);
    const itens = Array.isArray(body.itens) ? (body.itens as Record<string, unknown>[]) : [];
    const fatura = await criarFatura(
      {
        empresaId: String(body.empresaId || body.empresa_id || ''),
        clienteId: body.clienteId ? String(body.clienteId) : undefined,
        origemTipo: (String(body.origemTipo || body.origem_tipo || 'manual') as 'folha' | 'medicao' | 'manual'),
        payrollSheetId: body.payrollSheetId ? String(body.payrollSheetId) : undefined,
        competencia: body.competencia ? String(body.competencia) : undefined,
        templateId: body.templateId ? String(body.templateId) : undefined,
        moeda: body.moeda ? String(body.moeda) : undefined,
        dataVencimento: body.dataVencimento ? String(body.dataVencimento) : undefined,
        callOff: body.callOff ? String(body.callOff) : undefined,
        observacoes: body.observacoes ? String(body.observacoes) : undefined,
        condicaoPagamento: body.condicaoPagamento ? String(body.condicaoPagamento) : undefined,
        itens: itens.map((it) => ({
          descricao: String(it.descricao || ''),
          referencia: it.referencia ? String(it.referencia) : undefined,
          quantidade: it.quantidade != null ? Number(it.quantidade) : undefined,
          valor_unitario: Number(it.valor_unitario ?? it.valorUnitario ?? 0),
        })),
      },
      await atorDeUserId(gate.user.userId),
    );
    return finOk(fatura, 201);
  } catch (e) {
    return finErro(e);
  }
}
