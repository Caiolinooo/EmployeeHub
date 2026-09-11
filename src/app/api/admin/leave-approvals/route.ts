import { NextResponse } from 'next/server';
import { getPendingLeaveRequestsForApprover, updateLeaveRequestStatus } from '@/services/leaveService';
import { supabaseAdmin, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { sendGlobalNotification } from '@/lib/global-notifications';
import { triggerLeaveNotifications } from '@/services/leaveNotifications';
import { extractTokenFromHeader, verifyToken, checkAclPermission } from '@/lib/auth';

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

    try {
        const { searchParams } = new URL(request.url);
        const approverId = searchParams.get('approverId');
        const history = searchParams.get('history') === '1' || searchParams.get('history') === 'true';
        const status = searchParams.get('status') || undefined;
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;

        if (!approverId) {
            return NextResponse.json({ error: 'Missing approverId' }, { status: 400 });
        }

        // Only allow users to check their own approval queue unless admin or has ACL permission
        const hasAcl = await checkAclPermission(payload.userId, payload.role, 'ferias', 'admin') ||
                       await checkAclPermission(payload.userId, payload.role, 'ferias', 'manage');
        if (payload.userId !== approverId && payload.role !== 'ADMIN' && !hasAcl) {
            return NextResponse.json({ error: 'Você não tem permissão para ver aprovações de outro usuário' }, { status: 403 });
        }

        const isApproverQuery = await supabaseAdmin
            .from('leave_sector_configs')
            .select('id')
            .or(`leader_id.eq.${approverId},manager_id.eq.${approverId}`)
            .limit(1);

        // Check if the target user has global access
        const targetUserQuery = await supabaseAdmin
            .from('users_unified')
            .select('role')
            .eq('id', approverId)
            .single();
        const targetUserRole = targetUserQuery.data?.role || 'USER';

        const targetHasAcl = await checkAclPermission(approverId, targetUserRole, 'ferias', 'admin') ||
                             await checkAclPermission(approverId, targetUserRole, 'ferias', 'manage') ||
                             await checkAclPermission(approverId, targetUserRole, 'ferias', 'approve') ||
                             targetUserRole === 'ADMIN';

        const isApprover = (isApproverQuery.data && isApproverQuery.data.length > 0) || targetHasAcl;

        const data = await getPendingLeaveRequestsForApprover(approverId, targetHasAcl, {
            includeHistory: history,
            status,
            year: year && !Number.isNaN(year) ? year : undefined,
        });

        return NextResponse.json({
            isApprover,
            history,
            requests: data
        });
    } catch (error) {
        console.error('Error GET /api/admin/leave-approvals:', error);
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const payload = getAuthPayload(request);
    if (!payload) {
        return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { request_id, approver_id, action, reason, force_admin } = body;

        if (!request_id || !action || (!approver_id && !force_admin)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch the request
        const { data: currentReq, error: reqError } = await supabaseAdmin
            .from('leave_requests')
            .select(`*, user:users_unified(sector_id)`)
            .eq('id', request_id)
            .single();

        if (reqError || !currentReq) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const sectorId = currentReq.user.sector_id;
        const { data: config, error: configError } = await supabaseAdmin
            .from('leave_sector_configs')
            .select('*')
            .eq('sector_id', sectorId)
            .single();

        if (configError || !config) {
            return NextResponse.json({ error: 'Sector configuration not found' }, { status: 500 });
        }

        let nextStatus: 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' = 'APPROVED';

        if (force_admin) {
            // Only allow force_admin if the caller is actually an ADMIN or has ACL permission to manage/admin
            const hasAcl = await checkAclPermission(payload.userId, payload.role, 'ferias', 'admin') ||
                           await checkAclPermission(payload.userId, payload.role, 'ferias', 'manage');
            if (payload.role !== 'ADMIN' && !hasAcl) {
                return NextResponse.json({ error: 'Apenas administradores ou autorizados via ACL podem usar aprovação administrativa/forçada' }, { status: 403 });
            }
            nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        } else {
            if (!approver_id) {
                return NextResponse.json({ error: 'approver_id is required' }, { status: 400 });
            }
            // Verify the caller is the approver they claim to be
            if (payload.userId !== approver_id) {
                return NextResponse.json({ error: 'O ID do aprovador não corresponde ao token de autenticação' }, { status: 403 });
            }

            const isLeader = config.leader_id === approver_id;
            const isManager = config.manager_id === approver_id;

            // Verify they are actually the leader or manager of the sector, or have ACL permissions
            const hasApproveAcl = await checkAclPermission(payload.userId, payload.role, 'ferias', 'approve') ||
                                  await checkAclPermission(payload.userId, payload.role, 'ferias', 'admin') ||
                                  await checkAclPermission(payload.userId, payload.role, 'ferias', 'manage');

            if (!isLeader && !isManager && !hasApproveAcl && payload.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Você não tem permissão para aprovar ou rejeitar solicitações deste setor' }, { status: 403 });
            }

            if (action === 'REJECT') {
                nextStatus = 'REJECTED';
            } else if (action === 'APPROVE') {
                if (currentReq.status === 'PENDING_LEADER') {
                    if (isLeader || hasApproveAcl || payload.role === 'ADMIN') {
                        if (config.manager_id && config.manager_id !== approver_id) {
                            nextStatus = 'PENDING_MANAGER';
                        } else {
                            nextStatus = 'APPROVED';
                        }
                    } else {
                        nextStatus = 'APPROVED';
                    }
                } else if (currentReq.status === 'PENDING_MANAGER') {
                    if (isManager || hasApproveAcl || payload.role === 'ADMIN') {
                        nextStatus = 'APPROVED';
                    } else {
                        return NextResponse.json({ error: 'Not authorized as manager' }, { status: 403 });
                    }
                } else {
                    return NextResponse.json({ error: 'Transição de estado inválida para aprovação normal' }, { status: 400 });
                }
            } else {
                return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
            }
        }

        const success = await updateLeaveRequestStatus(request_id, nextStatus, reason);

        if (success) {
            await triggerLeaveNotifications(request_id, nextStatus, reason);
            return NextResponse.json({ success: true, newStatus: nextStatus });
        } else {
            return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
        }
    } catch (error) {
        console.error('Error POST /api/admin/leave-approvals:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
