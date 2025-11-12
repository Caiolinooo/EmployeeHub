/**
 * API Route: Manager Mappings
 *
 * Manages employee-to-manager mappings for performance evaluations.
 * Supports global mappings (all periods) and period-specific mappings.
 *
 * GET  /api/avaliacao/mapeamento-gerentes - List all mappings with filters
 * POST /api/avaliacao/mapeamento-gerentes - Create new mapping or batch update
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * GET - List manager mappings with optional filters
 * Query params:
 *   - periodo_id: Filter by period (optional)
 *   - colaborador_id: Filter by employee (optional)
 *   - gerente_id: Filter by manager (optional)
 *   - ativo: Filter by active status (optional, default: true)
 *   - tipo: 'global' or 'especifico' (optional)
 *   - include_details: Include user details (optional, default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const periodoId = searchParams.get('periodo_id');
    const colaboradorId = searchParams.get('colaborador_id');
    const gerenteId = searchParams.get('gerente_id');
    const ativo = searchParams.get('ativo') || 'true';
    const tipo = searchParams.get('tipo');
    const includeDetails = searchParams.get('include_details') !== 'false';

    // Use the view for complete information if details are requested
    const tableName = includeDetails ? 'vw_mapeamento_gerentes_completo' : 'avaliacao_colaborador_gerente';

    let query = supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (periodoId) {
      query = query.eq('periodo_id', periodoId);
    }

    if (colaboradorId) {
      query = query.eq('colaborador_id', colaboradorId);
    }

    if (gerenteId) {
      query = query.eq('gerente_id', gerenteId);
    }

    if (ativo !== 'all') {
      query = query.eq('ativo', ativo === 'true');
    }

    if (tipo === 'global') {
      query = query.is('periodo_id', null);
    } else if (tipo === 'especifico') {
      query = query.not('periodo_id', 'is', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching manager mappings:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    });

  } catch (error: any) {
    console.error('Error in GET /api/avaliacao/mapeamento-gerentes:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new mapping or save mappings in batch
 * Body (single mapping):
 *   - colaborador_id: UUID (required)
 *   - gerente_id: UUID (required)
 *   - periodo_id: UUID or null for global (optional)
 *   - data_inicio: Date (optional, defaults to today)
 *   - data_fim: Date (optional)
 *   - observacoes: Text (optional)
 *   - configurado_por: UUID (optional)
 *
 * Body (batch):
 *   - mapeamentos: Array of mapping objects (required)
 *   - mode: 'create' | 'upsert' | 'replace' (optional, default: 'upsert')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if it's a batch operation
    if (body.mapeamentos && Array.isArray(body.mapeamentos)) {
      return handleBatchCreate(body);
    }

    // Single mapping creation
    const {
      colaborador_id,
      gerente_id,
      periodo_id = null,
      data_inicio = new Date().toISOString().split('T')[0],
      data_fim = null,
      observacoes = null,
      configurado_por = null
    } = body;

    // Validate required fields
    if (!colaborador_id || !gerente_id) {
      return NextResponse.json(
        { success: false, error: 'colaborador_id and gerente_id are required' },
        { status: 400 }
      );
    }

    // Validate that employee and manager are different
    if (colaborador_id === gerente_id) {
      return NextResponse.json(
        { success: false, error: 'Employee and manager cannot be the same person' },
        { status: 400 }
      );
    }

    // Check if users exist
    const { data: colaborador, error: colaboradorError } = await supabase
      .from('users_unified')
      .select('id, name')
      .eq('id', colaborador_id)
      .single();

    if (colaboradorError || !colaborador) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    const { data: gerente, error: gerenteError } = await supabase
      .from('users_unified')
      .select('id, name')
      .eq('id', gerente_id)
      .single();

    if (gerenteError || !gerente) {
      return NextResponse.json(
        { success: false, error: 'Manager not found' },
        { status: 404 }
      );
    }

    // Check if period exists (if specified)
    if (periodo_id) {
      const { data: periodo, error: periodoError } = await supabase
        .from('periodos_avaliacao')
        .select('id, nome')
        .eq('id', periodo_id)
        .single();

      if (periodoError || !periodo) {
        return NextResponse.json(
          { success: false, error: 'Period not found' },
          { status: 404 }
        );
      }
    }

    // Check for existing mapping (prevent duplicates)
    let query = supabase
      .from('avaliacao_colaborador_gerente')
      .select('id')
      .eq('colaborador_id', colaborador_id)
      .eq('ativo', true);

    if (periodo_id) {
      query = query.eq('periodo_id', periodo_id);
    } else {
      query = query.is('periodo_id', null);
    }

    const { data: existing, error: existingError } = await query;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'A mapping already exists for this employee and period. Please deactivate or delete the existing mapping first.'
        },
        { status: 409 }
      );
    }

    // Create the mapping
    const { data, error } = await supabase
      .from('avaliacao_colaborador_gerente')
      .insert({
        colaborador_id,
        gerente_id,
        periodo_id,
        data_inicio,
        data_fim,
        observacoes,
        configurado_por,
        ativo: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating manager mapping:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Manager mapping created: ${colaborador.name} → ${gerente.name}`
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/avaliacao/mapeamento-gerentes:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle batch mapping creation/update
 */
async function handleBatchCreate(body: any) {
  const { mapeamentos, mode = 'upsert' } = body;

  if (!Array.isArray(mapeamentos) || mapeamentos.length === 0) {
    return NextResponse.json(
      { success: false, error: 'mapeamentos must be a non-empty array' },
      { status: 400 }
    );
  }

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as any[]
  };

  for (const mapeamento of mapeamentos) {
    const { colaborador_id, gerente_id, periodo_id = null } = mapeamento;

    if (!colaborador_id || !gerente_id) {
      results.errors.push({
        colaborador_id,
        gerente_id,
        error: 'Missing required fields'
      });
      results.skipped++;
      continue;
    }

    if (colaborador_id === gerente_id) {
      results.errors.push({
        colaborador_id,
        gerente_id,
        error: 'Employee and manager cannot be the same'
      });
      results.skipped++;
      continue;
    }

    try {
      // Check if mapping exists
      let query = supabase
        .from('avaliacao_colaborador_gerente')
        .select('id')
        .eq('colaborador_id', colaborador_id);

      if (periodo_id) {
        query = query.eq('periodo_id', periodo_id);
      } else {
        query = query.is('periodo_id', null);
      }

      const { data: existing } = await query.single();

      if (existing) {
        if (mode === 'upsert' || mode === 'replace') {
          // Update existing mapping
          await supabase
            .from('avaliacao_colaborador_gerente')
            .update({
              gerente_id,
              data_inicio: mapeamento.data_inicio || new Date().toISOString().split('T')[0],
              data_fim: mapeamento.data_fim || null,
              observacoes: mapeamento.observacoes || null,
              ativo: true
            })
            .eq('id', existing.id);

          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        // Create new mapping
        await supabase
          .from('avaliacao_colaborador_gerente')
          .insert({
            colaborador_id,
            gerente_id,
            periodo_id,
            data_inicio: mapeamento.data_inicio || new Date().toISOString().split('T')[0],
            data_fim: mapeamento.data_fim || null,
            observacoes: mapeamento.observacoes || null,
            configurado_por: mapeamento.configurado_por || null,
            ativo: true
          });

        results.created++;
      }
    } catch (error: any) {
      results.errors.push({
        colaborador_id,
        gerente_id,
        error: error.message
      });
      results.skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Batch operation completed: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
    results
  });
}
