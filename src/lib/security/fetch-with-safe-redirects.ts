/**
 * Outbound fetch that never follows redirects blindly.
 * Each hop re-runs `parseSafeUrl` (allowlist + private/mapped IP checks).
 */

import { parseSafeUrl, UnsafeUrlError, type ParseSafeUrlOptions } from './safe-url';

export const MAX_SAFE_REDIRECT_HOPS = 3;

const REDIRECT_STATUSES = [301, 302, 303, 307, 308] as const;

export type FetchWithSafeRedirectsOptions = ParseSafeUrlOptions & {
  fetchImpl?: typeof fetch;
  maxHops?: number;
};

function isRedirectStatus(status: number): boolean {
  return (REDIRECT_STATUSES as readonly number[]).includes(status);
}

function cancelBody(response: Response): void {
  const body = response.body;
  if (body && typeof body.cancel === 'function') {
    void body.cancel();
  }
}

export async function fetchWithSafeRedirects(
  input: URL | string,
  init: RequestInit = {},
  options: FetchWithSafeRedirectsOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxHops = options.maxHops ?? MAX_SAFE_REDIRECT_HOPS;
  const allowedHosts = options.allowedHosts;
  const allowedProtocols = options.allowedProtocols;
  const guard = { allowedHosts, allowedProtocols };

  let current = parseSafeUrl(typeof input === 'string' ? input : input.href, guard);
  let hops = 0;

  while (true) {
    const response = await fetchImpl(current.href, { ...init, redirect: 'manual' });
    if (!isRedirectStatus(response.status)) {
      return response;
    }

    if (hops >= maxHops) {
      cancelBody(response);
      throw new UnsafeUrlError('Muitos redirecionamentos');
    }

    const location = response.headers.get('location');
    if (!location) {
      return response;
    }

    cancelBody(response);

    let next: URL;
    try {
      next = new URL(location, current.href);
    } catch {
      throw new UnsafeUrlError('Location inválida');
    }

    current = parseSafeUrl(next.href, guard);
    hops += 1;
  }
}
