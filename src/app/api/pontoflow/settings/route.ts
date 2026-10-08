import { NextRequest, NextResponse } from 'next/server';
import { isAdminFromRequest } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSafeUrl } from '@/lib/security/safe-url';
import { resetTimesheetClientCache } from '@/lib/timesheet-integration/client';
import {
  empresaCredentialKeys,
  getEmpresaCredentials,
  listEmpresaConfigs,
  setEmpresaCredentials,
  upsertEmpresaConfig,
} from '@/lib/timesheet-integration/settings';
import { getQueueStatus } from '@/lib/timesheet-integration/worker';

export const dynamic = 'force-dynamic';

async function podeConfigurarPonto(request: NextRequest): Promise<boolean> {
  const admin = await isAdminFromRequest(request);
  if (admin.isAdmin) return true;
  return canWithGrant(admin.userId, null, ['ponto.settings.manage'], 'none');
}

/**
 * Settings da integração Time-Sheet por empresa (admin — D10: 1 tenant/empresa).
 * Mesmo padrão de /api/dp/wk/credentials: segredos NUNCA voltam crus (só
 * máscara); gravação via setCredential em app_secrets
 * (`timesheet.<empresa_id>.{base_url,api_key,webhook_secret}`).
 *
 * GET → empresas (gt_empresas) + config de tenant + credenciais mascaradas +
 *       status da fila (pendentes/aguardandoRetry/dead).
 * PUT { empresaId, tenantSlug?, enabled?, baseUrl?, apiKey?, webhookSecret? }
 *     → upsert ts_empresa_config + app_secrets (apiKey/webhookSecret criptografados;
 *       vazio mantém o valor atual). baseUrl validada por parseSafeUrl.
 */
export async function GET(request: NextRequest) {
  if (!(await podeConfigurarPonto(request))) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const supabase = await getSupabaseAdmin();
    const [{ data: empresas, error: empError }, configs, fila] = await Promise.all([
      supabase.from('gt_empresas').select('id, nome').order('nome'),
      listEmpresaConfigs(),
      getQueueStatus(),
    ]);
    if (empError) throw new Error(`gt_empresas: ${empError.message}`);

    const configByEmpresa: Record<string, { tenantSlug: string; enabled: boolean }> = {};
    for (const cfg of configs) {
      configByEmpresa[cfg.empresaId] = { tenantSlug: cfg.tenantSlug, enabled: cfg.enabled };
    }

    const itens = await Promise.all(
      (empresas || []).map(async (emp) => {
        const empresaId = String(emp.id);
        const creds = await getEmpresaCredentials(empresaId);
        const cfg = configByEmpresa[empresaId] || null;
        return {
          empresaId,
          empresaNome: typeof emp.nome === 'string' ? emp.nome : empresaId,
          tenantSlug: cfg?.tenantSlug || '',
          enabled: cfg?.enabled ?? false,
          configurado: cfg !== null,
          baseUrl: creds.baseUrl,
          apiKeyMascarada: creds.apiKey ? `••••${creds.apiKey.slice(-4)}` : null,
          webhookSecretMascarado: creds.webhookSecret
            ? `••••${creds.webhookSecret.slice(-4)}`
            : null,
        };
      }),
    );

    return NextResponse.json({ success: true, data: { empresas: itens, fila } });
  } catch (error) {
    console.error('[pontoflow/settings] GET erro:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!(await podeConfigurarPonto(request))) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  let body: {
    empresaId?: string;
    tenantSlug?: string;
    enabled?: boolean;
    baseUrl?: string;
    apiKey?: string;
    webhookSecret?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'Corpo JSON inválido' }, { status: 400 });
  }

  const empresaId = typeof body.empresaId === 'string' ? body.empresaId.trim() : '';
  if (!empresaId) {
    return NextResponse.json({ success: false, error: 'empresaId é obrigatório' }, { status: 400 });
  }

  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim().replace(/\/+$/, '') : '';
  if (baseUrl) {
    // SSRF guard: https, sem credenciais na URL, sem host privado/loopback.
    parseSafeUrl(baseUrl, { allowedHosts: [new URL(baseUrl).hostname] });
  }

  try {
    if (body.tenantSlug !== undefined || body.enabled !== undefined) {
      const configs = await listEmpresaConfigs();
      const atual = configs.find((c) => c.empresaId === empresaId) || null;
      const tenantSlug =
        typeof body.tenantSlug === 'string' && body.tenantSlug.trim()
          ? body.tenantSlug.trim()
          : atual?.tenantSlug || '';
      if (!tenantSlug) {
        return NextResponse.json(
          { success: false, error: 'tenantSlug é obrigatório ao configurar a empresa' },
          { status: 400 },
        );
      }
      await upsertEmpresaConfig({
        empresaId,
        tenantSlug,
        enabled: body.enabled === undefined ? atual?.enabled ?? true : body.enabled === true,
      });
    }

    await setEmpresaCredentials(empresaId, {
      ...(baseUrl ? { baseUrl } : {}),
      ...(body.apiKey !== undefined ? { apiKey: body.apiKey } : {}),
      ...(body.webhookSecret !== undefined ? { webhookSecret: body.webhookSecret } : {}),
    });
    resetTimesheetClientCache(empresaId);

    return NextResponse.json({ success: true, data: { empresaId, configurado: true } });
  } catch (error) {
    console.error('[pontoflow/settings] PUT erro:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
