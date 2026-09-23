import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payroll/sheets/[id]/reabrir  (design §2)
 * Reabre uma folha 'approved' para correção: volta para 'calculated', limpa
 * approved_by/approved_at e a aprovação (assinaturas) — o ciclo de assinatura
 * recomeça do zero. Justificativa obrigatória, gravada em payroll_audit_log
 * (origem_evento='reabertura') com o before/after da folha.
 * Gate: folha.approve ou ADMIN (garantirNivelPayroll 'approve').
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelPayroll(request, 'approve');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { justificativa?: string };
    const justificativa = (body.justificativa || '').trim();
    if (justificativa.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Justificativa obrigatória (mínimo 5 caracteres) para reabrir a folha' },
        { status: 400 },
      );
    }

    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from('payroll_sheets')
      .select('id, status, reference_month, reference_year, company_id, approved_by, approved_at, aprovacao')
      .eq('id', id)
      .maybeSingle();
    if (sheetError) {
      console.error('[API payroll/reabrir] sheet:', sheetError);
      return NextResponse.json({ success: false, error: 'Erro ao carregar a folha' }, { status: 500 });
    }
    if (!sheet) {
      return NextResponse.json({ success: false, error: 'Folha não encontrada' }, { status: 404 });
    }
    if (sheet.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: `Apenas folhas aprovadas podem ser reabertas (status atual: ${sheet.status})` },
        { status: 409 },
      );
    }

    const agora = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('payroll_sheets')
      .update({
        status: 'calculated',
        approved_by: null,
        approved_at: null,
        aprovacao: null,
        updated_at: agora,
      })
      .eq('id', id)
      .eq('status', 'approved'); // guarda otimista: outra sessão já mexeu → 0 linhas
    if (updateError) {
      console.error('[API payroll/reabrir] update:', updateError);
      return NextResponse.json({ success: false, error: 'Erro ao reabrir a folha' }, { status: 500 });
    }

    // Auditoria best-effort (mesmo padrão de gravarAuditoriaFolha) — nunca bloqueia.
    try {
      await supabaseAdmin.from('payroll_audit_log').insert({
        table_name: 'payroll_sheets',
        record_id: id,
        action: 'UPDATE',
        old_values: {
          status: sheet.status,
          approved_by: sheet.approved_by,
          approved_at: sheet.approved_at,
          aprovacao: sheet.aprovacao,
        },
        new_values: {
          status: 'calculated',
          origem_evento: 'reabertura',
          justificativa,
        },
        changed_by: gate.user.userId || null,
      });
    } catch (err) {
      console.error('[payroll] falha ao gravar payroll_audit_log da reabertura (best-effort):', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        sheetId: id,
        status: 'calculated',
        competencia: `${String(sheet.reference_month).padStart(2, '0')}/${sheet.reference_year}`,
      },
    });
  } catch (error) {
    console.error('[API payroll/reabrir Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao reabrir a folha' },
      { status: 500 },
    );
  }
}
