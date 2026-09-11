import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/sectors - Returns all sectors for dropdown population
export async function GET(request: NextRequest) {
    try {
        const { data: sectors, error } = await supabaseAdmin
            .from('sectors')
            .select('id, name, description, allowed_modules, allowed_cards')
            .order('name');

        if (error) {
            console.error('Error fetching sectors:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(sectors || []);
    } catch (error: any) {
        console.error('Unexpected error fetching sectors:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/sectors - Create a new sector
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, description, allowed_modules = [], allowed_cards = [] } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'O nome do setor é obrigatório' }, { status: 400 });
        }

        // Check if sector with same name already exists
        const { data: existing } = await supabaseAdmin
            .from('sectors')
            .select('id')
            .ilike('name', name.trim())
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: 'Já existe um setor com este nome' }, { status: 409 });
        }

        const { data, error } = await supabaseAdmin
            .from('sectors')
            .insert({
                name: name.trim(),
                description: description ? description.trim() : '',
                allowed_modules: allowed_modules || [],
                allowed_cards: allowed_cards || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select('id, name, description, allowed_modules, allowed_cards')
            .single();

        if (error) {
            console.error('Error creating sector:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error: any) {
        console.error('Unexpected error creating sector:', error);
        return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
    }
}
