import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { getEPITypes, createEPIType, updateEPIType, deleteEPIType, getEPITypeById } from '@/services/epiService';
import { supabaseAdmin } from '@/lib/db';
import { podeGerenciarEpi } from '@/lib/epi-access';

export const dynamic = 'force-dynamic';

// Helper to check if user has access to manage EPIs
async function hasEPIAccess(userId: string, role: string): Promise<boolean> {
    return podeGerenciarEpi(userId, role, 'types.manage');
}

/**
 * GET /api/epi/types
 * List all EPI types
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

        const types = await getEPITypes();

        return NextResponse.json({
            success: true,
            data: types,
            count: types.length
        });

    } catch (error: any) {
        console.error('Error in GET /api/epi/types:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/epi/types
 * Create a new EPI type (admin/manager/permitted only)
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
        const userRole = payload.role || 'USER';

        const canManage = await hasEPIAccess(userId, userRole);

        if (!canManage) {
            return NextResponse.json({ error: 'Permissão negada para criar tipos de EPI' }, { status: 403 });
        }

        // Parse request body
        const body = await request.json();

        // Validate required fields
        if (!body.name) {
            return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        }

        if (!body.category) {
            return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 });
        }

        // Create the type
        const type = await createEPIType({
            name: body.name,
            description: body.description || null,
            category: body.category,
            is_required: body.is_required || false,
            ca_number: body.ca_number || null,
            parent_id: body.parent_id || null,
            size: body.size || null
        } as any);

        return NextResponse.json({
            success: true,
            data: type,
            message: 'Tipo de EPI criado com sucesso'
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error in POST /api/epi/types:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT /api/epi/types
 * Update an EPI type (admin/manager/permitted only)
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

        const canManage = await hasEPIAccess(userId, userRole);

        if (!canManage) {
            return NextResponse.json({ error: 'Permissão negada para atualizar tipos de EPI' }, { status: 403 });
        }

        // Parse request body
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        // Check if type exists
        const existing = await getEPITypeById(body.id);
        if (!existing) {
            return NextResponse.json({ error: 'Tipo de EPI não encontrado' }, { status: 404 });
        }

        const type = await updateEPIType(body.id, {
            name: body.name,
            description: body.description,
            category: body.category,
            is_required: body.is_required,
            ca_number: body.ca_number,
            parent_id: body.parent_id,
            size: body.size
        } as any);

        return NextResponse.json({
            success: true,
            data: type,
            message: 'Tipo de EPI atualizado com sucesso'
        });

    } catch (error: any) {
        console.error('Error in PUT /api/epi/types:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/epi/types
 * Delete an EPI type (admin/manager/permitted only)
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

        const canManage = await hasEPIAccess(userId, userRole);

        if (!canManage) {
            return NextResponse.json({ error: 'Permissão negada para deletar tipos de EPI' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        // Delete the type
        await deleteEPIType(id);

        return NextResponse.json({
            success: true,
            message: 'Tipo de EPI deletado com sucesso'
        });

    } catch (error: any) {
        console.error('Error in DELETE /api/epi/types:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
