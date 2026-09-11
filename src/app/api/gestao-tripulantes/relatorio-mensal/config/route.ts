import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { isFechamentoRole, normalizeAprovadoresObrigatorios } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import { listarCandidatosAprovadores } from '@/lib/gestao-tripulantes/fechamento-gestores';
import { updateConfig } from '@/lib/gestao-tripulantes/config-service';

export const dynamic = 'force-dynamic';

const DEFAULT_CONFIG = {
  dia_fechamento_mes: 25,
  emails_destinatarios_dp: ['dp@groupabz.com'],
  emails_cc: [] as string[],
  aprovadores_obrigatorios: [] as ReturnType<typeof normalizeAprovadoresObrigatorios>,
  envio_automatico: false,
  assunto_email_template: 'Fechamento de Escala Gestão de Tripulantes - {Mes_Ano}',
  corpo_email_template: 'Prezados,\n\nSegue em anexo o relatório oficial consolidado de escalas da Gestão de Tripulantes para o período de {Mes_Ano}.\n\nO documento inclui o cômputo individual e total de dias/semanas para:\n- ON (A bordo)\n- DBA (Dobra)\n- FI (Folga Indenizada)\n- TRE (Treinamento Indenizado)\n\nRelatório aprovado digitalmente pelo responsável da operação.\n\nAtenciosamente,\nGestão de Tripulantes - ABZ Group',
};

function parseValor(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader) || request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_configuracoes')
      .select('*')
      .eq('chave', 'gt_fechamento_mensal_config')
      .maybeSingle();

    if (error) {
      console.error('[API Config GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stored = parseValor(data?.valor);
    const config = {
      ...DEFAULT_CONFIG,
      ...stored,
      aprovadores_obrigatorios: normalizeAprovadoresObrigatorios(stored.aprovadores_obrigatorios),
    };

    const availableUsers = await listarCandidatosAprovadores();

    return NextResponse.json({
      success: true,
      config,
      availableUsers,
      availableManagers: availableUsers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar configuração' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader) || request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    if (!isFechamentoRole(payload.role)) {
      return NextResponse.json({ error: 'Permissão negada. Apenas administradores e gestores podem alterar configurações de fechamento.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      dia_fechamento_mes,
      emails_destinatarios_dp,
      emails_cc,
      aprovadores_obrigatorios,
      envio_automatico,
      assunto_email_template,
      corpo_email_template,
    } = body;

    const valorConfig = {
      dia_fechamento_mes: Math.min(31, Math.max(1, parseInt(dia_fechamento_mes, 10) || 25)),
      emails_destinatarios_dp: Array.isArray(emails_destinatarios_dp) ? emails_destinatarios_dp : [emails_destinatarios_dp].filter(Boolean),
      emails_cc: Array.isArray(emails_cc) ? emails_cc : [],
      aprovadores_obrigatorios: normalizeAprovadoresObrigatorios(aprovadores_obrigatorios),
      envio_automatico: Boolean(envio_automatico),
      assunto_email_template: assunto_email_template || DEFAULT_CONFIG.assunto_email_template,
      corpo_email_template: corpo_email_template || DEFAULT_CONFIG.corpo_email_template,
    };

    const saved = await updateConfig('gt_fechamento_mensal_config', valorConfig);
    if (!saved.success) {
      return NextResponse.json(
        { error: saved.error || 'Não foi possível gravar as configurações de fechamento.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, config: valorConfig });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao salvar configuração' },
      { status: 500 },
    );
  }
}
