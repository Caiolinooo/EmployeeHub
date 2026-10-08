import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import {
    getSectors,
    getSectorResponsibles,
    addSectorResponsible,
    removeSectorResponsible
} from '@/services/epiService';
import { supabaseAdmin } from '@/lib/db';
import { podeGerenciarEpi } from '@/lib/epi-access';

export const dynamic = 'force-dynamic';

// Helper to check if user has admin/manager access
async function hasEPIAdminAccess(userId: string, role: string): Promise<boolean> {
    return podeGerenciarEpi(userId, role, 'sector_responsibles.manage');
}

// Helper to extract and verify token
function authenticateRequest(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
        const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
        if (tokenCookie) {
            token = tokenCookie.value;
        }
    }

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload || !payload.userId) return null;

    return payload;
}

/**
 * GET /api/epi/sector-responsibles
 * Get sectors and their responsibles
 */
export async function GET(request: NextRequest) {
    try {
        const payload = authenticateRequest(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const canManage = await hasEPIAdminAccess(payload.userId, payload.role || 'USER');
        if (!canManage) {
            return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }

        const [sectors, responsibles] = await Promise.all([
            getSectors(),
            getSectorResponsibles()
        ]);

        // Also fetch users for the UI to display user names
        const { data: usersData } = await supabaseAdmin
            .from('users_unified')
            .select('id, first_name, last_name, email')
            .order('first_name', { ascending: true });

        const users = (usersData || []).map(u => ({
            id: u.id,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
            email: u.email
        }));

        return NextResponse.json({
            success: true,
            data: { sectors, responsibles, users }
        });
    } catch (error: any) {
        console.error('Error in GET /api/epi/sector-responsibles:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/epi/sector-responsibles
 * Add a sector responsible
 */
export async function POST(request: NextRequest) {
    try {
        const payload = authenticateRequest(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const canManage = await hasEPIAdminAccess(payload.userId, payload.role || 'USER');
        if (!canManage) {
            return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }

        const body = await request.json();
        const { sectorId, userId } = body;

        if (!sectorId || !userId) {
            return NextResponse.json({ error: 'sectorId e userId são obrigatórios' }, { status: 400 });
        }

        await addSectorResponsible(sectorId, userId);

        return NextResponse.json({
            success: true,
            message: 'Responsável adicionado com sucesso'
        }, { status: 201 });
    } catch (error: any) {
        console.error('Error in POST /api/epi/sector-responsibles:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/epi/sector-responsibles
 * Remove a sector responsible
 */
export async function DELETE(request: NextRequest) {
    try {
        const payload = authenticateRequest(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const canManage = await hasEPIAdminAccess(payload.userId, payload.role || 'USER');
        if (!canManage) {
            return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        await removeSectorResponsible(id);

        return NextResponse.json({
            success: true,
            message: 'Responsável removido com sucesso'
        });
    } catch (error: any) {
        console.error('Error in DELETE /api/epi/sector-responsibles:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
