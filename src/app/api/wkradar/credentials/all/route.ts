import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/wkradar/credentials/all
 * Retorna todas as credenciais WKRadar (apenas admin)
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

        // Verificar se é admin
        if (!(await canWithGrant(authResult.userId, authResult.role, ['wkradar.credentials.view_all'], 'admin'))) {
            return NextResponse.json(
                { success: false, error: 'Acesso negado. Apenas administradores podem listar credenciais.' },
                { status: 403 }
            );
        }

        // Buscar todas as credenciais (sem retornar a senha por segurança? - não, admin precisa ver)
        const { data: credentials, error } = await supabaseAdmin
            .from('wkradar_credentials')
            .select('user_id, username, password, created_at, updated_at')
            .order('updated_at', { ascending: false });

        if (error) {
            // Se a tabela não existir, retornar lista vazia
            if (error.code === '42P01') {
                return NextResponse.json({
                    success: true,
                    credentials: [],
                    message: 'Tabela ainda não foi criada'
                });
            }

            console.error('Erro ao buscar credenciais WKRadar:', error);
            return NextResponse.json(
                { success: false, error: 'Erro ao buscar credenciais' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            credentials: credentials || []
        });

    } catch (error) {
        console.error('Erro na API de credenciais WKRadar:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
