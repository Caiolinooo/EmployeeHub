import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { extractTokenFromHeader, verifyToken, checkAclPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getAuthPayload(request: Request) {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload) return null;
    return payload;
}

export async function GET(request: Request) {
    const payload = getAuthPayload(request);
    if (!payload) {
        return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const hasAcl = await checkAclPermission(payload.userId, payload.role, 'ferias', 'admin') ||
                   await checkAclPermission(payload.userId, payload.role, 'ferias', 'manage') ||
                   await checkAclPermission(payload.userId, payload.role, 'ferias', 'read');
    if (payload.role !== 'ADMIN' && !hasAcl) {
        return NextResponse.json({ error: 'Apenas administradores ou usuários autorizados via ACL podem listar todas as solicitações' }, { status: 403 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const yearParam = searchParams.get('year');
        const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10) || 500, 1000);
        const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;
        const search = searchParams.get('search') || '';
        const year = yearParam ? parseInt(yearParam, 10) : undefined;

        let query = supabaseAdmin
            .from('leave_requests')
            .select(`
                *,
                user:users_unified(name, email, sector_id, sector:sectors(name))
            `, { count: 'exact' });

        if (status && status !== 'ALL') {
            query = query.eq('status', status);
        }

        if (year && !Number.isNaN(year) && year >= 2000 && year <= 2100) {
            query = query.gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`);
        }

        query = query.order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (error) {
            console.error('Error fetching global leave requests:', error);
            throw error;
        }

        // Apply in-memory search filter if passed
        let processedData = data || [];
        if (search) {
            const lowerSearch = search.toLowerCase();
            processedData = processedData.filter((req: any) =>
                (req.user?.name && req.user.name.toLowerCase().includes(lowerSearch)) ||
                (req.user?.sector?.name && req.user.sector.name.toLowerCase().includes(lowerSearch))
            );
        }

        return NextResponse.json({
            requests: processedData,
            totalCount: count || 0
        });

    } catch (error) {
        console.error('Error in GET /api/admin/leave-requests:', error);
        return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const payload = getAuthPayload(request);
    if (!payload) {
        return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const hasAcl = await checkAclPermission(payload.userId, payload.role, 'ferias', 'admin') ||
                   await checkAclPermission(payload.userId, payload.role, 'ferias', 'manage');
    if (payload.role !== 'ADMIN' && !hasAcl) {
        return NextResponse.json({ error: 'Apenas administradores ou usuários autorizados via ACL podem excluir solicitações' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('leave_requests')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting leave request:', error);
            return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error in DELETE /api/admin/leave-requests:', error);
        return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 });
    }
}
