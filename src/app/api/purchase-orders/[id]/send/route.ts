import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db'; // Use admin client for storage/db access if needed
import { isAdminFromRequest } from '@/lib/auth'; // Or just check user session
import { renderToBuffer } from '@react-pdf/renderer';
import { PurchaseOrderPdf } from '@/components/PurchaseOrder/PurchaseOrderPdf';
import { sendEmail } from '@/lib/email/service';
import { buildAppUrl } from '@/lib/app-url';
import React from 'react';

// Force dynamic to ensure we can read request/cookies
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const poId = params.id;
    if (!poId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    try {
        // 1. Fetch PO Data
        const { data: po, error } = await supabaseAdmin
            .from('purchase_orders')
            .select(`*, suppliers(*)`)
            .eq('id', poId)
            .single();

        if (error || !po) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // 2. Determine Configuration (Workflow Automation)
        let approversToNotify: string[] = [];
        let configToUse = null;

        // 2.1 Check User Exception Config First
        const { data: userConfig } = await supabaseAdmin
            .from('purchase_order_configs')
            .select('approval_rules, approver_emails')
            .eq('user_id', po.user_id)
            .maybeSingle();

        if (userConfig) {
            configToUse = userConfig;
        } else if (po.sector_id) {
            // 2.2 Fallback to Sector Config
            const { data: sectorConfig } = await supabaseAdmin
                .from('purchase_order_configs')
                .select('approval_rules, approver_emails')
                .eq('sector_id', po.sector_id)
                .is('user_id', null)
                .maybeSingle();

            if (sectorConfig) {
                configToUse = sectorConfig;
            }
        }

        if (configToUse) {
            const rules = configToUse.approval_rules as { email: string, limit: number }[] || [];
            const poValue = Number(po.total_value);

            if (rules.length > 0) {
                // Sort by limit ascending
                rules.sort((a, b) => a.limit - b.limit);
                // Find target limit
                const targetRule = rules.find(r => r.limit >= poValue);
                if (targetRule) {
                    const peers = rules.filter(r => r.limit === targetRule.limit);
                    peers.forEach(p => approversToNotify.push(p.email));
                } else {
                    const highestLimit = rules[rules.length - 1].limit;
                    const highestTierApprovers = rules.filter(r => r.limit === highestLimit);
                    highestTierApprovers.forEach(p => approversToNotify.push(p.email));
                }
            } else if (configToUse.approver_emails && configToUse.approver_emails.length > 0) {
                approversToNotify = configToUse.approver_emails;
            }
        }

        if (approversToNotify.length === 0) {
            approversToNotify = ['gordon@groupabz.com', 'william@groupabz.com'];
        }

        approversToNotify = [...new Set(approversToNotify.filter(e => e && e.includes('@')))];

        if (approversToNotify.length === 0) {
            console.warn(`No valid approver emails for PO ${poId}`);
        } else {
            // 3. Workflow Notifications (In-Portal)
            try {
                // Find User IDs for these emails to send system notifications
                const { data: approverUsers } = await supabaseAdmin
                    .from('users_unified')
                    .select('id, email')
                    .in('email', approversToNotify);

                if (approverUsers && approverUsers.length > 0) {
                    const notificationsToInsert = approverUsers.map(approver => ({
                        user_id: approver.id,
                        type: 'action', // Action required
                        title: 'Nova Aprovação Pendente',
                        message: `Nova Requisição de Compra #${po.po_number || 'N/A'} de ${po.buyer_name} aguardando sua aprovação. Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(po.total_value)}`,
                        link: `/admin/purchase-orders/${po.id}`, // Link to approval page
                        actor_id: po.user_id, // The requester is the actor
                        created_at: new Date().toISOString()
                    }));

                    const { error: notifError } = await supabaseAdmin
                        .from('notifications')
                        .insert(notificationsToInsert);

                    if (notifError) {
                        console.error('Failed to create in-portal notifications:', notifError);
                    } else {
                        console.log(`Created ${notificationsToInsert.length} in-portal notifications.`);
                    }
                }
            } catch (notifyErr) {
                console.error('Error in notification logic:', notifyErr);
            }
        }

        // 3. Generate PDF
        // @ts-expect-error - renderToBuffer não tipa os props do componente PDF
        const pdfBuffer = await renderToBuffer(React.createElement(PurchaseOrderPdf, { data: po }));

        // 4. Prepare Attachments
        const attachments = [
            {
                filename: `OR_ABZ_${po.po_number || poId}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ];

        // 5. Fetch Invoice if exists
        if (po.invoice_url) {
            try {
                const invoiceRes = await fetch(po.invoice_url);
                if (invoiceRes.ok) {
                    const invoiceBuffer = await invoiceRes.arrayBuffer();
                    const invoiceName = po.invoice_url.split('/').pop() || 'invoice';

                    attachments.push({
                        filename: invoiceName,
                        content: Buffer.from(invoiceBuffer),
                        contentType: invoiceRes.headers.get('content-type') || 'application/octet-stream'
                    });
                }
            } catch (err) {
                console.error('Failed to attach invoice:', err);
            }
        }

        // 6. Send Email using Standard Templates
        const { getTranslation } = await import('@/i18n');
        const { poApprovalRequestTemplate } = await import('@/lib/emailTemplates');

        let userLocale = request.headers.get('x-client-locale');
        const acceptLanguage = request.headers.get('accept-language');
        if (!userLocale && acceptLanguage) {
            userLocale = acceptLanguage.split(',')[0].trim();
        }
        userLocale = userLocale || 'pt-BR';
        const t = (key: string, locale: string, params?: any) => getTranslation(locale as any, key, undefined, params);

        const viewUrl = buildAppUrl(`/department/purchase-orders/${po.id}`, request.headers);
        const poNumber = po.po_number || poId;

        // Only send if we have recipients
        if (approversToNotify.length > 0) {
            for (const email of approversToNotify) {
                let approverName = 'Aprovador';
                const { data: approverData } = await supabaseAdmin
                    .from('users_unified')
                    .select('name')
                    .eq('email', email)
                    .maybeSingle();

                if (approverData?.name) {
                    approverName = approverData.name.split(' ')[0];
                }

                const emailHtml = poApprovalRequestTemplate(
                    approverName,
                    po.buyer_name || 'Colaborador',
                    poNumber,
                    po.provider_name,
                    po.total_value,
                    po.items?.length || 0,
                    viewUrl,
                    po.invoice_url,
                    userLocale
                );

                await sendEmail({
                    to: email, // Notice: sendEmail here takes an object due to the signature in @/lib/email/service (resend logic?)
                    subject: t('emails.purchaseOrder.subject.approval', userLocale, { number: poNumber }),
                    html: emailHtml,
                    attachments
                });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error processing PO email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
