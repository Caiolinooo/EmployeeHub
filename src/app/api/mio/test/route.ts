import { NextResponse } from 'next/server';
import { mioClient } from '@/lib/mio/client';
import { runMioPull } from '@/lib/mio/pull-context';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization') || undefined;
        const token = extractTokenFromHeader(authHeader);
        const decoded = token ? verifyToken(token) : null;
        const isAdmin = decoded && (decoded.role === 'ADMIN' || decoded.role === 'MANAGER');
        const isDev = process.env.NODE_ENV === 'development';
        if (!isAdmin && !isDev) {
            return NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 });
        }

        const result = await runMioPull(() => mioClient.testConnection());
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
