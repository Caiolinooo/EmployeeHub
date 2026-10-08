/**
 * API: /api/ia/feature-toggles
 * Gerenciamento de toggles de funcionalidades da IA
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';
import { getAllFeatureToggles, updateFeatureToggle } from '@/lib/ia/agent-service';

export const dynamic = 'force-dynamic';

/**
 * GET — Listar todos os toggles
 */
export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;
    const { data: profile } = await supabaseAdmin.from('users_unified').select('role').eq('id', userId).single();

    if (!profile || !(await canWithGrant(userId, profile.role, ['ia-assistant.feature_toggles.manage'], 'admin'))) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const toggles = await getAllFeatureToggles();
    return NextResponse.json({ toggles });
  } catch (err) {
    console.error('[Feature Toggles API] GET Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * PUT — Atualizar toggle
 */
export async function PUT(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;
    const { data: profile } = await supabaseAdmin.from('users_unified').select('role').eq('id', userId).single();

    if (!profile || !(await canWithGrant(userId, profile.role, ['ia-assistant.feature_toggles.manage'], 'admin'))) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const { feature_key, ...updates } = await request.json();

    if (!feature_key) {
      return NextResponse.json({ error: 'feature_key obrigatório' }, { status: 400 });
    }

    const success = await updateFeatureToggle(feature_key, updates);
    return NextResponse.json({ success });
  } catch (err) {
    console.error('[Feature Toggles API] PUT Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
