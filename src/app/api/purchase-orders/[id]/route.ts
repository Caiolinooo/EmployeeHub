import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { buildAppUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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
        const role = payload.role?.toUpperCase() || 'USER';
        const userId = payload.userId;

        const { data: order, error } = await supabaseAdmin
            .from('purchase_orders')
            .select('*, suppliers(*)')
            .eq('id', id)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Permission Check
        let canView = false;
        if (role === 'ADMIN') canView = true;
        else if (role === 'MANAGER') {
            canView = order.manager_id === userId || order.user_id === userId;
            // Also allow if manager has access to this sector? Assuming manager_id check covers it or basic access. 
            // For now sticking to the same logic as PUT roughly, but usually managers can view all in their sector.
            // Let's assume strict ownership/assignment for safety or check the list logic.
            // The list logic allowed: query.or(`user_id.eq.${userId},manager_id.eq.${userId}`);
            // Permissions: Owner OR Assigned Approver
            if (order.user_id === userId || (order.approver_ids && order.approver_ids.includes(userId))) canView = true;
        } else {
            if (order.user_id === userId) canView = true;
        }

        if (!canView) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        // Enrich History with Names
        if (order.history && Array.isArray(order.history)) {
            const enrichedHistory = await Promise.all(order.history.map(async (item: any) => {
                let userName = 'Usuário desconhecido';
                if (item.user_id) {
                    const { data: user } = await supabaseAdmin
                        .from('users_unified')
                        .select('name')
                        .eq('id', item.user_id)
                        .maybeSingle();
                    if (user) userName = user.name;
                }
                return { ...item, user_name: userName };
            }));
            order.history = enrichedHistory;
        }

        return NextResponse.json({ data: order });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

        // Fetch current order to check permissions
        const { data: currentOrder, error: fetchError } = await supabaseAdmin
            .from('purchase_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !currentOrder) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Permission Check
        let canEdit = false;
        if (role === 'ADMIN') canEdit = true;
        else if (role === 'MANAGER') {
            // Managers can only update if assigned to them (in approver_ids) or if they own it
            if ((currentOrder.approver_ids && currentOrder.approver_ids.includes(userId)) || currentOrder.user_id === userId) {
                canEdit = true;
            }
        } else {
            // Users can only update their own drafts
            if (currentOrder.user_id === userId && currentOrder.status === 'draft') {
                canEdit = true;
            }
        }

        if (!canEdit) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        // Update Logic
        const updates: any = { ...body };

        // Append to history if status changes
        if (body.status && body.status !== currentOrder.status) {
            const newHistoryItem = {
                action: 'status_change',
                from: currentOrder.status,
                to: body.status,
                user_id: userId,
                note: body.note || '',
                date: new Date().toISOString()
            };
            updates.history = [...(currentOrder.history || []), newHistoryItem];
        }

        const { data, error } = await supabaseAdmin
            .from('purchase_orders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Send Email Notification on Status Change
        if (body.status && ['approved', 'rejected'].includes(body.status) && body.status !== currentOrder.status) {
            (async () => {
                try {
                    // Fetch owner email
                    const { data: owner } = await supabaseAdmin
                        .from('users_unified')
                        .select('name, email')
                        .eq('id', currentOrder.user_id)
                        .single();

                    // Fetch admin/manager name (who updated it)
                    const { data: updater } = await supabaseAdmin
                        .from('users_unified')
                        .select('name')
                        .eq('id', userId)
                        .single();

                    const poNumber = currentOrder.po_number || currentOrder.id;
                    const viewUrl = buildAppUrl(`/department/purchase-orders/${currentOrder.id}`, request.headers);

                    const { sendEmail } = await import('@/lib/email-exchange');
                    const { orderStatusUpdateTemplate, poApprovedFiscalTemplate } = await import('@/lib/emailTemplates');
                    const { getTranslation } = await import('@/i18n');

                    // Get locale or default to pt-BR
                    let userLocale = request.headers.get('x-client-locale');
                    const acceptLanguage = request.headers.get('accept-language');

                    if (!userLocale && acceptLanguage) {
                        // Extract first language from Accept-Language header (e.g. "en-US,en;q=0.9" -> "en-US")
                        userLocale = acceptLanguage.split(',')[0].trim();
                        console.log(`PO Update [${id}]: Fallback to Accept-Language '${userLocale}'`);
                    }

                    userLocale = userLocale || 'pt-BR';
                    console.log(`PO Update [${id}]: Final locale determined '${userLocale}'`);

                    const t = (key: string, locale: string, params?: any) => getTranslation(locale as any, key, undefined, params);

                    // 1. Notify Owner (Approved/Rejected)
                    if (owner?.email) {
                        const htmlUser = orderStatusUpdateTemplate(
                            owner.name || 'Colaborador',
                            poNumber,
                            currentOrder.provider_name,
                            body.status,
                            updater?.name || 'Administrador',
                            body.note,
                            viewUrl,
                            userLocale
                        );

                        const subjectKey = body.status === 'approved'
                            ? 'emails.purchaseOrder.statusUpdateSubject' // "Atualização de Status - {{poNumber}}"
                            : 'emails.purchaseOrder.statusUpdateSubject'; // Using same key for now or explicit?

                        // Actually in pt-BR.ts we have 'statusUpdateSubject'.
                        // Let's use more specific subjects if available or construct it.
                        // statusUpdateSubject: 'Atualização de Status - {{poNumber}}'
                        // Wait, previous code hardcoded "Requisição de Compra Aprovada/Rejeitada".
                        // I should use t() for subject.

                        const subject = t('emails.purchaseOrder.statusUpdateSubject', userLocale, { poNumber });
                        const message = body.status === 'approved'
                            ? t('emails.purchaseOrder.approvedMessage', userLocale, { number: poNumber, provider: currentOrder.provider_name, approver: updater?.name })
                            : t('emails.purchaseOrder.rejectedMessage', userLocale, { number: poNumber, provider: currentOrder.provider_name, approver: updater?.name });

                        await sendEmail(
                            owner.email,
                            subject,
                            message, // Plain text fallback
                            htmlUser
                        );
                    }

                    // 2. If APPROVED, Notify Fiscal
                    if (body.status === 'approved') {
                        const FISCAL_EMAIL = 'fiscal@groupabz.com';
                        const htmlFiscal = poApprovedFiscalTemplate(
                            poNumber,
                            owner?.name || 'Não identificado',
                            currentOrder.provider_name,
                            currentOrder.total_value,
                            updater?.name || 'Diretoria',
                            currentOrder.invoice_url || '#',
                            viewUrl
                        );

                        await sendEmail(
                            FISCAL_EMAIL,
                            `OC APROVADA - ${poNumber}`,
                            `Ordem de compra aprovada para processamento.`,
                            htmlFiscal
                        );
                    }

                    // 3. AUTO-SEND OC PDF to Supplier
                    try {
                        // Determine supplier email
                        let supplierEmail: string | null = null;
                        let autoSend = true;

                        if (currentOrder.supplier_id) {
                            const { data: supplier } = await supabaseAdmin
                                .from('suppliers')
                                .select('contact_email, po_email, auto_send_po')
                                .eq('id', currentOrder.supplier_id)
                                .maybeSingle();

                            if (supplier) {
                                autoSend = supplier.auto_send_po !== false; // default true
                                supplierEmail = supplier.po_email || supplier.contact_email || null;
                            }
                        }

                        // Fallback to provider_email on the PO itself
                        if (!supplierEmail) {
                            supplierEmail = currentOrder.provider_email || null;
                        }

                        if (autoSend && supplierEmail) {
                            console.log(`[PO AUTO-SEND] Gerando PDF da OC ${poNumber} para ${supplierEmail}`);

                            const React = (await import('react')).default;
                            const { renderToBuffer } = await import('@react-pdf/renderer');
                            const { PurchaseOrderPdf } = await import('@/components/PurchaseOrder/PurchaseOrderPdf');
                            const { purchaseOrderToSupplierTemplate } = await import('@/lib/emailTemplates');

                            const pdfBuffer = await renderToBuffer(
                                React.createElement(PurchaseOrderPdf, { data: currentOrder }) as any
                            );

                            const rqfNumber = currentOrder.rqf_number || currentOrder.purchase_request_number || null;
                            const htmlSupplier = purchaseOrderToSupplierTemplate(
                                poNumber,
                                rqfNumber,
                                owner?.name || 'Requisitante',
                                currentOrder.total_value,
                                currentOrder.delivery_date || null,
                                currentOrder.payment_terms || null
                            );

                            const sendResult = await sendEmail(
                                supplierEmail,
                                `Ordem de Compra ${poNumber} — ABZ Group`,
                                `Prezado(a) Fornecedor(a), segue em anexo a Ordem de Compra ${poNumber}. Por favor, confirme o recebimento respondendo este e-mail.`,
                                htmlSupplier,
                                {
                                    attachments: [{
                                        filename: `OC-${poNumber}.pdf`,
                                        content: pdfBuffer,
                                        contentType: 'application/pdf'
                                    }]
                                }
                            );

                            if (sendResult.success) {
                                console.log(`[PO AUTO-SEND] ✅ OC enviada para fornecedor ${supplierEmail}. ID: ${sendResult.messageId}`);
                            } else {
                                console.error(`[PO AUTO-SEND] ❌ Falha ao enviar para fornecedor: ${sendResult.message}`);
                            }
                        } else if (!autoSend) {
                            console.log(`[PO AUTO-SEND] Envio automático desativado para este fornecedor.`);
                        } else {
                            console.warn(`[PO AUTO-SEND] Nenhum e-mail de fornecedor disponível para OC ${poNumber}.`);
                        }
                    } catch (supplierEmailError) {
                        console.error('[PO AUTO-SEND] Erro ao enviar OC para fornecedor:', supplierEmailError);
                    }


                    try {
                        const statusLabel = body.status === 'approved' ? 'Aprovada' : 'Rejeitada';
                        // Ideally translate in-app notification too based on recipient's preference, 
                        // but we don't have it. Storing in Portuguese is safer for now as system default, 
                        // or we could store translation key if frontend supported it.
                        // Sticking to hardcoded PT for DB notifications as per previous logic for now.

                        await supabaseAdmin
                            .from('notifications')
                            .insert({
                                user_id: currentOrder.user_id,
                                type: 'purchase_order',
                                title: `Requisição de Compra ${statusLabel}`,
                                message: `Sua OC ${poNumber} foi ${statusLabel.toLowerCase()} por ${updater?.name || 'Administrador'}.${body.note ? ` Nota: ${body.note}` : ''}`,
                                link: viewUrl,
                                resource_id: currentOrder.id,
                                actor_id: userId,
                                metadata: {
                                    type: `po_${body.status}`,
                                    provider: currentOrder.provider_name,
                                    value: currentOrder.total_value,
                                    note: body.note || null,
                                    poNumber: poNumber
                                },
                                created_at: new Date().toISOString()
                            });
                        console.log(`✅ PO status change notification sent to owner (${body.status})`);
                    } catch (notifError) {
                        console.error('Failed to send PO status change notification:', notifError);
                    }

                } catch (emailError) {
                    console.error('Failed to send status update email:', emailError);
                }
            })();
        }


        return NextResponse.json({ data, success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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
        const role = payload.role?.toUpperCase() || 'USER';

        // Only Admins can delete
        if (!(await canWithGrant(payload.userId, role, ['compras.delete'], 'admin'))) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('purchase_orders')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
