import { NextRequest, NextResponse } from 'next/server';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import {
  WK_TOKEN_CREDENTIAL_KEY,
  WK_URL_CREDENTIAL_KEY,
} from '@/lib/wkradar/api-client';
import { getCredential, setCredential } from '@/lib/secure-credentials';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/dp/wk/credentials — estado das credenciais da Radar.API (token
 * NUNCA volta cru, só máscara). Gate 'view'.
 * PUT  /api/dp/wk/credentials — grava via setCredential (app_secrets, mesma
 * via que getCredential consome; token com encrypt:true). Gate 'view' +
 * user.role === 'ADMIN'.
 * Corpo PUT: { url?: string, token?: string } — pelo menos um campo.
 */

export async function GET(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'view');
  if (!gate.ok) return gate.error;

  try {
    const [url, token] = await Promise.all([
      getCredential(WK_URL_CREDENTIAL_KEY),
      getCredential(WK_TOKEN_CREDENTIAL_KEY),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        configurado: Boolean(url && token),
        url: url || null,
        tokenMascarado: token ? `••••${token.slice(-4)}` : null,
      },
    });
  } catch (erro) {
    console.error('[dp/wk/credentials] erro na leitura:', erro);
    return NextResponse.json(
      { success: false, error: erro instanceof Error ? erro.message : 'Erro ao ler credenciais WK' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const gate = await garantirNivelPayroll(request, 'view');
  if (!gate.ok) return gate.error;
  if ((gate.user.role || '').toUpperCase() !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Somente ADMIN pode alterar as credenciais da Radar.API' },
      { status: 403 },
    );
  }

  try {
    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!corpo) {
      return NextResponse.json({ success: false, error: 'Corpo JSON inválido' }, { status: 400 });
    }

    const url = typeof corpo.url === 'string' ? corpo.url.trim().replace(/\/+$/, '') : '';
    const token = typeof corpo.token === 'string' ? corpo.token.trim() : '';
    if (!url && !token) {
      return NextResponse.json(
        { success: false, error: 'Envie url e/ou token da Radar.API (WK Radar)' },
        { status: 400 },
      );
    }

    if (url) {
      await setCredential(WK_URL_CREDENTIAL_KEY, url, 'Radar.API (WK Radar) — URL base da API REST');
    }
    if (token) {
      await setCredential(WK_TOKEN_CREDENTIAL_KEY, token, 'Radar.API (WK Radar) — token Bearer', {
        encrypt: true,
      });
    }

    return NextResponse.json({ success: true, data: { configurado: true } });
  } catch (erro) {
    console.error('[dp/wk/credentials] erro na gravação:', erro);
    return NextResponse.json(
      { success: false, error: erro instanceof Error ? erro.message : 'Erro ao gravar credenciais WK' },
      { status: 500 },
    );
  }
}
