import { NextResponse } from 'next/server';
import { EvaluationSettingsService } from '@/lib/services/evaluation-settings';
import { supabase } from '@/lib/supabase';

// GET /api/avaliacao/settings?periodoId=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodoId');
    const settings = await EvaluationSettingsService.getEffectiveSettings(periodoId);

    return NextResponse.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Erro ao obter configurações',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// PATCH /api/avaliacao/settings  { method: 'simple_average' | 'weighted', periodoId? }
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const method = body.method;
    const periodoId = body.periodoId || null;

    if (!['simple_average', 'weighted'].includes(method)) {
      return NextResponse.json({ success: false, error: 'Método inválido', timestamp: new Date().toISOString() }, { status: 400 });
    }

    // Buscar global ou período
    let query = supabase.from('avaliacao_settings').select('*');
    if (periodoId) {
      query = query.eq('scope','periodo').eq('periodo_id', periodoId);
    } else {
      query = query.eq('scope','global');
    }
    const { data: existing, error: existingErr } = await query.limit(1).maybeSingle();
    if (existingErr) throw existingErr;

    let updated;
    if (existing) {
      const { data: upd, error: updErr } = await supabase
        .from('avaliacao_settings')
        .update({ calculo: { ...(existing.calculo||{}), method } })
        .eq('id', existing.id)
        .select()
        .single();
      if (updErr) throw updErr;
      updated = upd;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from('avaliacao_settings')
        .insert({ scope: periodoId ? 'periodo' : 'global', periodo_id: periodoId, calculo: { method }, obrigatoriedade: {}, ativo: true })
        .select()
        .single();
      if (insErr) throw insErr;
      updated = ins;
    }

    return NextResponse.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('PATCH /api/avaliacao/settings error', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro ao atualizar configurações', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
