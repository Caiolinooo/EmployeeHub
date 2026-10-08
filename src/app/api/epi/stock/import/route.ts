/**
 * POST /api/epi/stock/import
 * Import stock data from an AN-CPR-003 format .xlsx spreadsheet.
 * Expects multipart/form-data with a file field named "file".
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { podeGerenciarEpi } from '@/lib/epi-access';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { parseStockSpreadsheet, importStockFromSpreadsheet } from '@/services/stockImportExport';

export async function POST(request: NextRequest) {
    try {
        // Auth check — only admins/managers
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);
        if (!token) {
            const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
            if (tokenCookie) token = tokenCookie.value;
        }
        if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || !payload.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

        const role = payload.role || 'USER';
        if (!(await podeGerenciarEpi(payload.userId, role, 'stock.import'))) {
            return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
        }

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            return NextResponse.json({ error: 'Formato de arquivo inválido. Use .xlsx ou .xls' }, { status: 400 });
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();

        // Parse spreadsheet
        const rows = parseStockSpreadsheet(arrayBuffer);

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Nenhum dado encontrado na planilha' }, { status: 400 });
        }

        // Import into database
        const result = await importStockFromSpreadsheet(rows, payload.userId);

        return NextResponse.json({
            success: true,
            message: `Importação concluída: ${result.created} criados, ${result.updated} atualizados, ${result.skipped} sem alteração`,
            data: result,
        });
    } catch (error: any) {
        console.error('❌ Stock import error:', error);
        return NextResponse.json(
            { error: error.message || 'Erro ao importar planilha' },
            { status: 500 }
        );
    }
}
