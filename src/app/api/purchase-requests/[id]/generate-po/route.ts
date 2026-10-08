import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

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
        const role = payload.role?.toUpperCase();

        // Only Admins can generate PO from request
        if (!(await canWithGrant(payload.userId, role, ['compras.generate_po'], 'admin'))) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        // Fetch the purchase request
        const { data: rqfData, error: fetchError } = await supabaseAdmin
            .from('purchase_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !rqfData) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // Fetch the items for this request
        const { data: requestItems, error: itemsError } = await supabaseAdmin
            .from('purchase_request_items')
            .select('*')
            .eq('purchase_request_id', id);

        if (itemsError) {
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }

        // Check if request is approved
        if (rqfData.status !== 'approved') {
            return NextResponse.json({ error: 'Request must be approved first' }, { status: 400 });
        }

        // Generate PO number
        const { data: sector } = await supabaseAdmin
            .from('sectors')
            .select('name')
            .eq('id', rqfData.sector_id)
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

        const poNumber = highestSequence === 0 
            ? basePoNumber 
            : `${basePoNumber}-${String(highestSequence + 1).padStart(2, '0')}`;

        // Create the purchase order
        const { data: newOrder, error } = await supabaseAdmin
            .from('purchase_orders')
            .insert({
                po_number: poNumber,
                user_id: rqfData.created_by || payload.userId,
                sector_id: rqfData.sector_id,
                provider_name: rqfData.provider_name,
                provider_cnpj: rqfData.provider_cnpj,
                provider_email: rqfData.provider_email,
                buyer_name: rqfData.buyer_name,
                total_value: rqfData.total_value,
                items: requestItems,
                observation: rqfData.observation,
                status: 'draft',
                history: [{
                    action: 'generated_from_request',
                    user_id: payload.userId,
                    date: new Date().toISOString(),
                    note: `Generated from RQF ${rqfData.rqf_number}`
                }]
            })
            .select()
            .single();

        if (error) throw error;

        // Update the request to mark it as processed
        await supabaseAdmin
            .from('purchase_requests')
            .update({
                status: 'processed',
                history: [...(rqfData.history || []), {
                    action: 'processed',
                    user_id: payload.userId,
                    date: new Date().toISOString(),
                    note: `Purchase order ${poNumber} generated`
                }]
            })
            .eq('id', id);

        // Create record in generated_purchase_orders
        await supabaseAdmin
            .from('generated_purchase_orders')
            .insert({
                request_id: id,
                po_number: poNumber,
                provider_name: rqfData.provider_name,
                total_value: rqfData.total_value,
                items: requestItems,
                status: 'draft'
            });

        return NextResponse.json({ data: newOrder, success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Helper functions (moved here for self-containment)
function getCurrentDateCode(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function buildSectorCode(sectorName?: string | null) {
    const normalized = (sectorName || 'PO')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase();

    const parts = normalized
        .split(/[^A-Z0-9]+/)
        .filter(Boolean)
        .filter(part => part.length > 1);

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`;
    }

    const compact = (parts[0] || normalized.replace(/[^A-Z0-9]/g, '') || 'PO').slice(0, 2);
    return compact.padEnd(2, 'X');
}