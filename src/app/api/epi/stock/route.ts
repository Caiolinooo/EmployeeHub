import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import {
    getStockLevels,
    getStockStats,
    getStockMovements,
    addStockEntry,
    deductStock,
    adjustStock,
    returnStock,
    updateStockConfig,
    initializeStockForAllTypes,
    getLowStockAlerts,
} from '@/services/epiStockService';
import { supabaseAdmin } from '@/lib/db';
import { podeGerenciarEpi } from '@/lib/epi-access';

export const dynamic = 'force-dynamic';

// Helper: authenticate and check EPI admin access
async function authenticateAndAuthorize(request: NextRequest, acao: 'stock.view' | 'stock.edit') {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
        const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
        if (tokenCookie) token = tokenCookie.value;
    }

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload || !payload.userId) return null;

    const role = payload.role || 'USER';
    return (await podeGerenciarEpi(payload.userId, role, acao)) ? payload : null;
}

/**
 * GET /api/epi/stock
 * List stock levels, stats, movements, or alerts
 */
export async function GET(request: NextRequest) {
    try {
        const payload = await authenticateAndAuthorize(request, 'stock.view');
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const view = searchParams.get('view') || 'levels'; // levels | stats | movements | alerts
        const epiTypeId = searchParams.get('epiTypeId') || undefined;
        const limit = parseInt(searchParams.get('limit') || '50');
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;

        switch (view) {
            case 'stats': {
                const stats = await getStockStats();
                return NextResponse.json({ success: true, data: stats });
            }
            case 'movements': {
                const movements = await getStockMovements(epiTypeId, limit, startDate, endDate);
                return NextResponse.json({ success: true, data: movements });
            }
            case 'alerts': {
                const alerts = await getLowStockAlerts();
                return NextResponse.json({ success: true, data: alerts });
            }
            case 'levels':
            default: {
                const levels = await getStockLevels();
                return NextResponse.json({ success: true, data: levels });
            }
        }
    } catch (error: any) {
        console.error('Error in GET /api/epi/stock:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/epi/stock
 * Create stock movement (entry, exit, adjustment, return) or initialize stock
 */
export async function POST(request: NextRequest) {
    try {
        const payload = await authenticateAndAuthorize(request, 'stock.edit');
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Special action: initialize stock for all types
        if (body.action === 'initialize') {
            const count = await initializeStockForAllTypes();
            return NextResponse.json({
                success: true,
                message: `${count} registros de estoque inicializados`,
                data: { initialized: count }
            });
        }

        // Stock movement
        const { epi_type_id, movement_type, quantity, reason, reference_id } = body;

        if (!epi_type_id) {
            return NextResponse.json({ error: 'Tipo de EPI é obrigatório' }, { status: 400 });
        }
        if (!quantity || quantity <= 0) {
            return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 });
        }

        let movement;
        switch (movement_type) {
            case 'entry':
                movement = await addStockEntry(epi_type_id, quantity, reason || 'Entrada de estoque', payload.userId);
                break;
            case 'exit':
                movement = await deductStock(epi_type_id, quantity, reason || 'Saída de estoque', payload.userId, reference_id);
                break;
            case 'adjustment':
                movement = await adjustStock(epi_type_id, quantity, reason || 'Ajuste manual', payload.userId);
                break;
            case 'return':
                movement = await returnStock(epi_type_id, quantity, reason || 'Devolução', payload.userId, reference_id);
                break;
            default:
                return NextResponse.json({ error: 'Tipo de movimentação inválido. Use: entry, exit, adjustment, return' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: movement,
            message: 'Movimentação registrada com sucesso'
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error in POST /api/epi/stock:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/epi/stock
 * Update stock configuration (minimum quantity, location)
 */
export async function PUT(request: NextRequest) {
    try {
        const payload = await authenticateAndAuthorize(request, 'stock.edit');
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, minimum_quantity, location } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID do estoque é obrigatório' }, { status: 400 });
        }

        await updateStockConfig(id, { minimum_quantity, location });

        return NextResponse.json({
            success: true,
            message: 'Configuração de estoque atualizada'
        });
    } catch (error: any) {
        console.error('Error in PUT /api/epi/stock:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
