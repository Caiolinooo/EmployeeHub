/**
 * Registry de adapters de banco (§3.1/§4 do design financeiro).
 * BANK_CATALOG alimenta a UI admin (§7.2); getBankAdapter resolve a instância.
 * Adapter ausente/capacidade ausente → CapacidadeNaoSuportadaError (tipado).
 */
import type { BankAdapter, BankAdapterKey, BankAdapterMeta } from './types';
import { CapacidadeNaoSuportadaError } from './types';
import { itauAdapter, ITAU_META } from './itau';
import { xpAdapter, XP_META } from './xp';
import { bbAdapter, BB_META, santanderAdapter, SANTANDER_META, bradescoAdapter, BRADESCO_META } from './placeholders';

/** Ordem de exibição: itau, xp, bb, santander, bradesco (§4). */
export const BANK_CATALOG: BankAdapterMeta[] = [
  ITAU_META,
  XP_META,
  BB_META,
  SANTANDER_META,
  BRADESCO_META,
];

const ADAPTERS: Record<BankAdapterKey, BankAdapter> = {
  itau: itauAdapter,
  xp: xpAdapter,
  bb: bbAdapter,
  santander: santanderAdapter,
  bradesco: bradescoAdapter,
};

/** Resolve o adapter por key (key do banco → instância stateless). */
export function getBankAdapter(key: string): BankAdapter {
  const adapter = ADAPTERS[key as BankAdapterKey];
  if (!adapter) {
    throw new CapacidadeNaoSuportadaError('adapter de banco', key);
  }
  return adapter;
}
