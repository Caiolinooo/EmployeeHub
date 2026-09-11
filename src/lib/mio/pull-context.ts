/**
 * MIO is a read-only source. Runtime request handlers (colaborador modal,
 * list, ASO, trainings, documents, Man Schedule, dashboard, IA tools)
 * MUST NOT call mio.app.br. Only an explicit admin/cron pull may enter
 * this context.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<{ pull: true }>();

export function isMioPullContext(): boolean {
  return store.getStore()?.pull === true;
}

/** Run a MIO → portal pull. Never wrap UI/request hydration in this. */
export function runMioPull<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ pull: true }, fn);
}

export function assertMioPullContext(action: string): void {
  if (isMioPullContext()) return;
  throw new Error(
    `[MIO] Runtime call blocked (${action}). Pull only from admin/cron sync. ` +
      'UI must read gt_* / mio_cache — never mio.app.br.'
  );
}
