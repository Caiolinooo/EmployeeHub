import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { buildAppUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

const SECTOR_CODE_STOPWORDS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);

function getCurrentDateCode(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function buildSectorCode(sectorName?: string | null) {
    const normalized = (sectorName || 'PO')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

    const parts = normalized
        .split(/[^A-Z0-9]+/)
        .filter(Boolean)
        .filter(part => !SECTOR_CODE_STOPWORDS.has(part));

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`;
    }

    const compact = (parts[0] || normalized.replace(/[^A-Z0-9]/g, '') || 'PO').slice(0, 2);
    return compact.padEnd(2, 'X');
}

async function generatePurchaseOrderNumber(sectorId: string) {
    const { data: sector } = await supabaseAdmin
        .from('sectors')
        .select('name')
        .eq('id', sectorId)
        .maybeSingle();

    const basePoNumber = `${getCurrentDateCode()}-${buildSectorCode(sector?.name)}`;

    const { data: existingNumbers } = await supabaseAdmin
        .from('purchase_orders')
        .select('po_number')
        .ilike('po_number', `${basePoNumber}%`);

    const highestSequence = (existingNumbers || []).reduce((max, row) => {
        const currentNumber = row.po_number;
        if (!currentNumber) return max;
        if (currentNumber === basePoNumber) return Math.max(max, 1);
        if (!currentNumber.startsWith(`${basePoNumber}-`)) return max;

        const suffix = Number(currentNumber.replace(`${basePoNumber}-`, ''));
        return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
    }, 0);

    if (highestSequence === 0) {
        return basePoNumber;
    }

    return `${basePoNumber}-${String(highestSequence + 1).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value || null;
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const userId = payload.userId;
        const role = payload.role?.toUpperCase() || 'USER';

        let query = supabaseAdmin
            .from('purchase_orders')
            .select('*')
            .order('created_at', { ascending: false });

        // RBAC Logic
        if (role === 'ADMIN') {
            // See all - no filter
        } else if (role === 'MANAGER') {
            // See own orders OR assigned orders (checked via approver_ids containment)
            // Postgres array containment operator: approver_ids @> {userId}
            // Supabase/PostgREST syntax: approver_ids.cs.{userId}
            query = query.or(`user_id.eq.${userId},approver_ids.cs.{${userId}}`);
        } else {
            // Regular user - see own only
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching POs:', error);
            return NextResponse.json({ data: [], warning: error.message });
        }

        return NextResponse.json({ data: data || [] });

    } catch (error: any) {
        console.error('API Error in purchase-orders GET:', error);
        return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value || null;
        }

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = verifyToken(token);
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();

        // Validate required fields (basic validation)
        if (!body.provider_name || !body.total_value || !body.sector_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const poNumber = await generatePurchaseOrderNumber(body.sector_id);

        const { data, error } = await supabaseAdmin
            .from('purchase_orders')
            .insert({
                ...body,
                po_number: poNumber,
                user_id: payload.userId, // Force user_id to current user
                status: 'submitted', // Default status
                history: [{
                    action: 'created',
                    user_id: payload.userId,
                    date: new Date().toISOString()
                }]
            })
            .select()
            .single();

        if (error) throw error;

        // Send confirmation email asynchronously
        // Send confirmation email and notification to approvers
        (async () => {
            try {
                // 1. Fetch User details
                const { data: user } = await supabaseAdmin
                    .from('users_unified')
                    .select('name, email, sector_id')
                    .eq('id', payload.userId)
                    .single();

                if (!user) return;

                const { sendEmail } = await import('@/lib/email-exchange');
                const { purchaseOrderCreatedTemplate, poApprovalRequestTemplate } = await import('@/lib/emailTemplates');
                const { getTranslation } = await import('@/i18n'); // Import dynamic translator

                // Get locale or default to pt-BR
                let userLocale = request.headers.get('x-client-locale');
                const acceptLanguage = request.headers.get('accept-language');

                if (!userLocale && acceptLanguage) {
                    // Extract first language from Accept-Language header
                    userLocale = acceptLanguage.split(',')[0].trim();
                    console.log(`PO Create: Fallback to Accept-Language '${userLocale}'`);
                }

                userLocale = userLocale || 'pt-BR';
                console.log(`PO Create: Final locale determined '${userLocale}'`);

                const t = (key: string, locale: string, params?: any) => getTranslation(locale as any, key, undefined, params);

                const poNumber = data.po_number || '#' + data.id.slice(0, 8);
                const viewUrl = buildAppUrl(`/department/purchase-orders/${data.id}`, request.headers);

                // 2. Email the Requester (Confirmation)
                if (user.email) {
                    const htmlUser = purchaseOrderCreatedTemplate(
                        user.name || 'Colaborador',
                        poNumber,
                        body.provider_name,
                        body.total_value,
                        body.items?.length || 0,
                        viewUrl,
                        data.invoice_url,
                        userLocale
                    );
                    await sendEmail(
                        user.email,
                        t('emails.purchaseOrder.subject.created', userLocale, { number: poNumber }),
                        t('emails.purchaseOrder.createdMessage', userLocale),
                        htmlUser
                    );
                }

                // 3. Email Approvers (Dynamic based on Tiered Rules)
                let approversToNotify: string[] = [];
                let configToUse = null;

                // 3.1 Check User Exception Config First
                const { data: userConfig } = await supabaseAdmin
                    .from('purchase_order_configs')
                    .select('approval_rules, approver_emails')
                    .eq('user_id', payload.userId)
                    .maybeSingle();

                if (userConfig) {
                    configToUse = userConfig;
                } else if (user.sector_id) {
                    // 3.2 Fallback to Sector Config
                    const { data: sectorConfig } = await supabaseAdmin
                        .from('purchase_order_configs')
                        .select('approval_rules, approver_emails')
                        .eq('sector_id', user.sector_id)
                        .is('user_id', null)
                        .maybeSingle();

                    if (sectorConfig) {
                        configToUse = sectorConfig;
                    }
                }

                if (configToUse) {
                    const rules = configToUse.approval_rules as { email: string, limit: number }[] || [];
                    const poValue = Number(body.total_value);

                    if (rules.length > 0) {
                        // Sort by limit ascending
                        rules.sort((a, b) => a.limit - b.limit);

                        // Find the first rule that covers this value (Lowest Sufficient Authority)
                        const targetRule = rules.find(r => r.limit >= poValue);
                        const targetLimit = targetRule ? targetRule.limit : -1;

                        if (targetRule) {
                            // Add EVERYONE who has this specific limit (in case of multiple peers at same level)
                            const peers = rules.filter(r => r.limit === targetLimit);
                            peers.forEach(p => approversToNotify.push(p.email));
                        } else {
                            // Value exceeds all limits? Notify the highest tier(s)
                            const highestLimit = rules[rules.length - 1].limit;
                            const highestTierApprovers = rules.filter(r => r.limit === highestLimit);
                            highestTierApprovers.forEach(p => approversToNotify.push(p.email));
                        }
                    } else if (configToUse.approver_emails && configToUse.approver_emails.length > 0) {
                        // Fallback to legacy list
                        approversToNotify = configToUse.approver_emails;
                    }
                }

                // Fallback if no configuration found at all (Default Directors)
                if (approversToNotify.length === 0) {
                    approversToNotify = ['gordon@groupabz.com', 'william@groupabz.com'];
                }

                // Filter valid emails and remove duplicates
                approversToNotify = [...new Set(approversToNotify.filter(e => e && e.includes('@')))];
                const CC_EMAILS = ['karla@groupabz.com'];

                // RESOLVE APPROVER IDs
                // Fetch IDs for all approver emails to store in the DB for permission checks
                const approverIds: string[] = [];
                if (approversToNotify.length > 0) {
                    const { data: approverUsers } = await supabaseAdmin
                        .from('users_unified')
                        .select('id, email')
                        .in('email', approversToNotify);

                    if (approverUsers) {
                        approverUsers.forEach(u => approverIds.push(u.id));
                    }
                }

                // UPDATE PO WITH APPROVER IDs
                await supabaseAdmin
                    .from('purchase_orders')
                    .update({ approver_ids: approverIds })
                    .eq('id', data.id);


                // Send to Calculated Approvers
                for (const email of approversToNotify) {
                    // Fetch Approver Name
                    let approverName = 'Aprovador';
                    try {
                        const { data: approverData } = await supabaseAdmin
                            .from('users_unified')
                            .select('name')
                            .eq('email', email)
                            .maybeSingle();
                        if (approverData?.name) {
                            approverName = approverData.name.split(' ')[0]; // Use first name
                        }
                    } catch (e) {
                        console.error('Error fetching approver name', e);
                    }

                    // For approvers, we ideally should use their preferred locale, but for now we fallback to requester's or default
                    // In a perfect world we would fetch the approver's profile preference
                    const approverLocale = userLocale;

                    const htmlApprover = poApprovalRequestTemplate(
                        approverName,
                        user.name || 'Colaborador',
                        poNumber,
                        body.provider_name,
                        body.total_value,
                        body.items?.length || 0,
                        viewUrl,
                        data.invoice_url,
                        approverLocale
                    );

                    await sendEmail(
                        email,
                        t('emails.purchaseOrder.subject.approval', approverLocale, { number: poNumber }),
                        t('emails.purchaseOrder.approvalMessage', approverLocale, { name: user.name || 'Colaborador' }),
                        htmlApprover
                    );
                }

                // Send to CC (Karla)
                for (const email of CC_EMAILS) {
                    // Avoid sending double if Karla is also an approver
                    if (!approversToNotify.includes(email)) {
                        const htmlApprover = poApprovalRequestTemplate(
                            'Aprovador', // Generic for CC
                            user.name || 'Colaborador',
                            poNumber,
                            body.provider_name,
                            body.total_value,
                            body.items?.length || 0,
                            viewUrl,
                            data.invoice_url,
                            userLocale
                        );

                        await sendEmail(
                            email,
                            t('emails.purchaseOrder.subject.approvalCopy', userLocale, { number: poNumber }),
                            t('emails.purchaseOrder.approvalMessage', userLocale, { name: user.name || 'Colaborador' }),
                            htmlApprover
                        );
                    }
                }

                // 4. Create IN-APP Notifications
                try {
                    // Notify requester
                    await supabaseAdmin
                        .from('notifications')
                        .insert({
                            user_id: payload.userId,
                            type: 'purchase_order',
                            title: 'Requisição de Compra Criada',
                            message: `Sua OC ${poNumber} para ${body.provider_name} foi criada e aguarda aprovação.`,
                            link: viewUrl,
                            resource_id: data.id,
                            metadata: {
                                type: 'po_created',
                                provider: body.provider_name,
                                value: body.total_value,
                                poNumber: poNumber
                            },
                            created_at: new Date().toISOString()
                        });

                    // Notify approvers (in-app)
                    for (const approverEmail of approversToNotify) {
                        const { data: approverData } = await supabaseAdmin
                            .from('users_unified')
                            .select('id')
                            .eq('email', approverEmail)
                            .maybeSingle();

                        if (approverData?.id) {
                            await supabaseAdmin
                                .from('notifications')
                                .insert({
                                    user_id: approverData.id,
                                    type: 'purchase_order',
                                    title: 'Nova Requisição de Compra',
                                    message: `${user.name || 'Colaborador'} criou uma OC de R$ ${Number(body.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} que aguarda sua aprovação.`,
                                    link: viewUrl,
                                    resource_id: data.id,
                                    actor_id: payload.userId,
                                    metadata: {
                                        type: 'po_approval_request',
                                        provider: body.provider_name,
                                        value: body.total_value,
                                        poNumber: poNumber
                                    },
                                    created_at: new Date().toISOString()
                                });
                        }
                    }
                    console.log('✅ PO in-app notifications sent successfully');
                } catch (notifError) {
                    console.error('Failed to send PO in-app notifications:', notifError);
                }

            } catch (emailError) {
                console.error('Failed to send PO emails:', emailError);
            }
        })();


        return NextResponse.json({ data, success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
