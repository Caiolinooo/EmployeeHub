import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { resolveAuthUserId, tokenFromRequest } from '@/lib/payroll/payroll-auth';
import { renderContracheque } from '@/lib/payroll/contracheque';
import { renderContrachequePdf } from '@/lib/payroll/contracheque-pdf';
import {
  carregarDadosContracheque,
  carregarUsuarioPortal,
  resolverFuncionariosDoUsuario,
} from '@/lib/payroll/contracheque-self';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracheque/[sheetId] — contracheque do PRÓPRIO usuário logado.
 * Default: HTML (text/html, padrão A4). `?pdf=1`: PDF nativo pdfkit
 * (application/pdf, attachment). 403 quando a sheet não pertence ao usuário
 * (sem resumo calculado para um payroll_employees vinculado — ver
 * contracheque-self.ts); 404 quando a sheet não existe para o usuário.
 */
export async function GET(
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

    const funcionarios = await resolverFuncionariosDoUsuario(usuario);
    // Dono = sheet tem resumo calculado para um funcionário vinculado ao
    // usuário (match CPF do perfil/GT — contracheque-self.ts). Senão 403.
    let dados = null;
    for (const f of funcionarios) {
      dados = await carregarDadosContracheque(sheetId, f.id);
      if (dados) break;
    }
    if (!dados) {
      return NextResponse.json(
        { success: false, error: 'Contracheque não encontrado para este usuário.' },
        { status: 403 },
      );
    }

    const querPdf = new URL(request.url).searchParams.get('pdf') === '1';
    if (querPdf) {
      const pdf = await renderContrachequePdf(dados);
      const nomeArquivo = `contracheque-${dados.competencia.replace('/', '-')}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        },
      });
    }

    return new NextResponse(renderContracheque(dados), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
