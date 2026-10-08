import { NextRequest, NextResponse } from 'next/server';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET — Listar listas de presença (com filtros)
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query = supabaseAdmin
            .from('vw_listas_presenca_completo')
            .select('*')
            .order('created_at', { ascending: false });

        if (id) {
            query = query.eq('id', id);
        } else {
            query = query.range(offset, offset + limit - 1);
        }

        if (status) query = query.eq('status', status);
        if (search) query = query.or(`titulo.ilike.%${search}%,local.ilike.%${search}%`);

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao buscar listas:', error);
            return NextResponse.json({ error: 'Erro ao buscar listas' }, { status: 500 });
        }

        return NextResponse.json({ success: true, listas: data || [] });
    } catch (error) {
        console.error('Erro em GET /api/lista-presenca:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// POST — Criar nova lista de presença
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const body = await request.json();
        const { titulo, data_evento, hora_inicio, hora_fim, local, pauta, setor_id, template_id, acesso_publico, max_participantes, token_acesso } = body;

        if (!titulo || !data_evento) {
            return NextResponse.json({ error: 'Título e data do evento são obrigatórios' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('lista_presenca')
            .insert({
                titulo,
                data_evento,
                hora_inicio: hora_inicio || null,
                hora_fim: hora_fim || null,
                local: local || null,
                pauta: pauta || null,
                setor_id: setor_id || null,
                template_id: template_id || null,
                acesso_publico: acesso_publico || false,
                max_participantes: max_participantes || null,
                token_acesso: token_acesso || null,
                created_by: user.id,
            })
            .select('*')
            .single();

        if (error) {
            console.error('Erro ao criar lista:', error);
            return NextResponse.json({ error: 'Erro ao criar lista' }, { status: 500 });
        }

        return NextResponse.json({ success: true, lista: data });
    } catch (error) {
        console.error('Erro em POST /api/lista-presenca:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// PUT — Atualizar lista (status, dados)
export async function PUT(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        // If closing the list
        if (updateData.status === 'fechada') {
            updateData.fechada_em = new Date().toISOString();
            updateData.fechada_por = user.id;
        }
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('lista_presenca')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('Erro ao atualizar lista:', error);
            return NextResponse.json({ error: 'Erro ao atualizar lista' }, { status: 500 });
        }

        return NextResponse.json({ success: true, lista: data });
    } catch (error) {
        console.error('Erro em PUT /api/lista-presenca:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

// DELETE — Excluir lista
export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await authenticateUser(request);
        if (authError) return authError;
        if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

        // Only creator or admin can delete
        const { data: lista } = await supabaseAdmin
            .from('lista_presenca')
            .select('created_by')
            .eq('id', id)
            .single();

        if (!lista) return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 });
        if (lista.created_by !== user.id && !(await canWithGrant(user.id, user.role, ['lista-presenca.manage_any'], 'admin'))) {
            return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('lista_presenca')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao excluir lista:', error);
            return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erro em DELETE /api/lista-presenca:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
