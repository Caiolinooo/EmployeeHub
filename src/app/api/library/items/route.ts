import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermissionOrGrant } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = supabaseAdmin
        .from('library_items')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (type) {
        query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST is restricted to admins/managers (using withAdmin for now based on request)
export const POST = withPermissionOrGrant('admin', ['biblioteca.create', 'biblioteca.manage'], async (request: NextRequest, user) => {
    try {
        const json = await request.json();
        const { title, slug, description, type, content_url, content_text, metadata } = json;

        const { data, error } = await supabaseAdmin
            .from('library_items')
            .insert({
                title,
                slug,
                description,
                type,
                content_url,
                content_text,
                metadata,
                created_by: user.id
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
});
