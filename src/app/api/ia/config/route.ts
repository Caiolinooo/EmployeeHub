/**
 * API: /api/ia/config
 * GET  — Retornar config ativa (sem api_key para não-admin)
 * PUT  — Atualizar config (somente ADMIN)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';
import { invalidateConfigCache } from '@/lib/ia/client';
import type { IAConfig, IAConfigPublic } from '@/types/ia';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('ia_config')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ config: null, message: 'IA não configurada' }, { status: 200 });
    }

    const isAdmin = tokenResult.payload.role === 'ADMIN';
    const config = data as IAConfig;

    if (isAdmin) {
      // Admin vê tudo, inclusive api_key
      return NextResponse.json({ config });
    }

    // Não-admin: esconder api_key de todos os provedores
    const safeProviderSettings: any = {};
    if (config.provider_settings && typeof config.provider_settings === 'object') {
      for (const [key, value] of Object.entries(config.provider_settings)) {
        if (value && typeof value === 'object') {
          const { api_key, ...rest } = value as any;
          safeProviderSettings[key] = rest;
        }
      }
    }

    const publicConfig: IAConfigPublic = {
      id: config.id,
      endpoint: config.endpoint,
      model_default: config.model_default,
      max_tokens: config.max_tokens,
      temperatura: config.temperatura,
      system_prompt: config.system_prompt,
      ativo: config.ativo,
      provider: config.provider,
      provider_settings: safeProviderSettings,
      created_at: config.created_at,
      updated_at: config.updated_at,
    };

    return NextResponse.json({ config: publicConfig });
  } catch (err) {
    console.error('[API IA Config GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!(await canWithGrant(tokenResult.payload.userId, tokenResult.payload.role, ['ia-assistant.config.manage'], 'admin'))) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ['endpoint', 'api_key', 'model_default', 'max_tokens', 'temperatura', 'system_prompt', 'ativo', 'provider', 'provider_settings'];
    const updateData: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    // Buscar config ativa
    const { data: existing } = await supabaseAdmin
      .from('ia_config')
      .select('id')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Atualizar existente
      const { data, error } = await supabaseAdmin
        .from('ia_config')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      invalidateConfigCache();
      return NextResponse.json({ config: data, message: 'Configuração atualizada' });
    } else {
      // Criar nova
      if (!updateData.endpoint || !updateData.api_key) {
        return NextResponse.json({ error: 'Endpoint e API Key são obrigatórios' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('ia_config')
        .insert({
          endpoint: updateData.endpoint,
          api_key: updateData.api_key,
          model_default: updateData.model_default || 'default',
          max_tokens: updateData.max_tokens || 8192,
          temperatura: updateData.temperatura || 0.7,
          system_prompt: updateData.system_prompt || '',
          provider: updateData.provider || 'lmstudio',
          provider_settings: updateData.provider_settings || {},
          ativo: true,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      invalidateConfigCache();
      return NextResponse.json({ config: data, message: 'Configuração criada' }, { status: 201 });
    }
  } catch (err) {
    console.error('[API IA Config PUT]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
