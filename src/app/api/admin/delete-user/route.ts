import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Secure this endpoint with a static admin token in env
// Set ADMIN_API_TOKEN in your environment and send it via Authorization: Bearer <token>
function requireAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring('Bearer '.length)
    : '';
  const expected = process.env.ADMIN_API_TOKEN || '';
  return expected && token && token === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!requireAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, userId } = await request.json();
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Informe email ou userId' },
        { status: 400 }
      );
    }

    // Resolve userId by email if needed
    let targetUserId = userId as string | undefined;
    if (!targetUserId && email) {
      const { data: authUser, error: findErr } = await (supabaseAdmin as any)
        .schema('auth')
        .from('users')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .single();
      if (findErr || !authUser) {
        return NextResponse.json(
          { error: 'Usuário não encontrado no Auth para o e-mail informado' },
          { status: 404 }
        );
      }
      targetUserId = authUser.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Não foi possível resolver o userId' },
        { status: 400 }
      );
    }

    // Delete from Supabase Auth (admin)
    const delAuthRes = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if ((delAuthRes as any)?.error) {
      console.error('Erro ao deletar no Auth:', (delAuthRes as any).error);
      // Continue to clean local even if Auth deletion failed (idempotent cleanup)
    }

    // Cleanup local tables referencing the user
    const deletions: Array<Promise<any>> = [];

    deletions.push(
      supabaseAdmin.from('user_permissions').delete().eq('user_id', targetUserId)
    );
    deletions.push(
      supabaseAdmin.from('access_history').delete().eq('user_id', targetUserId)
    );
    deletions.push(
      supabaseAdmin.from('users_unified').delete().eq('id', targetUserId)
    );

    const results = await Promise.all(deletions);
    for (const r of results) {
      if ((r as any)?.error) {
        console.error('Erro ao deletar registros locais:', (r as any).error);
      }
    }

    return NextResponse.json({ success: true, userId: targetUserId });
  } catch (err) {
    console.error('Erro no delete-user:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
