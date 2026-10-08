import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value || null;
        }

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = verifyToken(token);
        if (!payload?.userId) return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });

        // Check if Admin
        const role = payload.role?.toUpperCase();
        const isAdmin = role === 'ADMIN';

        let sectorsData: any[] = [];
        let usersData: any[] = [];

        if (isAdmin) {
            // ADMIN: Return ALL sectors and their configs (left join to get even unconfigured ones)
            // Note: users_unified doesn't have a simple "all users" config, usually exceptions are stored
            // We will focus on Sectors first as requested.

            // Fetch All Sectors
            const { data: allSectors, error: sectorsError } = await supabaseAdmin
                .from('sectors')
                .select('id, name')
                .order('name');

            if (sectorsError) throw sectorsError;

            // Fetch All Configs
            const { data: allConfigs, error: configsError } = await supabaseAdmin
                .from('purchase_order_configs')
                .select('*');

            if (configsError) throw configsError;

            // Merge Data
            sectorsData = allSectors.map(sector => {
                const config = allConfigs.find(c => c.sector_id === sector.id);
                return {
                    type: 'sector',
                    config_id: config?.id || null,
                    sector_id: sector.id,
                    sector_name: sector.name,
                    max_value: config?.max_value || 0,
                    approver_emails: config?.approver_emails || [],
                    cost_centers: config?.cost_centers || [],
                    payment_terms: config?.payment_terms || [],
                    approval_rules: config?.approval_rules || [] // New Field
                };
            });

            // Also fetch User Exceptions (configs with user_id)
            const userConfigs = allConfigs.filter(c => c.user_id);
            // We need to fetch names for these users
            if (userConfigs.length > 0) {
                const userIds = userConfigs.map(c => c.user_id);
                const { data: users } = await supabaseAdmin
                    .from('users_unified')
                    .select('id, name, email')
                    .in('id', userIds);

                usersData = userConfigs.map(c => {
                    const u = users?.find(user => user.id === c.user_id);
                    return {
                        type: 'user',
                        config_id: c.id,
                        user_id: c.user_id,
                        user_name: u?.name || 'Unknown',
                        user_email: u?.email || '',
                        max_value: c.max_value || 0,
                        approver_emails: c.approver_emails || [],
                        cost_centers: c.cost_centers || [],
                        payment_terms: c.payment_terms || [],
                        approval_rules: c.approval_rules || []
                    };
                });
            }

        } else {
            // NON-ADMIN (User): Return only their sector config
            const { data: user, error: userError } = await supabaseAdmin
                .from('users_unified')
                .select('sector_id')
                .eq('id', payload.userId)
                .single();

            if (!userError && user?.sector_id) {
                const { data: config } = await supabaseAdmin
                    .from('purchase_order_configs')
                    .select('*')
                    .eq('sector_id', user.sector_id)
                    .maybeSingle();

                if (config) {
                    sectorsData = [{
                        type: 'sector',
                        config_id: config.id,
                        sector_id: user.sector_id,
                        max_value: config.max_value,
                        approver_emails: config.approver_emails,
                        cost_centers: config.cost_centers,
                        payment_terms: config.payment_terms || [],
                        approval_rules: config.approval_rules || []
                    }];
                }
            }
        }

        return NextResponse.json({ sectors: sectorsData, users: usersData });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
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
        const role = payload?.role?.toUpperCase();

        if (!(await canWithGrant(payload?.userId, role, ['compras.config'], 'admin'))) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const body = await request.json();

        // Validate Payload
        // We expect either sector_id or user_id
        if (!body.sector_id && !body.user_id) {
            return NextResponse.json({ error: 'Missing target (sector_id or user_id)' }, { status: 400 });
        }

        const targetField = body.sector_id ? 'sector_id' : 'user_id';
        const targetId = body.sector_id || body.user_id;

        // Check if config exists
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('purchase_order_configs')
            .select('id')
            .eq(targetField, targetId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        let result;
        const updateData = {
            cost_centers: body.cost_centers || [],
            payment_terms: body.payment_terms || [],
            max_value: body.max_value || 0,
            approver_emails: body.approver_emails || [], // Legacy Support
            approval_rules: body.approval_rules || [], // New Tiered Support
            updated_at: new Date().toISOString()
        };

        if (existing) {
            // Update
            result = await supabaseAdmin
                .from('purchase_order_configs')
                .update(updateData)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            // Insert
            result = await supabaseAdmin
                .from('purchase_order_configs')
                .insert({
                    [targetField]: targetId,
                    ...updateData
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        return NextResponse.json({ data: result.data, success: true });

    } catch (error: any) {
        console.error('Config Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
