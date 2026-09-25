import tls from 'tls';
import type https from 'https';
import { ICP_BRASIL_CA_PEMS } from './icp-brasil-cas';

export type EsocialHttpsTlsOptions = Pick<
  https.RequestOptions,
  'rejectUnauthorized' | 'minVersion' | 'ca'
>;

/**
 * Opt-in insecure TLS for the e-Social SOAP agent only.
 * Uses the already-existing Node env `NODE_TLS_REJECT_UNAUTHORIZED`.
 * Do not add new env vars. Default (unset) is secure.
 */
export function isEsocialInsecureTlsOptIn(
  nodeTlsRejectUnauthorized?: string
): boolean {
  const value =
    nodeTlsRejectUnauthorized !== undefined
      ? nodeTlsRejectUnauthorized
      : process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  return value === '0';
}

/** Node default Mozilla CAs plus ICP-Brasil roots (does not replace the default store). */
export function loadEsocialCaBundle(): string[] {
  return [...tls.rootCertificates, ...ICP_BRASIL_CA_PEMS];
}

/**
 * TLS options for the e-Social SOAP client.
 * Default: certificate validation ON + ICP-Brasil roots added to the default CA store.
 * Insecure mode only when NODE_TLS_REJECT_UNAUTHORIZED=0 (existing Node env).
 */
export function buildEsocialHttpsTlsOptions(
  nodeTlsRejectUnauthorized?: string
): EsocialHttpsTlsOptions {
  const rejectUnauthorized = !isEsocialInsecureTlsOptIn(nodeTlsRejectUnauthorized);
  return {
    rejectUnauthorized,
    minVersion: 'TLSv1.2',
    ca: loadEsocialCaBundle(),
  };
}
