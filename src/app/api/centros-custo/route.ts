import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader) || request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_centros_custo')
      .select('*')
      .order('codigo', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, centros_custo: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao listar centros de custo' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader) || request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const role = (payload.role || '').toUpperCase();
    if (role !== 'ADMIN' && role !== 'ADMINISTRADOR' && role !== 'SUPERADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Permissão negada. Apenas gestores e administradores podem cadastrar centros de custo.' }, { status: 403 });
    }

    const body = await request.json();
    const { codigo, nome, ativo = true } = body;

    if (!codigo || !nome) {
      return NextResponse.json({ error: 'Código e nome do centro de custo são obrigatórios.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_centros_custo')
      .insert({
        codigo: codigo.trim().toUpperCase(),
        nome: nome.trim(),
        ativo: Boolean(ativo),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, centro_custo: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao cadastrar centro de custo' }, { status: 500 });
  }
}
