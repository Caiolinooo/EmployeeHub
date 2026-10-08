import { roleBypassesFeature } from '../effective-feature';
import {
  explicitlyOff,
  grantedByUser,
  hasManageUmbrella,
  resolveContractViewScope,
  type ContractAccessInput,
  type ContractViewScope,
} from './view-scope';

/**
 * `manage`: exige grant próprio (`contratos.<ação>`) ou o legado `contracts.manage`/ACL `contratos.manage`.
 * `open`: já era liberado a quem vê ou assina o próprio contrato; só `false` explícito bloqueia.
 */
const ACTION_DEFAULT = {
  create: 'manage',
  edit: 'manage',
  delete: 'manage',
  dispatch: 'manage',
  send: 'manage',
  cancel: 'manage',
  resend: 'manage',
  download: 'open',
  download_signed: 'open',
  sign: 'open',
  'templates.view': 'manage',
  'templates.manage': 'manage',
  'templates.use': 'manage',
  'signers.manage': 'manage',
  'audit.view': 'manage',
  export: 'manage',
} as const;

export type ContractAction = keyof typeof ACTION_DEFAULT;

export const CONTRACT_ACTIONS = Object.keys(ACTION_DEFAULT) as ContractAction[];

export type ContractAccess = {
  scope: ContractViewScope;
  can: Record<ContractAction, boolean>;
};

function featureKeys(action: ContractAction): string[] {
  return action === 'sign' ? ['contratos.sign', 'contracts.sign'] : [`contratos.${action}`];
}

export function canContractAction(input: ContractAccessInput, action: ContractAction): boolean {
  const keys = featureKeys(action);
  if (roleBypassesFeature(input.role, keys[0])) return true;
  if (input.moduleEnabled === false && action !== 'sign') return false;
  if (keys.some((key) => explicitlyOff(input, key))) return false;
  if (keys.some((key) => grantedByUser(input, key))) return true;
  return ACTION_DEFAULT[action] === 'open' || hasManageUmbrella(input);
}

export function buildContractAccess(input: ContractAccessInput): ContractAccess {
  const can = {} as Record<ContractAction, boolean>;
  for (const action of CONTRACT_ACTIONS) can[action] = canContractAction(input, action);
  return { scope: resolveContractViewScope(input), can };
}
