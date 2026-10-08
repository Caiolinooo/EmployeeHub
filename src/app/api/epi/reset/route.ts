import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { resetEPIModuleData } from '@/services/epiService';
import { canWithGrant } from '@/lib/permission-gate';

export const dynamic = 'force-dynamic';

// Only admins should be able to reset data
export async function POST(request: NextRequest) {
    try {
        // Authentication (same pattern as /api/epi)
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
            if (tokenCookie) {
                token = tokenCookie.value;
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!(await canWithGrant(payload.userId, payload.role, ['epi.reset'], 'admin'))) {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        await resetEPIModuleData();

        return NextResponse.json({ success: true, message: 'Dados do módulo EPI resetados com sucesso.' });
    } catch (error: any) {
        console.error('Error resetting EPI data:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
