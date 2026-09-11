/**
 * Helpers for Man Schedule event types (marcadores customizáveis).
 * Storage codes: normal | previsto | fi | dba | stb | offc | custom
 * `previsto` displays as ON* and is never POB.
 * Legacy DB values (folga_indenizada, dobra, standby) are normalized on read.
 */

export interface GTTipoEventoEscala {
  id: string;
  codigo: string;
  display_code: string;
  label: string;
  bg_color: string;
  text_color: string;
  ordem: number;
  ativo: boolean;
  is_system: boolean;
  maps_to_db_tipo: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Built-in seeds used when table is empty / unavailable. */
export const DEFAULT_TIPOS_EVENTO_ESCALA: Omit<GTTipoEventoEscala, 'id' | 'created_at' | 'updated_at'>[] = [
  { codigo: 'normal', display_code: 'ON', label: 'Embarcado', bg_color: '#e2efda', text_color: '#00b050', ordem: 10, ativo: true, is_system: true, maps_to_db_tipo: 'normal' },
  { codigo: 'previsto', display_code: 'ON*', label: 'Embarque previsto (não POB)', bg_color: '#c6d9f0', text_color: '#1f4e79', ordem: 15, ativo: true, is_system: true, maps_to_db_tipo: 'previsto' },
  { codigo: 'fi', display_code: 'FI', label: 'Folga Indenizada', bg_color: '#e2efda', text_color: '#00b050', ordem: 20, ativo: true, is_system: true, maps_to_db_tipo: 'folga_indenizada' },
  { codigo: 'dba', display_code: 'DBA', label: 'Dobra', bg_color: '#fce5cd', text_color: '#783f04', ordem: 30, ativo: true, is_system: true, maps_to_db_tipo: 'dobra' },
  { codigo: 'stb', display_code: 'STB', label: 'StandBy', bg_color: '#fff2cc', text_color: '#7f6000', ordem: 40, ativo: true, is_system: true, maps_to_db_tipo: 'standby' },
  { codigo: 'offc', display_code: 'OFF-C', label: 'Troca de Turma', bg_color: '#f4cccc', text_color: '#cc0000', ordem: 50, ativo: true, is_system: true, maps_to_db_tipo: 'offc' },
  { codigo: 'tre', display_code: 'TRE', label: 'Treinamento', bg_color: '#efefef', text_color: '#434343', ordem: 60, ativo: true, is_system: true, maps_to_db_tipo: 'treinamento' },
  { codigo: 'ferias', display_code: 'FER', label: 'Férias', bg_color: '#d9d2e9', text_color: '#351c75', ordem: 70, ativo: true, is_system: true, maps_to_db_tipo: 'ferias' },
  { codigo: 'afastamento', display_code: 'AFAST', label: 'Afastamento', bg_color: '#f4cccc', text_color: '#990000', ordem: 80, ativo: true, is_system: true, maps_to_db_tipo: 'afastamento' },
];

const LEGACY_TO_CODIGO: Record<string, string> = {
  normal: 'normal',
  previsto: 'previsto',
  on_previsto: 'previsto',
  'on*': 'previsto',
  folga_indenizada: 'fi',
  fi: 'fi',
  dobra: 'dba',
  dba: 'dba',
  standby: 'stb',
  stb: 'stb',
  offc: 'offc',
  troca_turma: 'offc',
  substituicao: 'normal',
  treinamento: 'tre',
  tre: 'tre',
  tf: 'tre',
  ferias: 'ferias',
  férias: 'ferias',
  fer: 'ferias',
  afastamento: 'afastamento',
  afastado: 'afastamento',
  licenca: 'afastamento',
};

export { normalizeCpf } from '@/lib/utils/identity';

/** Map stored embarque.tipo → schedule codigo (preserves offc and custom). */
export function mapDbTipoToCodigo(tipo: string | null | undefined): string {
  if (!tipo) return 'normal';
  const key = tipo.trim().toLowerCase();
  if (LEGACY_TO_CODIGO[key]) return LEGACY_TO_CODIGO[key];
  return key;
}

/**
 * Map UI/API rotation codigo → value stored in gt_historico_embarques.tipo.
 * OFF-C stores as `offc` (not folga_indenizada).
 */
export function mapCodigoToDbTipo(codigo: string | null | undefined): string {
  if (!codigo) return 'normal';
  const key = codigo.trim().toLowerCase();
  switch (key) {
    case 'normal':
    case 'on':
      return 'normal';
    case 'previsto':
    case 'on_previsto':
    case 'on*':
      return 'previsto';
    case 'fi':
    case 'folga_indenizada':
      return 'fi';
    case 'dba':
    case 'dobra':
      return 'dba';
    case 'stb':
    case 'standby':
      return 'stb';
    case 'offc':
    case 'off-c':
    case 'troca_turma':
      return 'offc';
    case 'ferias':
    case 'férias':
    case 'fer':
      return 'ferias';
    case 'afastamento':
    case 'afastado':
      return 'afastamento';
    default:
      return key;
  }
}

/** Hex without # for XLSX styles. */
export function hexToRgbNoHash(hex: string, fallback = 'E2EFDA'): string {
  const cleaned = (hex || '').replace('#', '').trim().toUpperCase();
  if (/^[0-9A-F]{6}$/.test(cleaned)) return cleaned;
  if (/^[0-9A-F]{3}$/.test(cleaned)) {
    return cleaned.split('').map((c) => c + c).join('');
  }
  return fallback;
}
