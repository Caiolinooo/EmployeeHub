import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  podeGerenciarMatrizesTreinamento,
  podeVisualizarMatrizesTreinamento,
  isMatrizGestorRole,
} from '@/lib/gestao-tripulantes/matriz-permissions';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token =
      extractTokenFromHeader(authHeader) ||
      request.cookies.get('abzToken')?.value ||
      request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId || payload.user_id || payload.id || '';
    const role = payload.role || '';

    const [canManage, canView] = await Promise.all([
      podeGerenciarMatrizesTreinamento(userId, role),
      podeVisualizarMatrizesTreinamento(userId, role),
    ]);

    // Busca nome do setor se houver
    let sectorName: string | null = null;
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from('users_unified')
        .select('sector:sectors(name)')
        .eq('id', userId)
        .maybeSingle();
      if (user?.sector) {
        sectorName = (user.sector as any).name || null;
      }
    }

    return NextResponse.json({
      success: true,
      canManage,
      canView,
      isGestor: isMatrizGestorRole(role),
      sectorName,
    });
  } catch (error) {
    console.error('Erro ao verificar permissões de matriz:', error);
    return NextResponse.json({ error: 'Erro interno ao verificar permissões' }, { status: 500 });
  }
}
