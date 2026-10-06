/**
 * Configuração por empresa da integração Time-Sheet (PontoFlow).
 * 1 tenant TS por empresa (D10): metadados em `ts_empresa_config`,
 * credenciais em `app_secrets` como `timesheet.<empresa_id>.{base_url,api_key,webhook_secret}`
 * (api_key/webhook_secret criptografados via setCredential).
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  clearCredentialCache,
  getCredential,
  setCredential,
} from '@/lib/secure-credentials';

export interface TimesheetEmpresaConfig {
  empresaId: string;
  tenantSlug: string;
  enabled: boolean;
}

export interface TimesheetEmpresaCredentials {
  baseUrl: string | null;
  apiKey: string | null;
  webhookSecret: string | null;
}

/** Chaves de app_secrets da integração para uma empresa. */
export function empresaCredentialKeys(empresaId: string) {
  return {
    baseUrl: `timesheet.${empresaId}.base_url`,
    apiKey: `timesheet.${empresaId}.api_key`,
    webhookSecret: `timesheet.${empresaId}.webhook_secret`,
  } as const;
}

/** Config de tenant de uma empresa (null = empresa sem tenant configurado). */
export async function getEmpresaConfig(
  empresaId: string,
): Promise<TimesheetEmpresaConfig | null> {
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from('ts_empresa_config')
    .select('empresa_id, ts_tenant_slug, enabled')
    .eq('empresa_id', empresaId)
    .maybeSingle();
  if (error) throw new Error(`ts_empresa_config: ${error.message}`);
  if (!data) return null;
  return {
    empresaId: data.empresa_id as string,
    tenantSlug: data.ts_tenant_slug as string,
    enabled: data.enabled === true,
  };
}

export async function listEmpresaConfigs(): Promise<TimesheetEmpresaConfig[]> {
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from('ts_empresa_config')
    .select('empresa_id, ts_tenant_slug, enabled');
  if (error) throw new Error(`ts_empresa_config: ${error.message}`);
  return (data || []).map((row) => ({
    empresaId: row.empresa_id as string,
    tenantSlug: row.ts_tenant_slug as string,
    enabled: row.enabled === true,
  }));
}

export async function upsertEmpresaConfig(
  cfg: TimesheetEmpresaConfig,
): Promise<void> {
  const admin = await getSupabaseAdmin();
  const { error } = await admin.from('ts_empresa_config').upsert(
    {
      empresa_id: cfg.empresaId,
      ts_tenant_slug: cfg.tenantSlug,
      enabled: cfg.enabled,
    },
    { onConflict: 'empresa_id' },
  );
  if (error) throw new Error(`ts_empresa_config upsert: ${error.message}`);
}

/** Tenant da empresa existe e está habilitado? */
export async function isEmpresaTenantEnabled(empresaId: string): Promise<boolean> {
  const cfg = await getEmpresaConfig(empresaId);
  return cfg !== null && cfg.enabled;
}

export async function getEmpresaCredentials(
  empresaId: string,
): Promise<TimesheetEmpresaCredentials> {
  const keys = empresaCredentialKeys(empresaId);
  const [baseUrl, apiKey, webhookSecret] = await Promise.all([
    getCredential(keys.baseUrl),
    getCredential(keys.apiKey),
    getCredential(keys.webhookSecret),
  ]);
  return { baseUrl, apiKey, webhookSecret };
}

/**
 * Grava credenciais da empresa em app_secrets. Campos omitidos/vazios são
 * mantidos (padrão email-settings); api_key e webhook_secret com encrypt:true.
 */
export async function setEmpresaCredentials(
  empresaId: string,
  input: { baseUrl?: string; apiKey?: string; webhookSecret?: string },
): Promise<void> {
  const keys = empresaCredentialKeys(empresaId);
  const writes: Promise<void>[] = [];
  const baseUrl = input.baseUrl?.trim().replace(/\/+$/, '');
  const apiKey = input.apiKey?.trim();
  const webhookSecret = input.webhookSecret?.trim();

  if (baseUrl) {
    writes.push(
      setCredential(keys.baseUrl, baseUrl, `Time-Sheet (PontoFlow) — URL base da API v1 (empresa ${empresaId})`),
    );
  }
  if (apiKey) {
    writes.push(
      setCredential(keys.apiKey, apiKey, `Time-Sheet (PontoFlow) — API key de integração (empresa ${empresaId})`, {
        encrypt: true,
      }),
    );
  }
  if (webhookSecret) {
    writes.push(
      setCredential(
        keys.webhookSecret,
        webhookSecret,
        `Time-Sheet (PontoFlow) — segredo HMAC de webhooks (empresa ${empresaId})`,
        { encrypt: true },
      ),
    );
  }
  await Promise.all(writes);
  clearCredentialCache(keys.baseUrl);
  clearCredentialCache(keys.apiKey);
  clearCredentialCache(keys.webhookSecret);
}
