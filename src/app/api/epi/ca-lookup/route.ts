import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { lookupCA, syncCADatabase, getCacheStats } from '@/services/caLookupService';
import { supabaseAdmin } from '@/lib/db';
import { podeGerenciarEpi } from '@/lib/epi-access';

export const dynamic = 'force-dynamic';

// Helper: check admin/manager access
async function hasAdminAccess(userId: string, role: string): Promise<boolean> {
    return podeGerenciarEpi(userId, role, 'ca_lookup');
}

// Helper: authenticate request
function authenticateRequest(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);
    if (!token) {
        const cookie = request.cookies.get('abzToken') || request.cookies.get('token');
        if (cookie) token = cookie.value;
    }
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload?.userId) return null;
    return payload;
}

/**
 * GET /api/epi/ca-lookup?ca=XXXXX
 * Query CA information by number
 */
export async function GET(request: NextRequest) {
    try {
        const payload = authenticateRequest(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const caNumber = request.nextUrl.searchParams.get('ca');
        const action = request.nextUrl.searchParams.get('action');

        // Action: get cache stats
        if (action === 'stats') {
            const isAdmin = await hasAdminAccess(payload.userId, payload.role || 'USER');
            if (!isAdmin) {
                return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
            }
            const stats = await getCacheStats();
            return NextResponse.json({ success: true, data: stats });
        }

        if (!caNumber) {
            return NextResponse.json({ error: 'Parâmetro "ca" é obrigatório' }, { status: 400 });
        }

        const result = await lookupCA(caNumber);

        if (!result) {
            return NextResponse.json({
                success: false,
                data: null,
                message: `CA ${caNumber} não encontrado. Você pode inserir os dados manualmente.`
            });
        }

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('Error in GET /api/epi/ca-lookup:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/epi/ca-lookup
 * Trigger actions:
 *  - { action: 'sync' } — Sync CA data for all EPI types (admin only)
 */
export async function POST(request: NextRequest) {
    try {
        const payload = authenticateRequest(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = await hasAdminAccess(payload.userId, payload.role || 'USER');
        if (!isAdmin) {
            return NextResponse.json({ error: 'Permissão negada para sincronizar base de CA' }, { status: 403 });
        }

        const body = await request.json();

        if (body.action === 'sync') {
            const result = await syncCADatabase();
            return NextResponse.json({
                success: true,
                data: result,
                message: `Sincronização completa: ${result.synced} CAs atualizados, ${result.errors} erros`
            });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

    } catch (error: any) {
        console.error('Error in POST /api/epi/ca-lookup:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
