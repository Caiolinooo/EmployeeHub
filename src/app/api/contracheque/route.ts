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
 * GET /api/contracheque — competências de contracheque do PRÓPRIO usuário
 * logado (design §2). Vínculo: users_unified → CPF (perfil/GT) →
 * payroll_employees (ver contracheque-self.ts). Lista apenas folhas
 * approved/paid com resumo calculado + flag aceito_em do aceite.
 * Retorna { success, data: [{ sheet_id, mes, ano, competencia, empresa, status, aceito_em }] }.
 */
export async function GET(request: NextRequest) {
  const token = tokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token de autorização necessário' }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
  }

  try {
    const usuario = await carregarUsuarioPortal(resolveAuthUserId(payload));
    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 401 });
    }

    const funcionarios = await resolverFuncionariosDoUsuario(usuario);
    if (funcionarios.length === 0) {
      // Sem vínculo payroll_employees ↔ usuário: lista vazia (não é erro).
      return NextResponse.json({ success: true, data: [] });
    }
    const empIds = funcionarios.map((f) => f.id);

    const { data: summaries, error: erroSummaries } = await supabaseAdmin
      .from('payroll_employee_summaries')
      .select(
        'sheet_id, employee_id, payroll_sheets!inner(id, reference_month, reference_year, status, payroll_companies(name, cnpj))',
      )
      .in('employee_id', empIds)
      .in('payroll_sheets.status', ['approved', 'paid']);
    if (erroSummaries) {
      return NextResponse.json({ success: false, error: erroSummaries.message }, { status: 500 });
    }

    const sheetIds = [...new Set((summaries || []).map((s) => s.sheet_id as string))];
    const aceitesPorSheet = new Map<string, string>();
    if (sheetIds.length > 0) {
      const { data: aceites, error: erroAceites } = await supabaseAdmin
        .from('payroll_contracheque_aceites')
        .select('sheet_id, aceito_em')
        .in('sheet_id', sheetIds)
        .in('employee_id', empIds);
      if (erroAceites) {
        return NextResponse.json({ success: false, error: erroAceites.message }, { status: 500 });
      }
      for (const a of aceites || []) {
        if (a.aceito_em) aceitesPorSheet.set(a.sheet_id as string, a.aceito_em as string);
      }
    }

    const lista = (summaries || []).map((s) => {
      const sheet = s.payroll_sheets as unknown as {
        id: string;
        reference_month: number;
        reference_year: number;
        status: string;
        payroll_companies: { name: string; cnpj: string } | null;
      };
      const mes = Number(sheet.reference_month);
      const ano = Number(sheet.reference_year);
      return {
        sheet_id: s.sheet_id as string,
        mes,
        ano,
        competencia: `${String(mes).padStart(2, '0')}/${ano}`,
        empresa: {
          nome: sheet.payroll_companies?.name || 'Empresa',
          cnpj: sheet.payroll_companies?.cnpj || '',
        },
        status: sheet.status,
        aceito_em: aceitesPorSheet.get(sheet.id) || null,
      };
    });
    lista.sort((a, b) => b.ano - a.ano || b.mes - a.mes);

    return NextResponse.json({ success: true, data: lista });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
