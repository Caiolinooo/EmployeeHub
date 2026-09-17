import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { generateLeaveRequestPDF, LeaveRequestPDFData } from '@/lib/leavePDFGenerator';
import { extractTokenFromHeader, verifyToken, checkAclPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leave/[id]/pdf
 *
 * Gera e retorna o PDF do comprovante de uma solicitação de férias
 * específica. Disponível para:
 * - O próprio colaborador (donoo da solicitação)
 * - Líder/gerente do setor (com permissão de aprovação)
 * - Admins e usuários com ACL ferias:admin/manage/read
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const requestId = params.id;
        if (!requestId) {
            return NextResponse.json({ error: 'ID da solicitação é obrigatório' }, { status: 400 });
        }

        // Autenticação
        const authHeader = request.headers.get('authorization') || undefined;
        const token = extractTokenFromHeader(authHeader);
        if (!token) {
            return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
        }
        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        // Busca a solicitação com os dados do usuário e do setor
        const { data: req, error } = await supabaseAdmin
            .from('leave_requests')
            .select(`
                *,
                user:users_unified!inner(
                    id, name, email, sector_id, position,
                    sector:sectors(id, name)
                )
            `)
            .eq('id', requestId)
            .single();

        if (error || !req) {
            console.error('[Leave PDF] Solicitação não encontrada:', error);
            return NextResponse.json({ error: 'Solicitação de férias não encontrada' }, { status: 404 });
        }

        // Verificação de permissão:
        // - Dono da solicitação pode baixar
        // - Admin sempre pode
        // - Líder/gerente do setor pode (precisa checar config)
        // - Usuário com ACL ferias:read/manage/admin pode
        const isOwner = req.user_id === payload.userId;
        const isAdmin = payload.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            const hasAcl = (await checkAclPermission(payload.userId, payload.role, 'ferias', 'read')) ||
                            (await checkAclPermission(payload.userId, payload.role, 'ferias', 'manage')) ||
                            (await checkAclPermission(payload.userId, payload.role, 'ferias', 'admin'));

            if (!hasAcl) {
                // Verifica se é líder ou gerente do setor
                let isApprover = false;
                if (req.user?.sector_id) {
                    const { data: config } = await supabaseAdmin
                        .from('leave_sector_configs')
                        .select('leader_id, manager_id')
                        .eq('sector_id', req.user.sector_id)
                        .single();
                    isApprover = config?.leader_id === payload.userId || config?.manager_id === payload.userId;
                }

                if (!isApprover) {
                    return NextResponse.json({
                        error: 'Você não tem permissão para baixar este comprovante'
                    }, { status: 403 });
                }
            }
        }

        // Busca nomes do líder e gerente (se aplicável)
        let leaderName: string | undefined;
        let managerName: string | undefined;
        if (req.user?.sector_id) {
            const { data: config } = await supabaseAdmin
                .from('leave_sector_configs')
                .select(`
                    leader:users_unified!leave_sector_configs_leader_id_fkey(name),
                    manager:users_unified!leave_sector_configs_manager_id_fkey(name)
                `)
                .eq('sector_id', req.user.sector_id)
                .single();

            const leader = Array.isArray(config?.leader) ? config?.leader[0] : config?.leader;
            const manager = Array.isArray(config?.manager) ? config?.manager[0] : config?.manager;
            leaderName = (leader as { name?: string } | null)?.name;
            managerName = (manager as { name?: string } | null)?.name;
        }

        // Monta os dados para o PDF
        const pdfData: LeaveRequestPDFData = {
            id: req.id,
            created_at: req.created_at,
            updated_at: req.updated_at,
            user_name: req.user?.name || '',
            user_email: req.user?.email || '',
            user_cpf: (req.user as any)?.cpf,
            user_position: (req.user as any)?.position,
            user_sector: (req.user as any)?.sector?.name,
            start_date: req.start_date,
            end_date: req.end_date,
            periods: req.periods,
            status: req.status,
            justification: req.justification,
            rejection_reason: req.rejection_reason,
            pecuniary_allowance: req.pecuniary_allowance,
            advance_13th_salary: req.advance_13th_salary,
            leader_name: leaderName,
            manager_name: managerName
        };

        // Gera o PDF
        const pdfBuffer = await generateLeaveRequestPDF(pdfData);

        // Nome do arquivo
        const safeUserName = (req.user?.name || 'colaborador')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 30);
        const fileName = `Comprovante_Ferias_${safeUserName}_${req.id.slice(0, 8)}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': String(pdfBuffer.length)
            }
        });
    } catch (error) {
        console.error('[Leave PDF] Erro ao gerar comprovante:', error);
        return NextResponse.json({
            error: 'Erro interno ao gerar comprovante de férias'
        }, { status: 500 });
    }
}
