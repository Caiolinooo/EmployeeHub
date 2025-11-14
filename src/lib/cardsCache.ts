/*
  Client-side cards cache with in-flight request de-duplication.
  Ensures only one POST /api/cards/supabase per userId+role at a time.
*/

export type CardsRequest = {
  userId?: string | null;
  userRole?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
};

export type CardsCacheKey = string; // `${userId}|${userRole}`

type Entry = {
  data?: any[];
  ts?: number;
  promise?: Promise<any[]> | null;
};

const store = new Map<CardsCacheKey, Entry>();
const TTL_MS = 60 * 1000; // 60s default TTL to avoid stale menus and repeated calls

function makeKey(req: CardsRequest): CardsCacheKey {
  const id = req.userId || '';
  const role = (req.userRole || '').toLowerCase();
  return `${id}|${role}`;
}

function isFresh(entry?: Entry): boolean {
  if (!entry || !entry.ts) return false;
  return Date.now() - entry.ts < TTL_MS;
}

export function invalidateCardsCache(req?: CardsRequest) {
  if (!req) {
    store.clear();
    return;
  }
  store.delete(makeKey(req));
}

export async function getCardsCached(req: CardsRequest): Promise<any[]> {
  const key = makeKey(req);
  const entry = store.get(key);

  if (entry && isFresh(entry) && entry.data) {
    return entry.data;
  }

  if (entry?.promise) {
    return entry.promise;
  }

  const fetchPromise = (async () => {
    const res = await fetch('/api/cards/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: req.userId,
        userRole: req.userRole,
        userEmail: req.userEmail,
        userPhone: req.userPhone,
      })
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch cards: ${res.status}`);
    }
    const data = await res.json();
    const now = Date.now();
    const current = store.get(key) || {};
    store.set(key, { ...current, data, ts: now, promise: null });
    return data;
  })();

  store.set(key, { ...(entry || {}), promise: fetchPromise });
  try {
    return await fetchPromise;
  } finally {
    const updated = store.get(key);
    if (updated && updated.promise) {
      updated.promise = null;
      store.set(key, updated);
    }
  }
}

export function peekCardsCache(req: CardsRequest): any[] | undefined {
  const entry = store.get(makeKey(req));
  if (entry && isFresh(entry)) return entry.data;
  return undefined;
}

