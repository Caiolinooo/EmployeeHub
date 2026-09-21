import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import {
  ErroAprovacaoFolha,
  assinarSheet,
  carregarEstadoAprovacao,
  iniciarAprovacaoSheet,
  rejeitarSheet,
} from '@/lib/payroll/aprovacao';

export const dynamic = 'force-dynamic';

/** IP do cliente para o carimbo da assinatura (padrão x-forwarded-for). */
function ipFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'internal';
}

function erroParaResposta(error: unknown) {
  if (error instanceof ErroAprovacaoFolha) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('[API payroll/aprovacao Error]', error);
  return NextResponse.json(
    { success: false, error: 'Erro ao processar aprovação da folha' },
    { status: 500 },
  );
}

/**
 * GET /api/payroll/sheets/[id]/aprovacao
 * Estado da aprovação + faltantes. Sheet precisa estar 'calculated'
 * (em aprovação) ou 'approved' (consulta do resultado final).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelPayroll(request, 'view');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const estado = await carregarEstadoAprovacao(id);

    if (!estado.aprovado && estado.sheet.status !== 'calculated') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Aprovação disponível apenas para folhas no status "calculated" (ou já aprovadas).',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sheet: {
          id: estado.sheet.id,
          status: estado.sheet.status,
          reference_month: estado.sheet.reference_month,
          reference_year: estado.sheet.reference_year,
          company_id: estado.sheet.company_id,
          department_id: estado.sheet.department_id,
          total_gross: estado.sheet.total_gross,
          total_net: estado.sheet.total_net,
          approved_by: estado.sheet.approved_by,
          approved_at: estado.sheet.approved_at,
        },
        aprovacao: estado.aprovacao,
        pendentes: estado.pendentes,
        assinados: estado.assinados,
        obrigatorios: estado.obrigatorios,
        todosAssinaram: estado.todosAssinaram,
        aprovado: estado.aprovado,
        hash: estado.aprovacao?.hash ?? null,
      },
    });
  } catch (error) {
    return erroParaResposta(error);
  }
}

/**
 * POST /api/payroll/sheets/[id]/aprovacao
 * Sem `aprovacao` iniciada → inicia (limpa rejeição/zera assinaturas no reenvio).
 * Com `signature_url` no corpo → registra a assinatura do usuário autenticado;
 * ao atingir 100% a sheet vira 'approved' (approved_by/approved_at + hash final).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelPayroll(request, 'approve');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      signature_url?: string;
      signatureUrl?: string;
    };
    const signatureUrl = body.signature_url || body.signatureUrl || '';

    const estado = await carregarEstadoAprovacao(id);
    if (!estado.aprovado && estado.sheet.status !== 'calculated') {
      return NextResponse.json(
        { success: false, error: 'A folha precisa estar no status "calculated" para entrar em aprovação.' },
        { status: 409 },
      );
    }

    // Inicia/reinicia a aprovação (idempotente: reenvio zera assinaturas e rejeição).
    if (!estado.aprovacao) {
      await iniciarAprovacaoSheet(id, { userId: gate.user.userId });
    }

    // Sem assinatura no corpo: apenas iniciou — devolve o estado atual.
    if (!signatureUrl) {
      const depois = await carregarEstadoAprovacao(id);
      return NextResponse.json({
        success: true,
        data: {
          aprovado: depois.aprovado,
          pendentes: depois.pendentes,
          assinados: depois.assinados,
          obrigatorios: depois.obrigatorios,
          aprovacao: depois.aprovacao,
          hash: depois.aprovacao?.hash ?? null,
        },
      });
    }

    const resultado = await assinarSheet(id, {
      userId: gate.user.userId,
      role: gate.user.role,
      signatureUrl,
      ip: ipFromRequest(request),
    });

    return NextResponse.json({
      success: true,
      data: {
        aprovado: resultado.aprovado,
        pendentes: resultado.pendentes,
        aprovacao: resultado.aprovacao,
        hash: resultado.hash,
      },
    });
  } catch (error) {
    return erroParaResposta(error);
  }
}

/**
 * DELETE /api/payroll/sheets/[id]/aprovacao — rejeição.
 * Corpo { motivo }: grava aprovacao.rejeicao; a sheet permanece 'calculated'.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelPayroll(request, 'approve');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { motivo?: string };
    const motivo = String(body.motivo || '').trim();
    if (!motivo) {
      return NextResponse.json(
        { success: false, error: 'Motivo da rejeição é obrigatório' },
        { status: 400 },
      );
    }

    const aprovacao = await rejeitarSheet(id, {
      userId: gate.user.userId,
      role: gate.user.role,
      motivo,
    });

    return NextResponse.json({ success: true, data: { aprovacao, status: 'calculated' } });
  } catch (error) {
    return erroParaResposta(error);
  }
}
