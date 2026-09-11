import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ativo = searchParams.get('ativo');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('gt_empresas')
      .select('*');

    if (ativo === 'true') query = query.eq('ativo', true);
    if (ativo === 'false') query = query.eq('ativo', false);
    if (search) query = query.or(`nome.ilike.%${search}%,cnpj.ilike.%${search}%`);

    const { data, error } = await query
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao listar empresas:', error);
      return NextResponse.json({ error: 'Erro ao listar empresas' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erro na API empresas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const role = String(payload.role || '').toUpperCase();
    if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ADMINISTRADOR' && role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Acesso negado. Apenas ADMIN/MANAGER.' }, { status: 403 });
    }

    const body = await request.json();
    const { nome, cnpj, centro_custo_id } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_empresas')
      .insert({
        nome,
        cnpj: cnpj || null,
        centro_custo_id: centro_custo_id || null,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar empresa:', error);
      return NextResponse.json({ error: 'Erro ao criar empresa' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
