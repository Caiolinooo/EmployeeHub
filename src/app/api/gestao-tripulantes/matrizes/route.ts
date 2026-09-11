import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import {
  podeGerenciarMatrizesTreinamento,
  podeVisualizarMatrizesTreinamento,
} from '@/lib/gestao-tripulantes/matriz-permissions';

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

    const canView = await podeVisualizarMatrizesTreinamento(userId, role);
    if (!canView) {
      return NextResponse.json(
        { error: 'Acesso negado. Usuário ou setor sem permissão para visualizar matrizes.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const ativo = searchParams.get('ativo');

    let query = supabaseAdmin
      .from('gt_matrizes_treinamento')
      .select('*, gt_matriz_treinamento_requisitos(id, cargo_nome, regime, treinamento_nome, obrigatorio)');

    if (ativo === 'true') query = query.eq('ativo', true);
    if (ativo === 'false') query = query.eq('ativo', false);
    if (search) {
      query = query.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%,cliente.ilike.%${search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar matrizes:', error);
      return NextResponse.json({ error: 'Erro ao listar matrizes de treinamento' }, { status: 500 });
    }

    // Process summary counts for each matrix
    const matricesWithStats = (data || []).map((m: any) => {
      const reqs = m.gt_matriz_treinamento_requisitos || [];
      const distinctCargos = new Set(reqs.map((r: any) => r.cargo_nome)).size;
      const distinctTreinamentos = new Set(reqs.map((r: any) => r.treinamento_nome)).size;

      return {
        ...m,
        total_requisitos: reqs.length,
        total_cargos: distinctCargos,
        total_treinamentos: distinctTreinamentos,
      };
    });

    return NextResponse.json({ success: true, data: matricesWithStats });
  } catch (error) {
    console.error('Erro na API matrizes:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const canManage = await podeGerenciarMatrizesTreinamento(userId, role);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Acesso negado. É necessário ter perfil gestor, permissão ACL ou pertencer a setor autorizado para gerenciar matrizes.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const nome = String(body.nome || '').trim();
    const codigo = String(body.codigo || nome).trim().toUpperCase();
    const descricao = body.descricao ? String(body.descricao).trim() : null;
    const centro_resultado = body.centro_resultado ? String(body.centro_resultado).trim() : null;
    const cliente = body.cliente ? String(body.cliente).trim() : null;
    const contrato = body.contrato ? String(body.contrato).trim() : null;
    const responsavel = body.responsavel ? String(body.responsavel).trim() : null;
    const requisitos = Array.isArray(body.requisitos) ? body.requisitos : [];

    if (!nome) {
      return NextResponse.json({ error: 'Nome da matriz é obrigatório' }, { status: 400 });
    }

    // Insert matrix
    const { data: matrix, error: insertError } = await supabaseAdmin
      .from('gt_matrizes_treinamento')
      .insert({
        codigo,
        nome,
        descricao,
        centro_resultado,
        cliente,
        contrato,
        responsavel,
        ativo: body.ativo !== false,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Erro ao criar matriz:', insertError);
      return NextResponse.json({ error: 'Erro ao criar matriz de treinamento: ' + insertError.message }, { status: 500 });
    }

    // Insert initial requirements if provided
    if (requisitos.length > 0) {
      const rowsToInsert = requisitos.map((r: any) => ({
        matriz_id: matrix.id,
        cargo_id: r.cargo_id || null,
        cargo_nome: String(r.cargo_nome || '').trim(),
        regime: String(r.regime || 'Geral').trim(),
        treinamento_nome: String(r.treinamento_nome || '').trim(),
        sigla: r.sigla ? String(r.sigla).trim() : null,
        obrigatorio: r.obrigatorio !== false,
        validade_meses: r.validade_meses ? Number(r.validade_meses) : null,
        especialidade: r.especialidade ? String(r.especialidade).trim() : 'ND',
      })).filter((r: any) => r.cargo_nome && r.treinamento_nome);

      if (rowsToInsert.length > 0) {
        const { error: reqErr } = await supabaseAdmin
          .from('gt_matriz_treinamento_requisitos')
          .insert(rowsToInsert);

        if (reqErr) {
          console.error('Erro ao inserir requisitos da matriz:', reqErr);
        }
      }
    }

    return NextResponse.json({ success: true, data: matrix }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar matriz:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
