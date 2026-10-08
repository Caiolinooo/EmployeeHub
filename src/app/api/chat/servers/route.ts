import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
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

        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // 1. Buscar servidores onde o usuário é membro
        const { data: memberships } = await admin
            .from('chat_server_members')
            .select('server_id')
            .eq('user_id', payload.userId);

        const memberServerIds = memberships?.map(m => m.server_id) || [];

        // 2. Buscar servidores (Públicos OU Membro)
        // Nota: .or() com array values é complexo, então vamos simplificar
        // Se a lista de memberServerIds for muito grande, isso pode ser um problema, mas para este escopo é aceitável.

        // Vamos construir a query
        let query = admin
            .from('chat_servers')
            .select(`
                *,
                members:chat_server_members(count)
            `)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (memberServerIds.length > 0) {
            // is_public=true OR id in memberServerIds
            query = query.or(`is_public.eq.true,id.in.(${memberServerIds.join(',')})`);
        } else {
            query = query.eq('is_public', true);
        }

        const { data: servers, error: serverError } = await query;

        if (serverError) {
            console.error('Erro ao buscar servidores:', serverError);
            return NextResponse.json({
                success: false,
                error: 'Erro ao buscar servidores'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            servers: servers
        });

    } catch (error) {
        console.error('Erro na API de servidores:', error);
        return NextResponse.json({
            success: false,
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
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
        const { name, description, icon_url, is_public = false } = body;

        if (!name) {
            return NextResponse.json({
                success: false,
                error: 'Nome do servidor é obrigatório'
            }, { status: 400 });
        }

        // Criar servidor
        const { data: server, error: createError } = await admin
            .from('chat_servers')
            .insert({
                name,
                description,
                icon_url,
                is_public,
                created_by: payload.userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) {
            console.error('Erro ao criar servidor:', createError);
            return NextResponse.json({
                success: false,
                error: 'Erro ao criar servidor'
            }, { status: 500 });
        }

        // Adicionar criador como membro (owner)
        await admin.from('chat_server_members').insert({
            server_id: server.id,
            user_id: payload.userId,
            role: 'owner',
            joined_at: new Date().toISOString()
        });

        // Criar canal #geral padrão
        await admin.from('chat_channels').insert({
            name: 'geral',
            description: 'Canal geral do servidor',
            type: 'public',
            server_id: server.id,
            created_by: payload.userId,
            is_archived: false,
            settings: { allowFileUploads: true },
            permissions: { isPublic: true },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            server
        });

    } catch (error) {
        console.error('Erro ao criar servidor:', error);
        return NextResponse.json({
            success: false,
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
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
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID do servidor é obrigatório'
            }, { status: 400 });
        }

        // Buscar servidor
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

        // Verificar permissões (apenas owner ou admin sistema)
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
                error: 'Sem permissão para excluir este servidor'
            }, { status: 403 });
        }

        // Excluir memberships primeiro (opcional se houver cascade, mas seguro garantir)
        await admin.from('chat_server_members').delete().eq('server_id', id);

        // Excluir canais
        await admin.from('chat_channels').delete().eq('server_id', id);

        // Excluir servidor
        const { error: deleteError } = await admin
            .from('chat_servers')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Erro ao excluir servidor:', deleteError);
            return NextResponse.json({
                success: false,
                error: 'Erro ao excluir servidor'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Servidor excluído com sucesso'
        });

    } catch (error) {
        console.error('Erro ao excluir servidor:', error);
        return NextResponse.json({
            success: false,
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}
