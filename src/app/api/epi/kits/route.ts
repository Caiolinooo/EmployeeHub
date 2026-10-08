import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import {
    getEPIKits,
    getEPIKitById,
    createEPIKit,
    updateEPIKit,
    deleteEPIKit,
    getEPITypes,
    getSectors,
    assignKitToUser
} from '@/services/epiService';
import { supabaseAdmin } from '@/lib/db';
import { podeGerenciarEpi } from '@/lib/epi-access';

export const dynamic = 'force-dynamic';

// Helper to authenticate and check EPI admin access
async function authenticateAndAuthorize(request: NextRequest) {
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
    return (await podeGerenciarEpi(payload.userId, role, 'kits.manage')) ? payload : null;
}

/**
 * GET /api/epi/kits
 * List all kits, EPI types, and sectors for the management UI
 */
export async function GET(request: NextRequest) {
    try {
        const payload = await authenticateAndAuthorize(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const sectorId = searchParams.get('sectorId') || undefined;

        const [kits, epiTypes, sectors] = await Promise.all([
            getEPIKits(sectorId),
            getEPITypes(),
            getSectors()
        ]);

        // Also fetch users for assignment UI
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
            data: { kits, epiTypes, sectors, users }
        });
    } catch (error: any) {
        console.error('Error in GET /api/epi/kits:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/epi/kits
 * Create a new kit or assign a kit to a user
 */
export async function POST(request: NextRequest) {
    try {
        const payload = await authenticateAndAuthorize(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Check if this is an assignment request
        if (body.action === 'assign') {
            const { userId, kitId } = body;
            if (!userId || !kitId) {
                return NextResponse.json({ error: 'userId e kitId são obrigatórios' }, { status: 400 });
            }
            await assignKitToUser(userId, kitId, payload.userId);
            return NextResponse.json({
                success: true,
                message: 'Kit atribuído com sucesso'
            });
        }

        // Otherwise, create a new kit
        if (!body.name) {
            return NextResponse.json({ error: 'Nome do kit é obrigatório' }, { status: 400 });
        }

        if (!body.items || body.items.length === 0) {
            return NextResponse.json({ error: 'Adicione pelo menos um item ao kit' }, { status: 400 });
        }

        const kit = await createEPIKit(body);

        return NextResponse.json({
            success: true,
            data: kit,
            message: 'Kit criado com sucesso'
        }, { status: 201 });
    } catch (error: any) {
        console.error('Error in POST /api/epi/kits:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/epi/kits
 * Update a kit
 */
export async function PUT(request: NextRequest) {
    try {
        const payload = await authenticateAndAuthorize(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        await updateEPIKit(id, updateData);

        return NextResponse.json({
            success: true,
            message: 'Kit atualizado com sucesso'
        });
    } catch (error: any) {
        console.error('Error in PUT /api/epi/kits:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/epi/kits
 * Delete a kit
 */
export async function DELETE(request: NextRequest) {
    try {
        const payload = await authenticateAndAuthorize(request);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        await deleteEPIKit(id);

        return NextResponse.json({
            success: true,
            message: 'Kit excluído com sucesso'
        });
    } catch (error: any) {
        console.error('Error in DELETE /api/epi/kits:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
