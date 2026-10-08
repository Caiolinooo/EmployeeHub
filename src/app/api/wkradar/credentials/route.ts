import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/db';
import {
  generateWkradarDefaultUsername,
  tryGetWkradarDefaultPassword,
} from '@/lib/wkradar-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/wkradar/credentials
 * Retorna as credenciais WKRadar do usuário (customizadas ou padrão)
 */
export async function GET(request: NextRequest) {
    try {
        // Verificar autenticação
        const authHeader = request.headers.get('authorization');
        const token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Token não fornecido' },
                { status: 401 }
            );
        }

        const authResult = verifyToken(token);
        if (!authResult) {
            return NextResponse.json(
                { success: false, error: 'Token inválido' },
                { status: 401 }
            );
        }

        // Obter userId do query param ou do token
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId') || authResult.userId;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'ID do usuário não fornecido' },
                { status: 400 }
            );
        }

        // Buscar credenciais customizadas
        const { data: credentials, error } = await supabaseAdmin
            .from('wkradar_credentials')
            .select('username, password')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = No rows returned (não é erro, apenas não tem credenciais customizadas)
            console.error('Erro ao buscar credenciais WKRadar:', error);
            return NextResponse.json(
                { success: false, error: 'Erro ao buscar credenciais' },
                { status: 500 }
            );
        }

        if (credentials) {
            return NextResponse.json({
                success: true,
                credentials: {
                    username: credentials.username,
                    password: credentials.password
                },
                isCustom: true,
            });
        }

        // Sem credenciais customizadas — montar padrão via env (nunca hardcoded)
        const { data: userRow } = await supabaseAdmin
            .from('users_unified')
            .select('first_name, last_name, email')
            .eq('id', userId)
            .maybeSingle();

        const defaultPassword = tryGetWkradarDefaultPassword();
        const fullName = [userRow?.first_name, userRow?.last_name].filter(Boolean).join(' ');
        const defaultUsername = generateWkradarDefaultUsername(fullName, userRow?.email);

        if (!defaultPassword || !defaultUsername) {
            return NextResponse.json({
                success: true,
                credentials: null,
                isCustom: false,
                message: !defaultPassword
                    ? 'WKRADAR_DEFAULT_PASSWORD não configurado no servidor'
                    : 'Não foi possível gerar username padrão',
            });
        }

        return NextResponse.json({
            success: true,
            credentials: {
                username: defaultUsername,
                password: defaultPassword,
            },
            isCustom: false,
        });

    } catch (error) {
        console.error('Erro na API de credenciais WKRadar:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/wkradar/credentials
 * Cria ou atualiza credenciais WKRadar de um usuário (apenas admin)
 */
export async function POST(request: NextRequest) {
    try {
        // Verificar autenticação
        const authHeader = request.headers.get('authorization');
        const token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Token não fornecido' },
                { status: 401 }
            );
        }

        const authResult = verifyToken(token);
        if (!authResult) {
            return NextResponse.json(
                { success: false, error: 'Token inválido' },
                { status: 401 }
            );
        }

        // Verificar se é admin
        if (!(await canWithGrant(authResult.userId, authResult.role, ['wkradar.credentials.manage'], 'admin'))) {
            return NextResponse.json(
                { success: false, error: 'Acesso negado. Apenas administradores podem modificar credenciais.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { userId, username, password } = body;

        if (!userId || !username || !password) {
            return NextResponse.json(
                { success: false, error: 'userId, username e password são obrigatórios' },
                { status: 400 }
            );
        }

        // Upsert credenciais
        const { data, error } = await supabaseAdmin
            .from('wkradar_credentials')
            .upsert(
                {
                    user_id: userId,
                    username: username,
                    password: password,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'user_id'
                }
            )
            .select()
            .single();

        if (error) {
            console.error('Erro ao salvar credenciais WKRadar:', error);
            return NextResponse.json(
                { success: false, error: 'Erro ao salvar credenciais' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Credenciais salvas com sucesso',
            credentials: {
                userId: data.user_id,
                username: data.username
            }
        });

    } catch (error) {
        console.error('Erro na API de credenciais WKRadar:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/wkradar/credentials
 * Remove credenciais customizadas de um usuário (volta ao padrão)
 */
export async function DELETE(request: NextRequest) {
    try {
        // Verificar autenticação
        const authHeader = request.headers.get('authorization');
        const token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Token não fornecido' },
                { status: 401 }
            );
        }

        const authResult = verifyToken(token);
        if (!authResult) {
            return NextResponse.json(
                { success: false, error: 'Token inválido' },
                { status: 401 }
            );
        }

        // Verificar se é admin
        if (!(await canWithGrant(authResult.userId, authResult.role, ['wkradar.credentials.manage'], 'admin'))) {
            return NextResponse.json(
                { success: false, error: 'Acesso negado. Apenas administradores podem remover credenciais.' },
                { status: 403 }
            );
        }

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId é obrigatório' },
                { status: 400 }
            );
        }

        // Deletar credenciais
        const { error } = await supabaseAdmin
            .from('wkradar_credentials')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('Erro ao remover credenciais WKRadar:', error);
            return NextResponse.json(
                { success: false, error: 'Erro ao remover credenciais' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Credenciais removidas. O usuário usará as credenciais padrão.'
        });

    } catch (error) {
        console.error('Erro na API de credenciais WKRadar:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
