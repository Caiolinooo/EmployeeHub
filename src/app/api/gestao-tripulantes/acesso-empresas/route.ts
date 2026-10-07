import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function isAdmin(user: { role?: string | null }): boolean {
  return (user.role || '').toUpperCase() === 'ADMIN';
}

/**
 * ACL por empresa (GT) — admin only.
 *
 * GET  → { empresas: [...], restricoes: [{ user_id, empresa_id }], usuarios: [...] }
 * PUT  → body { user_id, empresa_ids: string[] } — substitui as restrições do
 *        usuário; [] remove a restrição (volta a ver todas as empresas).
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    const [empresasRes, restricoesRes] = await Promise.all([
      supabaseAdmin.from('gt_empresas').select('id, nome, ativo').order('nome'),
      supabaseAdmin.from('gt_user_empresa_acesso').select('user_id, empresa_id'),
    ]);

    if (empresasRes.error) {
      return NextResponse.json({ error: empresasRes.error.message }, { status: 500 });
    }
    if (restricoesRes.error) {
      return NextResponse.json({ error: restricoesRes.error.message }, { status: 500 });
    }

    const restricoes = restricoesRes.data || [];
    const userIds = [...new Set(restricoes.map(r => r.user_id as string))];

    // Usuários com restrição + busca livre (para atribuir restrição a quem ainda não tem)
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    let usuarios: any[] = [];
    if (userIds.length > 0 || search) {
      let uq = supabaseAdmin
        .from('users_unified')
        .select('id, first_name, last_name, email, role')
        .order('first_name')
        .limit(50);
      if (search) {
        uq = uq.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      } else {
        uq = uq.in('id', userIds);
      }
      const { data: usersData } = await uq;
      usuarios = (usersData || []).map(u => ({
        id: u.id,
        nome: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        email: u.email,
        role: u.role,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        empresas: empresasRes.data || [],
        restricoes,
        usuarios,
      },
    });
  } catch (error) {
    console.error('Erro em GET acesso-empresas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    const body = await request.json();
    const userId = String(body?.user_id || '').trim();
    const empresaIds: string[] = Array.isArray(body?.empresa_ids)
      ? body.empresa_ids.map((e: any) => String(e)).filter(Boolean)
      : [];

    if (!userId) {
      return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 });
    }

    const { data: targetUser } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name, email')
      .eq('id', userId)
      .maybeSingle();
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Substituição transacional (delete + insert)
    const { error: delErr } = await supabaseAdmin
      .from('gt_user_empresa_acesso')
      .delete()
      .eq('user_id', userId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    if (empresaIds.length > 0) {
      const rows = empresaIds.map(empresa_id => ({ user_id: userId, empresa_id }));
      const { error: insErr } = await supabaseAdmin
        .from('gt_user_empresa_acesso')
        .insert(rows);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    console.log(
      `[acesso-empresas] ${user.email} definiu restrição de ${targetUser.email}: [${empresaIds.join(', ')}]`
    );

    return NextResponse.json({
      success: true,
      message: empresaIds.length === 0
        ? 'Restrição removida — usuário volta a ver todas as empresas'
        : `Usuário restrito a ${empresaIds.length} empresa(s)`,
    });
  } catch (error) {
    console.error('Erro em PUT acesso-empresas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
