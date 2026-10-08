import {
  featureGrantedByAcl,
  featureGrantedByJsonb,
  roleBypassesFeature,
  type EffectiveFeatureInput,
} from '../effective-feature';

export const CONTRACT_VIEW_ALL = 'contratos.view_all';
export const CONTRACT_VIEW_OWN = 'contratos.view_own';
export const CONTRACT_MANAGE_FEATURE = 'contracts.manage';

export type ContractViewScope = 'all' | 'own' | 'none';

/** `features` é o JSONB cru do usuário (false explícito vence); `aclNames` vem de loadEffectivePermissions. */
export type ContractAccessInput = EffectiveFeatureInput & {
  /** Módulo `contratos` efetivo (sidebar). `undefined` = não avaliado. */
  moduleEnabled?: boolean;
};

export function explicitlyOff(input: ContractAccessInput, key: string): boolean {
  return input.features?.[key] === false;
}

export function grantedByUser(input: ContractAccessInput, key: string): boolean {
  return featureGrantedByJsonb(input.features, key) || featureGrantedByAcl(input.aclNames, key);
}

/** Legado `contracts.manage` (JSONB) ou ACL `contratos.manage`; sem bypass de role. */
export function hasManageUmbrella(input: ContractAccessInput): boolean {
  return !explicitlyOff(input, CONTRACT_MANAGE_FEATURE) && grantedByUser(input, CONTRACT_MANAGE_FEATURE);
}

/**
 * Escopo de visualização de contratos.
 * ADMIN/MANAGER ou `view_all` veem tudo; `view_own` explícito restringe aos próprios (mesmo com `contracts.manage`);
 * `view_all: false` explícito força `own`. Sem nenhum dos dois (legado): `contracts.manage` vê tudo, demais só os próprios.
 * Módulo desligado para quem não é ADMIN/MANAGER = `none`.
 */
export function resolveContractViewScope(input: ContractAccessInput): ContractViewScope {
  if (roleBypassesFeature(input.role, CONTRACT_VIEW_ALL)) return 'all';
  if (input.moduleEnabled === false) return 'none';
  if (explicitlyOff(input, CONTRACT_VIEW_ALL)) return 'own';
  if (grantedByUser(input, CONTRACT_VIEW_ALL)) return 'all';
  if (grantedByUser(input, CONTRACT_VIEW_OWN)) return 'own';
  return hasManageUmbrella(input) ? 'all' : 'own';
}
