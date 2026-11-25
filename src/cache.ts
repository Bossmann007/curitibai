import { CACHE_TTL_MS } from "./config.js";

interface Entry<T> {
  value: T;
  fetchedAt: string;
  expiresAt: number;
}

export interface Cached<T> {
  value: T;
  fetchedAt: string;
}

/**
 * In-memory only. Keys are source URLs (plus form body), never full-precision user coordinates: place_at_point's keys
 * carry the point rounded to 4 decimals (about 11 m), the only precision it sends.
 */
export class TtlCache {
  private readonly entries = new Map<string, Entry<unknown>>();
  private readonly inflight = new Map<string, Promise<Cached<unknown>>>();

  constructor(
    private readonly ttlMs: number = CACHE_TTL_MS,
    // Read Date.now at each call (not the function captured at load), so a test clock applies.
    private readonly now: () => number = () => Date.now(),
    /** When set, at most this many entries are kept; the oldest stored is dropped first. */
    private readonly maxEntries?: number,
  ) {}

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<Cached<T>> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return { value: hit.value as T, fetchedAt: hit.fetchedAt };
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<Cached<T>>;
    const promise = (async () => {
      try {
        const value = await load();
        const at = this.now();
        for (const [k, e] of this.entries) if (e.expiresAt <= at) this.entries.delete(k);
        const fetchedAt = new Date(at).toISOString();
        if (this.maxEntries !== undefined) this.entries.delete(key);
        this.entries.set(key, { value, fetchedAt, expiresAt: at + this.ttlMs });
        if (this.maxEntries !== undefined) {
          for (const k of this.entries.keys()) {
            if (this.entries.size <= this.maxEntries) break;
            this.entries.delete(k);
          }
        }
        return { value, fetchedAt };
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }
}

/** Portal, OSM and CNES answers: at most 500 entries (keys carry user queries, so the count is otherwise unbounded). */
export const SHARED_CACHE_MAX_ENTRIES = 500;
export const sharedCache = new TtlCache(CACHE_TTL_MS, Date.now, SHARED_CACHE_MAX_ENTRIES);
