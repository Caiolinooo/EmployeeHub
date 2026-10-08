import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { buscarASOsPendentes } from '@/lib/gestao-tripulantes/poliweb-scraper';
import { importarEProcessarASOs, listarASOsPendentesRevisao } from '@/lib/gestao-tripulantes/poliweb-service';
import { filtrarPorColaboradorPermitido } from '@/lib/gestao-tripulantes/empresa-acesso';
import { canWithGrant } from '@/lib/permission-gate';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SYNC_GRANTS = ['gestao-tripulantes.poliweb.scrape', 'gestao-tripulantes.admin'] as const;

function asosPayload(
  data: unknown[],
  options: {
    ok: boolean;
    warning?: string;
    message?: string;
    extra?: Record<string, unknown>;
  }
) {
  return NextResponse.json({
    ok: options.ok,
    success: options.ok,
    data,
    warning: options.warning,
    error: options.ok ? undefined : options.warning,
    message: options.message,
    ...options.extra,
  });
}

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

    const user = { id: payload.userId, role: payload.role };
    const pendentesVisiveis = async () =>
      filtrarPorColaboradorPermitido(user, await listarASOsPendentesRevisao(), (aso) => aso.colaborador_id);
    const cronSecret = process.env.CRON_SECRET;
    const syncPedido = request.nextUrl.searchParams.get('sync') === '1';
    const sync =
      syncPedido &&
      ((!!cronSecret && request.headers.get('x-vercel-cron-secret') === cronSecret) ||
        (await canWithGrant(user.id, user.role, SYNC_GRANTS)));
    let warning: string | undefined =
      syncPedido && !sync ? 'Sem permissão para sincronizar o PoliWeb; exibindo os ASOs já importados.' : undefined;

    if (sync) {
      const result = await buscarASOsPendentes();
      if (!result.success) {
        const isConfigError =
          result.error?.includes('configurado') ||
          result.error?.includes('habilitado') ||
          result.error?.includes('Credenciais');
        warning = result.error || 'Erro ao buscar ASOs pendentes';
        const pending = await pendentesVisiveis();
        return asosPayload(pending, {
          ok: false,
          warning,
          extra: {
            configured: !isConfigError,
            hint: isConfigError
              ? 'Configure o PoliWeb no painel admin > Gestão de Tripulantes > Configurações > Aba PoliWeb'
              : undefined,
          },
        });
      }

      if (result.data && result.data.length > 0) {
        await importarEProcessarASOs(result.data);
      }
    }

    const pending = await pendentesVisiveis();
    return asosPayload(pending, {
      ok: true,
      warning,
      message: pending.length === 0 ? 'Nenhum ASO pendente encontrado' : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno do servidor';
    if (!msg.includes('Timeout')) {
      console.error('Erro na API PoliWeb ASOs pendentes:', error);
    }
    return asosPayload([], { ok: false, warning: msg });
  }
}
