import { NextRequest, NextResponse } from 'next/server';
import { mioSyncService } from '@/lib/mio/sync';
import { runMioPull } from '@/lib/mio/pull-context';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
        const decoded = token ? verifyToken(token) : null;
        const isAdmin = decoded && (decoded.role === 'ADMIN' || decoded.role === 'MANAGER');
        const isDev = process.env.NODE_ENV === 'development';
        if (!isAdmin && !isDev) {
            return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
        }

        const result = await runMioPull(() => mioSyncService.syncCompleto());
        const col = result.data?.colaboradores;
        const tre = result.data?.treinamentos;
        const emb = result.data?.embarques;
        const processed =
          (col?.importados || 0) + (col?.atualizados || 0) +
          (tre?.importados || 0) + (tre?.atualizados || 0) +
          (emb?.importados || 0) + (emb?.atualizados || 0);
        const errors =
          (col?.erros?.length || 0) + (tre?.erros?.length || 0) + (emb?.erros?.length || 0);
        return NextResponse.json({
            success: result.success,
            message: result.success
              ? 'Pull MIO → banco local concluído (MIO não foi alterado).'
              : result.error,
            data: result.data,
            synced: processed,
            errors,
            total: processed,
            results: { processed, errors },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
