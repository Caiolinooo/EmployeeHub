import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { canEditGtDocuments } from '@/lib/gestao-tripulantes/documento-permissions';
import { TIPOS_DOCUMENTO_VALIDOS } from '@/lib/gestao-tripulantes/documento-integrity';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gestao-tripulantes/documentos/titulos?tipo=contratual
 * Lista títulos pré-cadastrados ativos do tipo (ordenados por ordem, título).
 * Qualquer usuário autenticado pode listar (alimenta o select do upload).
 *
 * POST { tipo_documento, titulo, ordem? } — cria título (requer documents.edit).
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user) {
      return NextResponse.json({ error: 'Usuário não identificado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tipo = (searchParams.get('tipo') || '').trim().toLowerCase();
    const incluirInativos = searchParams.get('inativos') === 'true';

    let query = supabaseAdmin
      .from('gt_documento_titulos')
      .select('id, tipo_documento, titulo, ativo, ordem')
      .order('ordem', { ascending: true })
      .order('titulo', { ascending: true });

    if (tipo) query = query.eq('tipo_documento', tipo);
    if (!incluirInativos) query = query.eq('ativo', true);

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao listar títulos de documento:', error);
      return NextResponse.json({ error: 'Erro ao listar títulos' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erro em GET titulos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !(await canEditGtDocuments(user))) {
      return NextResponse.json({ error: 'Sem permissão para gerenciar títulos de documentos' }, { status: 403 });
    }

    const body = await request.json();
    const tipo_documento = String(body?.tipo_documento || '').trim().toLowerCase();
    const titulo = String(body?.titulo || '').trim();
    const ordem = Number(body?.ordem) || 0;

    if (!(TIPOS_DOCUMENTO_VALIDOS as readonly string[]).includes(tipo_documento)) {
      return NextResponse.json({
        error: `Tipo inválido: ${tipo_documento}`,
        tipos_aceitos: [...TIPOS_DOCUMENTO_VALIDOS],
      }, { status: 400 });
    }
    if (!titulo) {
      return NextResponse.json({ error: 'titulo é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_documento_titulos')
      .upsert(
        { tipo_documento, titulo, ordem, ativo: true },
        { onConflict: 'tipo_documento,titulo' }
      )
      .select('id, tipo_documento, titulo, ativo, ordem')
      .single();

    if (error) {
      console.error('Erro ao criar título:', error);
      return NextResponse.json({ error: 'Erro ao salvar título' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Erro em POST titulos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
