import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { buildAppUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);
        if (!token) {
            token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value || null;
        }
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = verifyToken(token);
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { id } = params;
        const body = await request.json();
        const role = payload.role?.toUpperCase() || 'USER';
        const userId = payload.userId;

        // Fetch current request
        const { data: currentRequest, error: fetchError } = await supabaseAdmin
            .from('purchase_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !currentRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Check if user is an approver
        const isApprover = currentRequest.approver_ids?.includes(userId) || false;
        if (!isApprover && !(await canWithGrant(userId, role, ['compras.approve_any'], 'admin'))) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        // Validate action
        const validActions = ['approve', 'reject'];
        if (!body.action || !validActions.includes(body.action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Update request status
        const newStatus = body.action === 'approve' ? 'approved' : 'rejected';
        const updates = {
            status: newStatus,
            history: [...(currentRequest.history || []), {
                action: 'status_change',
                from: currentRequest.status,
                to: newStatus,
                user_id: userId,
                note: body.note || '',
                date: new Date().toISOString()
            }]
        };

        const { data, error } = await supabaseAdmin
            .from('purchase_requests')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Create approval flow record
        await supabaseAdmin
            .from('approval_flows')
            .insert({
                request_id: id,
                step_number: (currentRequest.history || []).length + 1,
                approver_id: userId,
                status: newStatus,
                decision_date: new Date().toISOString(),
                note: body.note || ''
            });

        // Send notification to request owner
        (async () => {
            try {
                const { data: owner } = await supabaseAdmin
                    .from('users_unified')
                    .select('name, email')
                    .eq('id', currentRequest.user_id)
                    .single();

                const { data: approver } = await supabaseAdmin
                    .from('users_unified')
                    .select('name')
                    .eq('id', userId)
                    .single();

                const { sendEmail } = await import('@/lib/email-exchange');
                const { requestStatusUpdateTemplate } = await import('@/lib/emailTemplates');
                const { getTranslation } = await import('@/i18n');

                let userLocale = request.headers.get('x-client-locale');
                const acceptLanguage = request.headers.get('accept-language');

                if (!userLocale && acceptLanguage) {
                    userLocale = acceptLanguage.split(',')[0].trim();
                }

                userLocale = userLocale || 'pt-BR';
                const t = (key: string, locale: string, params?: any) => getTranslation(locale as any, key, undefined, params);

                const requestNumber = currentRequest.request_number || currentRequest.id;
                const viewUrl = buildAppUrl(`/department/purchase-requests/${currentRequest.id}`, request.headers);

                const approverName = approver?.name || 'Administrador';

                if (owner?.email) {
                    const htmlUser = requestStatusUpdateTemplate(
                        owner.name || 'Colaborador',
                        requestNumber,
                        currentRequest.provider_name,
                        newStatus,
                        approverName,
                        body.note,
                        viewUrl,
                        userLocale
                    );

                    const subject = t('emails.purchaseRequest.statusUpdateSubject', userLocale, { requestNumber });
                    const message = newStatus === 'approved'
                        ? t('emails.purchaseRequest.approvedMessage', userLocale, { number: requestNumber, provider: currentRequest.provider_name, approver: approverName })
                        : t('emails.purchaseRequest.rejectedMessage', userLocale, { number: requestNumber, provider: currentRequest.provider_name, approver: approverName });

                    await sendEmail(
                        owner.email,
                        subject,
                        message,
                        htmlUser
                    );
                }

                // Create IN-APP Notification
                try {
                    const statusLabel = newStatus === 'approved' ? 'Aprovada' : 'Rejeitada';

                    await supabaseAdmin
                        .from('notifications')
                        .insert({
                            user_id: currentRequest.user_id,
                            type: 'purchase_request',
                            title: `Requisição ${statusLabel}`,
                            message: `Sua RQF ${requestNumber} foi ${statusLabel.toLowerCase()} por ${approverName}.${body.note ? ` Nota: ${body.note}` : ''}`,
                            link: viewUrl,
                            resource_id: currentRequest.id,
                            actor_id: userId,
                            metadata: {
                                type: `rq_${newStatus}`,
                                provider: currentRequest.provider_name,
                                value: currentRequest.total_value,
                                note: body.note || null,
                                requestNumber: requestNumber
                            },
                            created_at: new Date().toISOString()
                        });
                } catch (notifError) {
                    console.error('Failed to send RQF status change notification:', notifError);
                }

            } catch (emailError) {
                console.error('Failed to send approval email:', emailError);
            }
        })();

        return NextResponse.json({ data, success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}