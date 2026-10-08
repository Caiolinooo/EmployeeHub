import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Verificar autenticação
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');
        const payload = verifyToken(token);

        if (!payload) {
            return NextResponse.json({
                success: false,
                error: 'Token inválido'
            }, { status: 401 });
        }

        const admin = await getSupabaseAdmin();
        const body = await request.json();
        const { name, description, icon_url, is_public } = body;

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID do servidor é obrigatório'
            }, { status: 400 });
        }

        // Buscar servidor para verificar permissões
        const { data: server, error: fetchError } = await admin
            .from('chat_servers')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !server) {
            return NextResponse.json({
                success: false,
                error: 'Servidor não encontrado'
            }, { status: 404 });
        }

        // Verificar permissões (owner ou admin)
        const { data: user } = await admin
            .from('users_unified')
            .select('role')
            .eq('id', payload.userId)
            .single();

        const isOwner = server.created_by === payload.userId;
        const isSystemAdmin = !!user && (await canWithGrant(payload.userId, user.role, ['chat.moderate'], 'admin'));

        if (!isOwner && !isSystemAdmin) {
            return NextResponse.json({
                success: false,
                error: 'Sem permissão para editar este servidor'
            }, { status: 403 });
        }

        // Atualizar servidor
        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (icon_url !== undefined) updateData.icon_url = icon_url;
        if (is_public !== undefined) updateData.is_public = is_public;

        const { data: updatedServer, error: updateError } = await admin
            .from('chat_servers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Erro ao atualizar servidor:', updateError);
            return NextResponse.json({
                success: false,
                error: 'Erro ao atualizar servidor'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            server: updatedServer
        });

    } catch (error) {
        console.error('Erro ao atualizar servidor:', error);
        return NextResponse.json({
            success: false,
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}
