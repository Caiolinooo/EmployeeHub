import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { saveAsoAgendamentoConfig } from '@/lib/gestao-tripulantes/aso-agendamento-config';

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

    const { data, error } = await supabaseAdmin
      .from('gt_configuracoes')
      .select('*');

    if (error) {
      console.error('Erro ao buscar configurações:', error);
      return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 });
    }

    const configMap: Record<string, any> = {};
    if (data) {
      for (const row of data) {
        configMap[row.chave] = row.valor;
      }
    }

    const asoCfg = configMap.gt_aso_agendamento_config;
    if (asoCfg && typeof asoCfg === 'object' && asoCfg.antecedencia_dias != null) {
      configMap.notif_aso_dias_aviso = asoCfg.antecedencia_dias;
    }

    return NextResponse.json({
      success: true,
      data: configMap
    });
  } catch (error) {
    console.error('Erro na API configurações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const GERAL_KEYS = new Set([
      'modulo_ativo', 'nome_personalizado', 'mio_habilitado', 'mio_escrita_habilitada',
      'mio_auto_sync', 'mio_intervalo_minutos', 'poliweb_username', 'poliweb_password',
      'poliweb_habilitado', 'notif_aso_dias_aviso', 'notif_treinamento_dias_aviso',
      'notif_canal_inapp', 'notif_canal_email', 'notif_canal_push', 'ocr_qualidade',
      'ocr_auto_upload', 'ocr_fallback_api_url', 'ocr_fallback_api_key',
      'algoritmo_peso_centro_custo', 'algoritmo_peso_empresa', 'algoritmo_peso_embarcacao',
      'algoritmo_peso_cargo', 'algoritmo_peso_standby', 'algoritmo_peso_substituiu_antes',
      'algoritmo_peso_docs_validos', 'algoritmo_peso_senioridade', 'algoritmo_limite_resultados',
      'auto_notificar_vencimentos', 'auto_sugerir_back', 'auto_poliweb_scrape', 'auto_ocr',
      'dashboard_colunas_visiveis', 'dashboard_intervalo_refresh',
    ]);

    for (const [chave, valor] of Object.entries(body)) {
      if (!GERAL_KEYS.has(chave)) continue;
      const { error: upsertError } = await supabaseAdmin
        .from('gt_configuracoes')
        .upsert(
          { chave, valor, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        );

      if (upsertError) {
        console.error(`Erro ao salvar configuração ${chave}:`, upsertError);
        return NextResponse.json({ error: `Erro ao salvar configuração ${chave}` }, { status: 500 });
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'notif_aso_dias_aviso')) {
      await saveAsoAgendamentoConfig({
        antecedencia_dias: Number((body as Record<string, unknown>).notif_aso_dias_aviso),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações salvas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
