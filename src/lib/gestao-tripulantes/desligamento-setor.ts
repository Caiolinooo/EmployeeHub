import { setorTemModuloGestaoTripulantes } from './aso-agendamento-logistica';

export interface SetorDesligamento {
  name?: string | null;
  allowed_modules?: unknown;
}

export function isDesligamentoGestorRole(role: string | undefined): boolean {
  const r = (role || '').toUpperCase();
  return r === 'ADMIN' || r === 'ADMINISTRADOR' || r === 'SUPERADMIN' || r === 'MANAGER';
}

function normalizarNomeSetor(name: string | null | undefined): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Departamento Pessoal / RH — sem e-mail hardcoded. */
export function setorEhDp(name: string | null | undefined): boolean {
  const n = normalizarNomeSetor(name);
  if (!n) return false;
  if (n.includes('departamento pessoal') || n.includes('depto pessoal') || n.includes('dept pessoal')) {
    return true;
  }
  if (n.includes('recursos humanos')) return true;
  const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.includes('dp') || tokens.includes('rh');
}

export function setorPermiteDesligamento(sector: SetorDesligamento): boolean {
  return setorEhDp(sector.name) && setorTemModuloGestaoTripulantes(sector.allowed_modules);
}

export const MENSAGEM_DESLIGAMENTO_NEGADO =
  'Apenas o DP pode registrar desligamento. É necessário ser gestor (ADMIN/MANAGER) ou pertencer a um setor de Departamento Pessoal / RH com o módulo Gestão de Tripulantes.';
