import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import {
    getUserEPIRegistrations,
    getAllEPIRegistrations,
    createEPIRegistration,
    updateEPIRegistration,
    cancelEPIRegistration
} from '@/services/epiService';
import { EPICreateRequest, EPIUpdateRequest } from '@/types/epi';
import { supabaseAdmin } from '@/lib/db';
import { podeGerenciarEpi } from '@/lib/epi-access';

export const dynamic = 'force-dynamic';

// Helper to check if user has access to manage EPIs
async function hasEPIAccess(userId: string, role: string, acao: string): Promise<boolean> {
    return podeGerenciarEpi(userId, role, acao);
}

/**
 * GET /api/epi
 * List user's EPI registrations (or all for admins/managers/permitted users)
 */
export async function GET(request: NextRequest) {
    try {
        // Authentication
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
            if (tokenCookie) {
                token = tokenCookie.value;
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = payload.userId;
        const userRole = payload.role || 'USER';

        // Check for specific EPI access permission
        const canManage = await hasEPIAccess(userId, userRole, 'view_all');

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status') || undefined;

        let registrations;
        if (canManage) {
            // Admins/managers/permitted users see all registrations
            registrations = await getAllEPIRegistrations(status);
        } else {
            // Regular users see only their own
            registrations = await getUserEPIRegistrations(userId);
        }

        return NextResponse.json({
            success: true,
            data: registrations,
            count: registrations.length
        });

    } catch (error: any) {
        console.error('Error in GET /api/epi:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/epi
 * Create a new EPI registration request
 */
export async function POST(request: NextRequest) {
    try {
        // Authentication
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
            if (tokenCookie) {
                token = tokenCookie.value;
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = payload.userId;

        // Parse request body
        const body: EPICreateRequest = await request.json();

        // Validate required fields
        if (!body.equipment_type) {
            return NextResponse.json({ error: 'Tipo de EPI é obrigatório' }, { status: 400 });
        }

        if (!body.quantity || body.quantity < 1) {
            return NextResponse.json({ error: 'Quantidade deve ser maior que 0' }, { status: 400 });
        }

        if (!body.reason) {
            return NextResponse.json({ error: 'Motivo da solicitação é obrigatório' }, { status: 400 });
        }

        // Create the registration
        const registration = await createEPIRegistration(userId, body);

        return NextResponse.json({
            success: true,
            data: registration,
            message: 'Solicitação de EPI criada com sucesso'
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error in POST /api/epi:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/epi
 * Update an EPI registration (approve/reject for managers/permitted users)
 */
export async function PUT(request: NextRequest) {
    try {
        // Authentication
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
            if (tokenCookie) {
                token = tokenCookie.value;
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = payload.userId;
        const userRole = payload.role || 'USER';

        // Check for specific EPI access permission
        const canManage = await hasEPIAccess(userId, userRole, 'deliver');

        if (!canManage) {
            return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }

        // Parse request body
        const body: { id: string } & EPIUpdateRequest = await request.json();

        if (!body.id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        // Update the registration
        const registration = await updateEPIRegistration(body.id, body);

        return NextResponse.json({
            success: true,
            data: registration,
            message: 'Registro de EPI atualizado com sucesso'
        });

    } catch (error: any) {
        console.error('Error in PUT /api/epi:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/epi
 * Cancel/delete an EPI registration
 */
export async function DELETE(request: NextRequest) {
    try {
        // Authentication
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
            if (tokenCookie) {
                token = tokenCookie.value;
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = payload.userId;
        const userRole = payload.role || 'USER';

        // Check for specific EPI access permission
        const isAdmin = await hasEPIAccess(userId, userRole, 'delete');

        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        if (isAdmin) {
            // Admins/permitted users can delete any registration
            const { supabaseAdmin } = await import('@/lib/db');
            await supabaseAdmin.from('epi_registrations').delete().eq('id', id);
        } else {
            // Regular users can only cancel their own pending requests
            await cancelEPIRegistration(id, userId);
        }

        return NextResponse.json({
            success: true,
            message: 'Registro de EPI cancelado com sucesso'
        });

    } catch (error: any) {
        console.error('Error in DELETE /api/epi:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
