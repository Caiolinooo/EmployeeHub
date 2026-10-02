import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeNivelRecrutamento } from '@/lib/recrutamento/recrutamento-auth';
import {
  carregarCredenciaisInhire,
  limparSessaoInhire,
  loginInhire,
  inhireFetch,
} from '@/lib/recrutamento/inhire-client';

export const dynamic = 'force-dynamic';

function mascarar(v: string | null): string | null {
  if (!v) return null;
  if (v.length <= 4) return '****';
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

/**
 * Diagnóstico do auth InHire (manual: https://docs.inhire.com.br/guides/auth).
 * Executa login (/login), refresh (/refresh) e 1 chamada autenticada (POST /jobs/paginated/lean).
 * Nunca devolve tokens nem senha; apenas status booleano e detalhes de erro.
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const pode = await podeNivelRecrutamento(payload.userId, payload.role, 'manage');
    if (!pode) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const cred = await carregarCredenciaisInhire();
    if (!cred) {
      return NextResponse.json({
        success: false,
        etapa: 'config',
        error: 'Credenciais não configuradas. Salve inhire_email, inhire_password, inhire_tenant em app_secrets.',
      });
    }

    limparSessaoInhire(); // teste sempre parte do zero: login real

    const resultado: Record<string, unknown> = {
      tenant: cred.tenant,
      email: mascarar(cred.email),
      authBase: cred.authBase,
      apiBase: cred.apiBase,
    };

    try {
      await loginInhire();
      resultado.login = 'ok';
    } catch (err) {
      return NextResponse.json({
        success: false,
        etapa: 'login',
        ...resultado,
        error: err instanceof Error ? err.message : 'Falha no login InHire',
      });
    }

    try {
      await loginInhire(); // segunda chamada: usa cache ou refresh
      resultado.refresh_ou_cache = 'ok';
    } catch (err) {
      return NextResponse.json({
        success: false,
        etapa: 'refresh',
        ...resultado,
        error: err instanceof Error ? err.message : 'Falha no refresh InHire',
      });
    }

    try {
      const vagas = await inhireFetch('/jobs/paginated/lean', {
        method: 'POST',
        body: JSON.stringify({ limit: 1 }),
      });
      const total = Array.isArray(vagas)
        ? vagas.length
        : (((vagas as { results?: unknown[]; data?: unknown[]; items?: unknown[] })?.results
          || (vagas as { data?: unknown[] })?.data
          || (vagas as { items?: unknown[] })?.items)?.length ?? null);
      resultado.chamada_autenticada = 'ok';
      resultado.vagas_retornadas = total;
      return NextResponse.json({ success: true, ...resultado });
    } catch (err) {
      return NextResponse.json({
        success: false,
        etapa: 'api',
        ...resultado,
        error: err instanceof Error ? err.message : 'Falha na chamada autenticada',
      });
    }
  } catch (error) {
    console.error('Erro no test-auth InHire:', error);
    return NextResponse.json({
      success: false,
      etapa: 'interno',
      error: error instanceof Error ? error.message : 'Erro interno',
    });
  }
}
