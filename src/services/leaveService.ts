import { supabase, supabaseAdmin } from '@/lib/db';

export interface LeaveSectorConfig {
    id: string;
    sector_id: string;
    leader_id: string | null;
    manager_id: string | null;
    created_at: string;
    updated_at: string;
    // Joins
    sector?: { id: string; name: string };
    leader?: { id: string; name: string; email: string };
    manager?: { id: string; name: string; email: string };
}

export interface LeaveRequest {
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    periods?: Array<{ start_date: string; end_date: string; duration: number }>;
    status: 'PENDING_LEADER' | 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    justification?: string;
    rejection_reason?: string;
    pecuniary_allowance?: boolean;
    advance_13th_salary?: boolean;
    created_at: string;
    updated_at: string;
    // Joins
    user?: {
        id: string;
        name?: string;
        first_name?: string | null;
        last_name?: string | null;
        email: string;
        sector_id: string;
        tax_id?: string | null;
        sector?: { name: string };
    };
}

// ==========================================
// SECTOR CONFIGS
// ==========================================

export async function getLeaveSectorConfigs(): Promise<LeaveSectorConfig[]> {
    const { data, error } = await supabaseAdmin
        .from('leave_sector_configs')
        .select(`
      *,
      sector:sectors(id, name),
      leader:users_unified!leave_sector_configs_leader_id_fkey(id, name, email),
      manager:users_unified!leave_sector_configs_manager_id_fkey(id, name, email)
    `);

    if (error) {
        console.error('Error fetching leave sector configs:', error);
        return [];
    }

    return data as LeaveSectorConfig[];
}

export async function getLeaveConfigForSector(sectorId: string): Promise<LeaveSectorConfig | null> {
    const { data, error } = await supabaseAdmin
        .from('leave_sector_configs')
        .select(`
      *,
      sector:sectors(id, name),
      leader:users_unified!leave_sector_configs_leader_id_fkey(id, name, email),
      manager:users_unified!leave_sector_configs_manager_id_fkey(id, name, email)
    `)
        .eq('sector_id', sectorId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`Error fetching leave config for sector ${sectorId}:`, error);
        return null;
    }

    return data as LeaveSectorConfig | null;
}

export async function upsertLeaveSectorConfig(sectorId: string, leaderId: string | null, managerId: string | null): Promise<boolean> {
    // Check if exists
    const existing = await getLeaveConfigForSector(sectorId);

    if (existing) {
        const { error } = await supabaseAdmin
            .from('leave_sector_configs')
            .update({ leader_id: leaderId, manager_id: managerId })
            .eq('sector_id', sectorId);

        if (error) {
            console.error(`Error updating leave config for sector ${sectorId}:`, error);
            return false;
        }
    } else {
        const { error } = await supabaseAdmin
            .from('leave_sector_configs')
            .insert([{ sector_id: sectorId, leader_id: leaderId, manager_id: managerId }]);

        if (error) {
            console.error(`Error creating leave config for sector ${sectorId}:`, error);
            return false;
        }
    }

    return true;
}

// ==========================================
// LEAVE REQUESTS
// ==========================================

export async function getUserLeaveRequests(userId: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabaseAdmin
        .from('leave_requests')
        .select(`
      *,
      user:users_unified(id, name, email, sector_id)
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(`Error fetching leave requests for user ${userId}:`, error);
        return [];
    }

    return data as LeaveRequest[];
}

export type ApproverLeaveQueryOptions = {
    hasGlobalAccess?: boolean;
    /** When true, return all statuses for the approver's sectors (histórico), not only pending. */
    includeHistory?: boolean;
    status?: string;
    year?: number;
};

export async function getPendingLeaveRequestsForApprover(
    approverId: string,
    hasGlobalAccess: boolean = false,
    options: ApproverLeaveQueryOptions = {}
): Promise<LeaveRequest[]> {
    const includeHistory = options.includeHistory === true;
    const statusFilter = options.status && options.status !== 'ALL' ? options.status : undefined;
    const year = options.year;

    let sectorIdsWhereLeader: string[] = [];
    let sectorIdsWhereManager: string[] = [];
    let allApproverSectorIds: string[] = [];

    if (!hasGlobalAccess) {
        // Busca configs onde o approverId é líder ou gerente
        const { data: configs, error: configError } = await supabaseAdmin
            .from('leave_sector_configs')
            .select('*')
            .or(`leader_id.eq.${approverId},manager_id.eq.${approverId}`);

        if (configError) {
            console.error('Error fetching configs for approver:', configError);
            return [];
        }

        if (!configs || configs.length === 0) {
            return []; // Not an approver for any sector
        }

        sectorIdsWhereLeader = configs.filter(c => c.leader_id === approverId).map(c => c.sector_id);
        sectorIdsWhereManager = configs.filter(c => c.manager_id === approverId).map(c => c.sector_id);
        allApproverSectorIds = [...new Set([...sectorIdsWhereLeader, ...sectorIdsWhereManager])];
    }

    let query = supabaseAdmin
        .from('leave_requests')
        .select(`
            *,
            user:users_unified!inner(id, name, email, sector_id, sector:sectors(name))
        `)
        .order('created_at', { ascending: false });

    if (!includeHistory) {
        query = query.in('status', ['PENDING_LEADER', 'PENDING_MANAGER']);
    } else if (statusFilter) {
        query = query.eq('status', statusFilter);
    }

    if (year && year >= 2000 && year <= 2100) {
        query = query.gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`);
    }

    const { data: requests, error: reqError } = await query.limit(500);

    if (reqError) {
        console.error('Error fetching pending requests:', reqError);
        return [];
    }

    // Now filter based on approver role per sector
    const filteredRequests = (requests as any[]).filter(req => {
        // Prevent users from approving their own request in the pending queue
        if (!includeHistory && req.user_id === approverId) return false;

        if (hasGlobalAccess) return true;

        const userSectorId = req.user.sector_id;

        if (includeHistory) {
            return allApproverSectorIds.includes(userSectorId);
        }

        if (req.status === 'PENDING_LEADER' && sectorIdsWhereLeader.includes(userSectorId)) {
            return true;
        }

        if (req.status === 'PENDING_MANAGER' && sectorIdsWhereManager.includes(userSectorId)) {
            return true;
        }

        return false;
    });

    return filteredRequests as LeaveRequest[];
}

export async function getUserLeaveRequestsFiltered(
    userId: string,
    options: { status?: string; year?: number } = {}
): Promise<LeaveRequest[]> {
    let query = supabaseAdmin
        .from('leave_requests')
        .select(`
      *,
      user:users_unified(id, name, email, sector_id)
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (options.status && options.status !== 'ALL') {
        query = query.eq('status', options.status);
    }
    if (options.year && options.year >= 2000 && options.year <= 2100) {
        query = query.gte('start_date', `${options.year}-01-01`).lte('start_date', `${options.year}-12-31`);
    }

    const { data, error } = await query.limit(200);

    if (error) {
        console.error(`Error fetching leave requests for user ${userId}:`, error);
        return [];
    }

    return data as LeaveRequest[];
}

export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
    const { data, error } = await supabaseAdmin
        .from('leave_requests')
        .select(`
      *,
      user:users_unified(id, name, email, sector_id)
    `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all leave requests:', error);
        return [];
    }

    return data as LeaveRequest[];
}

export async function createLeaveRequest(
    userId: string,
    startDate: string,
    endDate: string,
    justification?: string,
    periods?: Array<{ start_date: string; end_date: string; duration: number }>,
    pecuniaryAllowance?: boolean,
    advance13thSalary?: boolean
): Promise<{ success: boolean; data?: LeaveRequest; error?: any }> {
    // 1. Get user and config to determine initial status
    const { data: user } = await supabaseAdmin.from('users_unified').select('sector_id').eq('id', userId).single();
    let initialStatus = 'PENDING_LEADER';
    let isManager = false;

    if (user?.sector_id) {
        const { data: config } = await supabaseAdmin.from('leave_sector_configs').select('leader_id, manager_id').eq('sector_id', user.sector_id).single();
        if (config) {
            if (config.manager_id === userId) {
                // Manager requesting: bypass both leader and manager. Assuming Admin will handle or auto-approve.
                initialStatus = 'APPROVED'; // Could also be PENDING_ADMIN if added later.
                isManager = true;
            } else if (config.leader_id === userId) {
                // Leader requesting: bypass leader approval, go straight to manager
                initialStatus = 'PENDING_MANAGER';
            } else if (!config.leader_id) {
                // No leader defined: go straight to manager
                initialStatus = 'PENDING_MANAGER';
            }
        } else {
            initialStatus = 'PENDING_MANAGER'; // No config at all
        }
    } else {
        initialStatus = 'PENDING_MANAGER'; // No sector at all
    }

    const { data, error } = await supabaseAdmin
        .from('leave_requests')
        .insert([{
            user_id: userId,
            start_date: startDate,
            end_date: endDate,
            periods: periods || [],
            status: initialStatus,
            justification,
            pecuniary_allowance: pecuniaryAllowance || false,
            advance_13th_salary: advance13thSalary || false
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating leave request:', error);
        return { success: false, error };
    }

    return { success: true, data: data as LeaveRequest };
}

export async function updateLeaveRequestStatus(
    requestId: string,
    status: 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
    rejectionReason?: string
): Promise<boolean> {
    const updateData: any = { status };
    if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
    }

    const { error } = await supabaseAdmin
        .from('leave_requests')
        .update(updateData)
        .eq('id', requestId);

    if (error) {
        console.error(`Error updating leave request ${requestId} to ${status}:`, error);
        return false;
    }

    // Se aprovado, sincronizar com gt_afastamentos para refletir no Fechamento DP, Man Schedule e e-Social
    if (status === 'APPROVED') {
        try {
            const { data: req } = await supabaseAdmin
                .from('leave_requests')
                .select('*, user:users_unified(id, first_name, last_name, email, tax_id)')
                .eq('id', requestId)
                .single();

            if (req && req.user) {
                const userCpf = req.user.tax_id ? req.user.tax_id.replace(/\D/g, '') : null;
                const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : null;

                let colabId: string | null = null;
                if (userCpf && userCpf.length === 11) {
                    const { data: cByCpf } = await supabaseAdmin
                        .from('gt_colaboradores')
                        .select('id, cpf')
                        .or(`cpf.eq.${userCpf},cpf.eq.${userCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`)
                        .is('deleted_at', null)
                        .maybeSingle();
                    if (cByCpf) colabId = cByCpf.id;
                }
                if (!colabId && userEmail) {
                    const { data: cByEmail } = await supabaseAdmin
                        .from('gt_colaboradores')
                        .select('id')
                        .ilike('email', userEmail)
                        .is('deleted_at', null)
                        .maybeSingle();
                    if (cByEmail) colabId = cByEmail.id;
                }

                if (colabId) {
                    const periods: Array<{ start_date: string; end_date: string }> =
                        Array.isArray(req.periods) && req.periods.length > 0
                            ? req.periods
                            : [{ start_date: req.start_date, end_date: req.end_date }];

                    for (const p of periods) {
                        if (!p.start_date || !p.end_date) continue;

                        const { data: existingAf } = await supabaseAdmin
                            .from('gt_afastamentos')
                            .select('id')
                            .eq('colaborador_id', colabId)
                            .eq('data_inicio', p.start_date)
                            .is('deleted_at', null)
                            .maybeSingle();

                        if (!existingAf) {
                            await supabaseAdmin
                                .from('gt_afastamentos')
                                .insert({
                                    colaborador_id: colabId,
                                    tipo_afastamento: 'ferias',
                                    cod_mot_afast: '15',
                                    motivo: req.justification || 'Férias aprovadas no portal',
                                    data_inicio: p.start_date,
                                    data_fim: p.end_date,
                                    data_prevista_retorno: p.end_date,
                                    observacoes: `Solicitação de férias aprovada (ID: ${requestId})`,
                                    esocial_status: 'nao_enviado',
                                });
                        }
                    }

                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isTodayInVacation = periods.some(p => p.start_date <= todayStr && p.end_date >= todayStr);
                    if (isTodayInVacation) {
                        await supabaseAdmin
                            .from('gt_colaboradores')
                            .update({ status_embarque: 'ferias', updated_at: new Date().toISOString() })
                            .eq('id', colabId);
                    }
                }
            }
        } catch (syncErr) {
            console.error('[LeaveService] Error syncing approved leave to gt_afastamentos:', syncErr);
        }
    }

    return true;
}
