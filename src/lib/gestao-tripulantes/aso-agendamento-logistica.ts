const GT_MODULE = 'gestao-tripulantes';

export type AsoLogisticaAcao = 'aprovar' | 'reprovar' | 'cancelar';

export interface SetorAsoLogistica {
  name?: string | null;
  allowed_modules?: unknown;
}

export function isLogisticaRole(role: string | undefined): boolean {
  const r = (role || '').toUpperCase();
  return r === 'ADMIN' || r === 'ADMINISTRADOR' || r === 'SUPERADMIN' || r === 'MANAGER';
}

/** Strip accents so "Logística" matches "logistica". */
export function setorEhLogistica(name: string | null | undefined): boolean {
  const n = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return n.includes('logistica');
}

export function setorTemModuloGestaoTripulantes(allowed: unknown): boolean {
  const list = Array.isArray(allowed) ? allowed : [];
  return list.some((m) => String(m || '').trim().toLowerCase() === GT_MODULE);
}

/**
 * USER in a logística-like sector may approve ASO only when that sector
 * also has `gestao-tripulantes`. Module-only is not enough (QHSE/TI/Treinamento).
 */
export function setorPermiteAsoLogistica(sector: SetorAsoLogistica): boolean {
  return setorEhLogistica(sector.name) && setorTemModuloGestaoTripulantes(sector.allowed_modules);
}

export function mensagemErroAsoLogisticaNegada(acao: AsoLogisticaAcao): string {
  switch (acao) {
    case 'aprovar':
      return 'Apenas a logística pode aprovar o agendamento de ASO. É necessário ser gestor (ADMIN/MANAGER) ou pertencer a um setor de logística com o módulo Gestão de Tripulantes.';
    case 'reprovar':
      return 'Apenas a logística pode reprovar o agendamento de ASO. É necessário ser gestor (ADMIN/MANAGER) ou pertencer a um setor de logística com o módulo Gestão de Tripulantes.';
    case 'cancelar':
      return 'Apenas o DP solicitante ou a logística (gestor ou setor de logística com o módulo Gestão de Tripulantes) podem cancelar.';
    default: {
      const _never: never = acao;
      return _never;
    }
  }
}
