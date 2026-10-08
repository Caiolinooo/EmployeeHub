import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/wkradar/seed-card
 * Creates the WKRadar card in the Card table if it doesn't exist
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
        if (!(await canWithGrant(authResult.userId, authResult.role, ['wkradar.card.seed'], 'admin'))) {
            return NextResponse.json(
                { success: false, error: 'Acesso negado. Apenas administradores podem criar o card.' },
                { status: 403 }
            );
        }

        // Verificar se o card já existe
        const { data: existingCard, error: checkError } = await supabaseAdmin
            .from('Card')
            .select('id')
            .eq('id', 'wkradar')
            .single();

        if (existingCard) {
            return NextResponse.json({
                success: true,
                message: 'Card WKRadar já existe',
                card: existingCard
            });
        }

        // Obter o próximo order
        const { data: lastCard } = await supabaseAdmin
            .from('Card')
            .select('order')
            .order('order', { ascending: false })
            .limit(1)
            .single();

        const nextOrder = (lastCard?.order || 0) + 1;

        // Criar o card WKRadar
        const wkradarCard = {
            id: 'wkradar',
            title: 'WKRadar',
            description: 'Acesso ao sistema WKRadar',
            href: '/wkradar',
            icon: 'FiMonitor',
            iconName: 'FiMonitor',
            color: 'bg-indigo-600',
            hoverColor: 'hover:bg-indigo-700',
            external: false,
            enabled: true,
            order: nextOrder,
            adminOnly: false,
            managerOnly: false,
            allowedRoles: [],
            allowedUserIds: [],
            moduleKey: 'wkradar', // Para controle de ACL
            titleEn: 'WKRadar',
            descriptionEn: 'Access WKRadar system',
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        const { data: newCard, error: insertError } = await supabaseAdmin
            .from('Card')
            .insert(wkradarCard)
            .select()
            .single();

        if (insertError) {
            console.error('Erro ao criar card WKRadar:', insertError);
            return NextResponse.json(
                { success: false, error: 'Erro ao criar card', details: insertError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Card WKRadar criado com sucesso',
            card: newCard
        });

    } catch (error) {
        console.error('Erro na API seed-card:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/wkradar/seed-card
 * Check if WKRadar card exists
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

        // Verificar se o card existe
        const { data: card, error } = await supabaseAdmin
            .from('Card')
            .select('*')
            .eq('id', 'wkradar')
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao verificar card WKRadar:', error);
            return NextResponse.json(
                { success: false, error: 'Erro ao verificar card' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            exists: !!card,
            card: card || null
        });

    } catch (error) {
        console.error('Erro na API seed-card:', error);
        return NextResponse.json(
            { success: false, error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
