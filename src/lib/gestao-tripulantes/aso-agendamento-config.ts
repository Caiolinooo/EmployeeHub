import { getConfig, updateConfig } from '@/lib/gestao-tripulantes/config-service';
import {
  ASO_ANTECEDENCIA_DIAS_DEFAULT,
  ASO_MAX_SUGESTOES_DEFAULT,
  ASO_MIN_LEAD_DIAS_DEFAULT,
  DEFAULT_ASO_AGENDAMENTO_CONFIG,
  type AsoAgendamentoConfig,
} from '@/lib/gestao-tripulantes/aso-agendamento-status';

export type { AsoAgendamentoConfig };

export const GT_ASO_AGENDAMENTO_CONFIG_KEY = 'gt_aso_agendamento_config';
export const GT_ASO_NOTIF_DIAS_KEY = 'notif_aso_dias_aviso';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asEmailList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;\s]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function clampAntecedenciaDias(raw: unknown, fallback = ASO_ANTECEDENCIA_DIAS_DEFAULT): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(365, Math.max(1, Math.round(n)));
}

export function normalizeAsoAgendamentoConfig(raw: unknown): AsoAgendamentoConfig {
  const rec = asRecord(raw);
  return {
    antecedencia_dias: clampAntecedenciaDias(rec.antecedencia_dias, ASO_ANTECEDENCIA_DIAS_DEFAULT),
    min_lead_dias: Math.min(30, Math.max(0, Number.isFinite(Number(rec.min_lead_dias)) ? Math.round(Number(rec.min_lead_dias)) : ASO_MIN_LEAD_DIAS_DEFAULT)),
    max_sugestoes: Math.min(15, Math.max(1, clampAntecedenciaDias(rec.max_sugestoes, ASO_MAX_SUGESTOES_DEFAULT))),
    emails_logistica: asEmailList(rec.emails_logistica),
    emails_cc: asEmailList(rec.emails_cc),
    gerar_sugestoes_automatico: rec.gerar_sugestoes_automatico !== false,
  };
}

export async function getAsoAgendamentoConfig(): Promise<AsoAgendamentoConfig> {
  const dedicated = await getConfig(GT_ASO_AGENDAMENTO_CONFIG_KEY);
  const fallbackDias = await getConfig(GT_ASO_NOTIF_DIAS_KEY);
  const dedicatedRec = asRecord(dedicated.data);
  const merged: Record<string, unknown> = {
    ...DEFAULT_ASO_AGENDAMENTO_CONFIG,
    ...dedicatedRec,
  };
  if (Object.keys(dedicatedRec).length === 0 && fallbackDias.data != null) {
    merged.antecedencia_dias = fallbackDias.data;
  }
  return normalizeAsoAgendamentoConfig(merged);
}

export async function getAsoAntecedenciaDias(): Promise<number> {
  const cfg = await getAsoAgendamentoConfig();
  return cfg.antecedencia_dias;
}

export async function saveAsoAgendamentoConfig(
  patch: Partial<AsoAgendamentoConfig>,
): Promise<AsoAgendamentoConfig> {
  const current = await getAsoAgendamentoConfig();
  const next = normalizeAsoAgendamentoConfig({ ...current, ...patch });
  await updateConfig(GT_ASO_AGENDAMENTO_CONFIG_KEY, next);
  await updateConfig(GT_ASO_NOTIF_DIAS_KEY, next.antecedencia_dias);
  return next;
}
