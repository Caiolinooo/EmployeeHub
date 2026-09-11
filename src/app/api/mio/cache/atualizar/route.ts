import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { mioClient } from '@/lib/mio/client';
import { runMioPull } from '@/lib/mio/pull-context';

export const dynamic = 'force-dynamic';
const MIN_INTERVAL_MS = 10_000; // 10 segundos entre sincronizações

async function isAuthorized(request: NextRequest): Promise<boolean> {
    let token: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value || null;
    }

    if (token) {
        const decoded = verifyToken(token);
        if (decoded && (decoded.role === 'ADMIN' || decoded.role === 'MANAGER')) return true;
    }
    if (process.env.NODE_ENV === 'development') return true;
    return false;
}

export async function POST(request: NextRequest) {
    try {
        if (!(await isAuthorized(request))) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        // Suporta query parameter ou corpo da requisição (JSON)
        let requestedTipos: string[] = [];
        const { searchParams } = new URL(request.url);
        const queryTipo = searchParams.get('tipo');
        if (queryTipo) {
            requestedTipos = queryTipo.split(',').map(t => t.trim()).filter(Boolean);
        } else {
            try {
                const body = await request.clone().json();
                if (body && body.tipo) {
                    if (Array.isArray(body.tipo)) {
                        requestedTipos = body.tipo;
                    } else if (typeof body.tipo === 'string') {
                        requestedTipos = body.tipo.split(',').map((t: string) => t.trim()).filter(Boolean);
                    }
                }
            } catch (e) {
                // Ignore se não tiver body ou não for JSON
            }
        }

        const ALL_TIPOS = ['integrantes', 'treinamentos', 'embarques', 'lgp_reports'];
        const targets = requestedTipos.length > 0
            ? requestedTipos.filter(t => ALL_TIPOS.includes(t))
            : ALL_TIPOS;

        if (targets.length === 0) {
            return NextResponse.json({ success: false, error: 'Tipos de dados inválidos ou não suportados' }, { status: 400 });
        }

        // Verifica se cada um dos alvos está dentro da janela do limite mínimo (10s)
        const { data: existingRows } = await supabaseAdmin
            .from('mio_cache')
            .select('tipo, atualizado_em')
            .in('tipo', targets);

        const recentTipos: string[] = [];
        if (existingRows && existingRows.length > 0) {
            for (const row of existingRows) {
                const diff = Date.now() - new Date(row.atualizado_em).getTime();
                if (diff < MIN_INTERVAL_MS) {
                    recentTipos.push(row.tipo);
                }
            }
        }

        // Se todos os tipos alvos forem recentes, retorna cached: true imediatamente
        if (recentTipos.length === targets.length) {
            return NextResponse.json({
                success: true,
                cached: true,
                message: `Cache dos tipos (${targets.join(', ')}) ainda recente. Aguarde.`,
            });
        }

        const toUpdate = targets.filter(t => !recentTipos.includes(t));
        console.log(`[MIO Cache] Iniciando coleta seletiva para: ${toUpdate.join(', ')}`);

        let integrantes: any[] = [];
        let treinamentos: any[] = [];
        let embarques: any[] = [];
        let lgpReports: any[] = [];

        const fetchPromises: Promise<any>[] = [];

        await runMioPull(async () => {
        if (toUpdate.includes('integrantes')) {
            fetchPromises.push(
                mioClient.getIntegrantes()
                    .then(res => { integrantes = res; })
                    .catch(e => { console.error('[MIO Cache] Erro integrantes:', e); })
            );
        }
        if (toUpdate.includes('treinamentos')) {
            fetchPromises.push(
                mioClient.getAllTreinamentos()
                    .then(res => { treinamentos = res; })
                    .catch(e => { console.error('[MIO Cache] Erro treinamentos:', e); })
            );
        }
        if (toUpdate.includes('embarques')) {
            fetchPromises.push(
                mioClient.getAllEmbarques()
                    .then(res => { embarques = res; })
                    .catch(e => { console.error('[MIO Cache] Erro embarques:', e); })
            );
        }
        if (toUpdate.includes('lgp_reports')) {
            fetchPromises.push(
                mioClient.getLGPReportsRaw()
                    .then(res => { lgpReports = res; })
                    .catch(e => { console.error('[MIO Cache] Erro LGP:', e); })
            );
        }

        await Promise.all(fetchPromises);
        });

        const now = new Date().toISOString();
        const entries: any[] = [];

        if (toUpdate.includes('integrantes')) {
            entries.push({ tipo: 'integrantes', dados: JSON.stringify(integrantes), total_registros: integrantes.length, atualizado_em: now });
        }
        if (toUpdate.includes('treinamentos')) {
            entries.push({ tipo: 'treinamentos', dados: JSON.stringify(treinamentos), total_registros: treinamentos.length, atualizado_em: now });
        }
        if (toUpdate.includes('embarques')) {
            entries.push({ tipo: 'embarques', dados: JSON.stringify(embarques), total_registros: embarques.length, atualizado_em: now });
        }
        if (toUpdate.includes('lgp_reports')) {
            entries.push({ tipo: 'lgp_reports', dados: JSON.stringify(lgpReports), total_registros: lgpReports.length, atualizado_em: now });
        }

        for (const entry of entries) {
            const { error } = await supabaseAdmin
                .from('mio_cache')
                .upsert(entry, { onConflict: 'tipo' });
            if (error) console.error(`[MIO Cache] Erro upsert ${entry.tipo}:`, error.message);
        }

        // Salva timestamp global
        await supabaseAdmin
            .from('mio_cache')
            .upsert({ tipo: '__meta__', dados: JSON.stringify({ ultima_execucao: now }), total_registros: 0, atualizado_em: now }, { onConflict: 'tipo' });

        console.log('[MIO Cache] Coleta concluída.', {
            integrantes: toUpdate.includes('integrantes') ? integrantes.length : undefined,
            treinamentos: toUpdate.includes('treinamentos') ? treinamentos.length : undefined,
            embarques: toUpdate.includes('embarques') ? embarques.length : undefined,
            lgp_reports: toUpdate.includes('lgp_reports') ? lgpReports.length : undefined,
        });

        return NextResponse.json({
            success: true,
            cached: false,
            updated: toUpdate,
            skipped: recentTipos,
            data: {
                integrantes: toUpdate.includes('integrantes') ? integrantes.length : undefined,
                treinamentos: toUpdate.includes('treinamentos') ? treinamentos.length : undefined,
                embarques: toUpdate.includes('embarques') ? embarques.length : undefined,
                lgp_reports: toUpdate.includes('lgp_reports') ? lgpReports.length : undefined,
                atualizado_em: now,
            },
        });
    } catch (error: any) {
        console.error('[MIO Cache] Erro fatal:', error);
        return NextResponse.json({ success: false, error: error.message || 'Erro interno' }, { status: 500 });
    }
}
