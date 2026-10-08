import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
import {
  EvaluationSettingsService,
  type EvaluationSettings,
  type GerenteGeralAuditAssignment
} from '@/lib/services/evaluation-settings';
import { verifyToken, verifyTokenFromRequest } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';

function buildSettingRecord(params: {
  id?: string;
  scope: 'global' | 'periodo';
  periodoId?: string | null;
  method?: EvaluationSettings['calculo']['method'];
  obrigatoriedade?: EvaluationSettings['obrigatoriedade'];
  ativo?: boolean;
  createdAt?: string;
}): EvaluationSettings {
  const now = new Date().toISOString();

  return {
    id: params.id || (params.scope === 'global' ? 'legacy-evaluation-settings-global' : `legacy-evaluation-settings-${params.periodoId || 'periodo'}`),
    scope: params.scope,
    periodo_id: params.periodoId || null,
    calculo: {
      method: params.method || 'simple_average'
    },
    obrigatoriedade: params.obrigatoriedade || {},
    ativo: params.ativo !== false,
    created_at: params.createdAt || now,
    updated_at: now
  };
}

async function resolveAdminUserId(request: NextRequest): Promise<string | null> {
  const requestAuth = await verifyTokenFromRequest(request);
  let userId = requestAuth.valid ? requestAuth.userId : null;

  if (!userId) {
    const cookieStore = await cookies();
    const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;
    const decoded = token ? verifyToken(token) : null;
    userId = decoded?.userId || null;
  }

  if (!userId) return null;

  const { data: user, error } = await supabaseAdmin
    .from('users_unified')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error || !user || !(await canWithGrant(user.id, user.role, ['avaliacao.settings.manage'], 'admin'))) {
    return null;
  }

  return user.id;
}

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
export async function PATCH(request: NextRequest) {
  try {
    const adminUserId = await resolveAdminUserId(request);

    if (!adminUserId) {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem alterar as configurações', timestamp: new Date().toISOString() },
        { status: 403 }
      );
    }

    const body = await request.json();
    const method = body.method as EvaluationSettings['calculo']['method'] | undefined;
    const periodoId = body.periodoId || null;
    const gerentesGerais = body.gerentesGerais as GerenteGeralAuditAssignment[] | undefined;

    if (method !== undefined && !['simple_average', 'weighted'].includes(method)) {
      return NextResponse.json({ success: false, error: 'Método inválido', timestamp: new Date().toISOString() }, { status: 400 });
    }

    if (gerentesGerais !== undefined && !Array.isArray(gerentesGerais)) {
      return NextResponse.json({ success: false, error: 'Configuração de auditoria inválida', timestamp: new Date().toISOString() }, { status: 400 });
    }

    if (method === undefined && gerentesGerais === undefined) {
      return NextResponse.json({ success: false, error: 'Nenhuma alteração recebida', timestamp: new Date().toISOString() }, { status: 400 });
    }

    const normalizedAssignments = gerentesGerais !== undefined
      ? EvaluationSettingsService.normalizeAuditAssignments(gerentesGerais)
      : undefined;

    const applyChangesToSetting = (sourceSetting?: EvaluationSettings | null): EvaluationSettings => {
      const currentSettings = EvaluationSettingsService.normalizeSettings(sourceSetting || buildSettingRecord({
        scope: periodoId ? 'periodo' : 'global',
        periodoId
      })) as EvaluationSettings;

      const nextCalculo = {
        ...(currentSettings.calculo || { method: 'simple_average' }),
        ...(method ? { method } : {})
      };

      const nextObrigatoriedade = {
        ...(currentSettings.obrigatoriedade || {}),
        ...(normalizedAssignments !== undefined
          ? {
              auditoria: {
                ...(currentSettings.obrigatoriedade?.auditoria || {}),
                gerentesGerais: normalizedAssignments
              }
            }
          : {})
      };

      return buildSettingRecord({
        id: currentSettings.id,
        scope: currentSettings.scope,
        periodoId: currentSettings.periodo_id,
        method: nextCalculo.method,
        obrigatoriedade: nextObrigatoriedade,
        ativo: currentSettings.ativo,
        createdAt: currentSettings.created_at
      });
    };

    // Buscar global ou período na tabela dedicada primeiro
    let query = supabaseAdmin.from('avaliacao_settings').select('*');
    if (periodoId) {
      query = query.eq('scope', 'periodo').eq('periodo_id', periodoId);
    } else {
      query = query.eq('scope', 'global');
    }

    const { data: existing, error: existingErr } = await query.limit(1).maybeSingle();

    if (existingErr && !EvaluationSettingsService.isMissingRelationError(existingErr, 'avaliacao_settings')) {
      throw existingErr;
    }

    if (!existingErr) {
      const updated = applyChangesToSetting(existing as EvaluationSettings | null);

      if (existing) {
        const { data: upd, error: updErr } = await supabaseAdmin
          .from('avaliacao_settings')
          .update({
            calculo: updated.calculo,
            obrigatoriedade: updated.obrigatoriedade,
            ativo: updated.ativo,
            updated_at: updated.updated_at
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updErr) throw updErr;

        return NextResponse.json({ success: true, data: EvaluationSettingsService.normalizeSettings(upd as EvaluationSettings), timestamp: new Date().toISOString() });
      }

      const { data: ins, error: insErr } = await supabaseAdmin
        .from('avaliacao_settings')
        .insert({
          scope: updated.scope,
          periodo_id: updated.periodo_id,
          calculo: updated.calculo,
          obrigatoriedade: updated.obrigatoriedade,
          ativo: updated.ativo
        })
        .select()
        .single();

      if (insErr) throw insErr;

      return NextResponse.json({ success: true, data: EvaluationSettingsService.normalizeSettings(ins as EvaluationSettings), timestamp: new Date().toISOString() });
    }

    const { data: fallbackRow, error: fallbackErr } = await supabaseAdmin
      .from('settings')
      .select('id, key, value, description, created_at, updated_at')
      .eq('key', EvaluationSettingsService.fallbackStorageKey)
      .maybeSingle();

    if (fallbackErr) {
      throw fallbackErr;
    }

    const fallbackSettings = EvaluationSettingsService.parseStoredSettingsValue(fallbackRow?.value, {
      created_at: fallbackRow?.created_at,
      updated_at: fallbackRow?.updated_at
    });

    const targetScope = periodoId ? 'periodo' : 'global';
    const existingFallback = fallbackSettings.find((setting) => (
      setting.scope === targetScope && (targetScope === 'global' ? true : setting.periodo_id === periodoId)
    )) || null;

    const updatedFallbackSetting = applyChangesToSetting(existingFallback);

    const nextSettings = existingFallback
      ? fallbackSettings.map((setting) => (
          setting.id === existingFallback.id ? updatedFallbackSetting : setting
        ))
      : [...fallbackSettings, updatedFallbackSetting];

    const serializedSettings = EvaluationSettingsService.serializeSettings(nextSettings);

    if (fallbackRow) {
      const { error: updateFallbackError } = await supabaseAdmin
        .from('settings')
        .update({
          value: serializedSettings,
          description: fallbackRow.description || 'Configurações do módulo de avaliação'
        })
        .eq('key', EvaluationSettingsService.fallbackStorageKey);

      if (updateFallbackError) {
        throw updateFallbackError;
      }
    } else {
      const { error: insertFallbackError } = await supabaseAdmin
        .from('settings')
        .insert({
          key: EvaluationSettingsService.fallbackStorageKey,
          value: serializedSettings,
          description: 'Configurações do módulo de avaliação'
        });

      if (insertFallbackError) {
        throw insertFallbackError;
      }
    }

    return NextResponse.json({ success: true, data: updatedFallbackSetting, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('PATCH /api/avaliacao/settings error', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro ao atualizar configurações', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
