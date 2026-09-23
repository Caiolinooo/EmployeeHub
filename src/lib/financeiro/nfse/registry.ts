/**
 * Registry de providers NFS-e (§3.2/§5.1 do design financeiro).
 * NFSE_PROVIDERS alimenta a UI admin; getNfseProvider resolve a instância.
 */
import type { NfseProvider, NfseProviderKey } from './types';
import { abrasf202 } from './abrasf/abrasf202';
import { abrasf204 } from './abrasf/abrasf204';
import { nacionalProvider } from './nacional';
import { proprietarioProvider } from './proprietario';

/** Metas por provider (para admin §7.2: exige certificado A1, lote máximo). */
export const NFSE_PROVIDERS: Record<NfseProviderKey, NfseProvider['meta']> = {
  abrasf202: abrasf202.meta,
  abrasf204: abrasf204.meta,
  nacional: nacionalProvider.meta,
  proprietario: proprietarioProvider.meta,
};

const PROVIDERS: Record<NfseProviderKey, NfseProvider> = {
  abrasf202,
  abrasf204,
  nacional: nacionalProvider,
  proprietario: proprietarioProvider,
};

/** Resolve o provider por key (§3.2). Key inválida → Error. */
export function getNfseProvider(key: string): NfseProvider {
  const provider = PROVIDERS[key as NfseProviderKey];
  if (!provider) throw new Error(`Provider NFS-e desconhecido: '${key}'.`);
  return provider;
}
