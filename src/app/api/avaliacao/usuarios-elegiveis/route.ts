/**
 * API Route: Eligible Users for Evaluations
 *
 * GET  /api/avaliacao/usuarios-elegiveis - List eligible users with filters
 * POST /api/avaliacao/usuarios-elegiveis - Create or batch update eligible users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * GET - List eligible users with filters
 * Query params:
 *   - periodo_id: Filter by period (optional)
 *   - ativo: Filter by active status (optional, default: true)
 *   - tipo: 'global' or 'especifico' (optional)
 *   - include_details: Include user details (optional, default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const periodoId = searchParams.get('periodo_id');
    const ativo = searchParams.get('ativo') || 'true';
    const tipo = searchParams.get('tipo');
    const includeDetails = searchParams.get('include_details') !== 'false';

    const tableName = includeDetails ? 'vw_usuarios_elegiveis_completo' : 'avaliacao_usuarios_elegiveis';

    let query = supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (periodoId) query = query.eq('periodo_id', periodoId);
    if (ativo !== 'all') query = query.eq('ativo', ativo === 'true');
    if (tipo === 'global') query = query.is('periodo_id', null);
    else if (tipo === 'especifico') query = query.not('periodo_id', 'is', null);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [], total: data?.length || 0 });
  } catch (error: any) {
    console.error('Error fetching eligible users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST - Create or batch update eligible users
 * Body (single): { usuario_id, periodo_id?, incluido_por?, observacoes? }
 * Body (batch): { usuarios_ids: UUID[], periodo_id?, mode?: 'replace'|'add' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarios_ids, usuario_id, periodo_id = null, mode = 'add', incluido_por = null } = body;

    // Batch operation
    if (usuarios_ids && Array.isArray(usuarios_ids)) {
      if (mode === 'replace') {
        // Delete existing and insert new
        const deleteQuery = supabase.from('avaliacao_usuarios_elegiveis').delete();
        if (periodo_id) deleteQuery.eq('periodo_id', periodo_id);
        else deleteQuery.is('periodo_id', null);
        await deleteQuery;
      }

      if (usuarios_ids.length > 0) {
        const registros = usuarios_ids.map(uid => ({
          usuario_id: uid,
          periodo_id,
          ativo: true,
          incluido_por,
          data_inclusao: new Date().toISOString()
        }));

        const { error } = await supabase.from('avaliacao_usuarios_elegiveis').insert(registros);
        if (error) throw error;
      }

      return NextResponse.json({
        success: true,
        message: `${usuarios_ids.length} eligible users saved successfully`,
        total: usuarios_ids.length
      });
    }

    // Single operation
    if (!usuario_id) {
      return NextResponse.json(
        { success: false, error: 'usuario_id or usuarios_ids required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('avaliacao_usuarios_elegiveis')
      .insert({ usuario_id, periodo_id, ativo: true, incluido_por, data_inclusao: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving eligible users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
