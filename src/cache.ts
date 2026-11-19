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

/** In-memory only. Keys are source URLs (plus form body), never user coordinates. */
export class TtlCache {
  private readonly entries = new Map<string, Entry<unknown>>();
  private readonly inflight = new Map<string, Promise<Cached<unknown>>>();

  constructor(
    private readonly ttlMs: number = CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
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
        this.entries.set(key, { value, fetchedAt, expiresAt: at + this.ttlMs });
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

export const sharedCache = new TtlCache();
