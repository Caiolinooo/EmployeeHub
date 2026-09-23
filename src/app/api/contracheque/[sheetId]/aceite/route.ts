import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { resolveAuthUserId, tokenFromRequest } from '@/lib/payroll/payroll-auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  carregarUsuarioPortal,
  resolverFuncionariosDoUsuario,
} from '@/lib/payroll/contracheque-self';

export const dynamic = 'force-dynamic';

/**
 * Carimbo do aceite (payload employee+sheet+timestamp — design §1 000002),
 * SHA-256 hex no padrão src/lib/payroll/aprovacao.ts:
 * 'CONTRACHEQUE:competencia:sheetId:employeeId:nome:cpf:dataIso:ip'.
 */
function montarHashAceite(input: {
  competencia: string;
  sheetId: string;
  employeeId: string;
  nome: string;
  cpf: string;
  dataIso: string;
  ip: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      `CONTRACHEQUE:${input.competencia}:${input.sheetId}:${input.employeeId}:${input.nome}:${input.cpf}:${input.dataIso}:${input.ip}`,
    )
    .digest('hex');
}

/**
 * POST /api/contracheque/[sheetId]/aceite — grava o aceite/assinatura do
 * contracheque pelo próprio funcionário (hash SHA-256 + IP + user-agent).
 * Idempotente: já aceito → 200 com o registro existente (não erro).
 * 403 quando a sheet não pertence ao usuário (mesma regra do GET).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const token = tokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token de autorização necessário' }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
  }

  try {
    const { sheetId } = await params;
    const usuario = await carregarUsuarioPortal(resolveAuthUserId(payload));
    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 401 });
    }

    // Dono = funcionário vinculado ao usuário com resumo nesta sheet.
    const funcionarios = await resolverFuncionariosDoUsuario(usuario);
    if (funcionarios.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contracheque não encontrado para este usuário.' },
        { status: 403 },
      );
    }
    const empIds = funcionarios.map((f) => f.id);
    const { data: summary } = await supabaseAdmin
      .from('payroll_employee_summaries')
      .select('sheet_id, employee_id')
      .eq('sheet_id', sheetId)
      .in('employee_id', empIds)
      .maybeSingle();
    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Contracheque não encontrado para este usuário.' },
        { status: 403 },
      );
    }
    const employeeId = summary.employee_id as string;
    const funcionario = funcionarios.find((f) => f.id === employeeId);

    // Idempotência: aceite existente (UNIQUE sheet_id+employee_id) → 200.
    const { data: existente } = await supabaseAdmin
      .from('payroll_contracheque_aceites')
      .select('id, aceito_em, assinatura_hash')
      .eq('sheet_id', sheetId)
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (existente) {
      return NextResponse.json({
        success: true,
        data: {
          aceito_em: existente.aceito_em,
          assinatura_hash: existente.assinatura_hash,
          ja_aceito: true,
        },
      });
    }

    const { data: sheet } = await supabaseAdmin
      .from('payroll_sheets')
      .select('reference_month, reference_year')
      .eq('id', sheetId)
      .maybeSingle();
    const competencia = sheet
      ? `${String(sheet.reference_month).padStart(2, '0')}/${sheet.reference_year}`
      : '';

    const agoraIso = new Date().toISOString();
    const ip =
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'desconhecido';
    const userAgent = request.headers.get('user-agent') || '';
    const hash = montarHashAceite({
      competencia,
      sheetId,
      employeeId,
      nome: funcionario?.name || usuario.nome,
      cpf: funcionario?.cpf || usuario.cpf,
      dataIso: agoraIso,
      ip,
    });

    const { data: aceite, error: erroInsert } = await supabaseAdmin
      .from('payroll_contracheque_aceites')
      .insert({
        sheet_id: sheetId,
        employee_id: employeeId,
        user_id: usuario.id,
        aceito_em: agoraIso,
        assinatura_hash: hash,
        ip,
        user_agent: userAgent,
      })
      .select('id, aceito_em, assinatura_hash')
      .single();
    if (erroInsert) {
      // Corrida: outro request gravou primeiro → devolve o existente.
      if (erroInsert.code === '23505') {
        const { data: concorrente } = await supabaseAdmin
          .from('payroll_contracheque_aceites')
          .select('id, aceito_em, assinatura_hash')
          .eq('sheet_id', sheetId)
          .eq('employee_id', employeeId)
          .maybeSingle();
        if (concorrente) {
          return NextResponse.json({
            success: true,
            data: {
              aceito_em: concorrente.aceito_em,
              assinatura_hash: concorrente.assinatura_hash,
              ja_aceito: true,
            },
          });
        }
      }
      return NextResponse.json({ success: false, error: erroInsert.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        aceito_em: aceite.aceito_em,
        assinatura_hash: aceite.assinatura_hash,
        ja_aceito: false,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
