import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PUT /api/sectors/[id] - Update sector permissions
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const sectorId = params.id;
    if (!sectorId) {
        return NextResponse.json({ error: 'Missing sector ID' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { allowed_modules, allowed_cards } = body;

        const { data, error } = await supabaseAdmin
            .from('sectors')
            .update({
                allowed_modules: allowed_modules || [],
                allowed_cards: allowed_cards || []
            })
            .eq('id', sectorId)
            .select()
            .single();

        if (error) {
            console.error('Error updating sector:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Unexpected error updating sector:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/sectors/[id] - Delete a sector
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const sectorId = params.id;
    if (!sectorId) {
        return NextResponse.json({ error: 'Missing sector ID' }, { status: 400 });
    }

    try {
        const { error } = await supabaseAdmin
            .from('sectors')
            .delete()
            .eq('id', sectorId);

        if (error) {
            console.error('Error deleting sector:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Setor removido com sucesso' });
    } catch (error: any) {
        console.error('Unexpected error deleting sector:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
