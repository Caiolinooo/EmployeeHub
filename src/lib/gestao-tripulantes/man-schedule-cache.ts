/** In-process bust for GET /api/man-schedule/realtime (same isolate only). */

const buckets = new Map<string, unknown>();
let generation = 0;

export function manScheduleCacheGeneration(): number {
  return generation;
}

export function invalidateManScheduleCache(): void {
  generation += 1;
  buckets.clear();
}

export function manScheduleResultCache(): Map<string, unknown> {
  return buckets;
}
