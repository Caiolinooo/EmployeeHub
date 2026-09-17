import { NextRequest, NextResponse } from 'next/server';
import { generateLeaveFormPDF } from '@/lib/leavePDFGenerator';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leave/form-pdf
 *
 * Gera e retorna o formulário de solicitação de férias em BRANCO (sem
 * dados preenchidos) para impressão/preenchimento manual.
 *
 * Disponível para qualquer usuário autenticado — útil para o colaborador,
 * gerente e DP imprimirem e preencherem manualmente quando necessário.
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization') || undefined;
        const token = extractTokenFromHeader(authHeader);
        if (!token) {
            return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
        }
        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        const pdfBuffer = await generateLeaveFormPDF();

        const fileName = `Formulario_Ferias_ABZ_${new Date().toISOString().slice(0, 10)}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': String(pdfBuffer.length)
            }
        });
    } catch (error) {
        console.error('[Leave Form PDF] Erro ao gerar formulário:', error);
        return NextResponse.json({
            error: 'Erro interno ao gerar formulário de férias'
        }, { status: 500 });
    }
}
