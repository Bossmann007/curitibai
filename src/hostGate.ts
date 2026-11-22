import { RateLimitedError, SourceRefusedError } from "./http.js";

/** After a failure no request to the host for 60 s, or a 429's Retry-After when longer, at most 1 hour. */
const FAILURE_WAIT_S = 60;
const MAX_FAILURE_WAIT_S = 3600;

export interface HostGateOptions {
  /** At least this long between two request starts to the host from this process. */
  minIntervalMs: number;
  /** A request whose turn would come later than this gives up without a request (rate_limited with the wait). */
  maxQueueWaitMs: number;
  /**
   * When set, a final refusal (SourceRefusedError) is remembered this long instead of 60 s, so the gate refuses first
   * for as long as src/http.ts blocks the host (guaira_events: REFUSAL_BLOCK_MS). Capped at 1 hour.
   */
  refusalWaitMs?: number;
}

/**
 * The call's time budget would be exceeded: the request's slot comes after `startBy`. Thrown before the slot is
 * reserved, never remembered as a failure of the host, and no request is made.
 */
export class OutOfTimeError extends Error {
  /** @param startBy the budget that was exceeded (a caller sharing a load can tell another call's budget from its own). */
  constructor(readonly startBy: number) {
    super("out_of_time");
    this.name = "OutOfTimeError";
  }
}

export interface RunOptions {
  /** No request starts after this time (ms): a later slot throws OutOfTimeError. A request in flight is never cut. */
  startBy?: number;
}

export interface HostGate {
  run<T>(task: () => Promise<T>, options?: RunOptions): Promise<T>;
  /** True while a failure is remembered (a `run` now would be refused without a request). */
  failing(): boolean;
  /** Tests only: forget the schedule and any remembered failure. */
  reset(): void;
}

/**
 * One gate per host. `run` is refused at once while a failure is remembered; otherwise it waits for its slot (or gives
 * up with rate_limited when that slot is more than `maxQueueWaitMs` away); a failure is then remembered for at least
 * 60 s (a 429's Retry-After when longer, at most 1 hour) and the same error is returned. Never retries.
 */
export function createHostGate(options: HostGateOptions): HostGate {
  /** Earliest time (ms) the next request may start; reserved when a request is scheduled, so calls are serialized. */
  let nextAllowedAt = 0;
  /** After a failure, no request before this time; the same error is returned instead. */
  let retryAt = 0;
  let lastError: unknown = null;

  /** The remembered failure, with the remaining wait for a 429; null when no failure is remembered. */
  const rememberedFailure = (now: number): unknown => {
    if (now >= retryAt) return null;
    return lastError instanceof RateLimitedError ? new RateLimitedError(Math.ceil((retryAt - now) / 1000)) : lastError;
  };

  return {
    async run<T>(task: () => Promise<T>, runOptions: RunOptions = {}): Promise<T> {
      const now = Date.now();
      const failed = rememberedFailure(now);
      if (failed !== null) throw failed;
      const start = Math.max(now, nextAllowedAt);
      if (runOptions.startBy !== undefined && start > runOptions.startBy) throw new OutOfTimeError(runOptions.startBy);
      if (start - now > options.maxQueueWaitMs) throw new RateLimitedError(Math.ceil((start - now) / 1000));
      nextAllowedAt = start + options.minIntervalMs;
      if (start > now) await new Promise((resolve) => setTimeout(resolve, start - now));
      // A failure of an earlier request while this one waited is not asked again.
      const failedMeanwhile = rememberedFailure(Date.now());
      if (failedMeanwhile !== null) throw failedMeanwhile;
      try {
        return await task();
      } catch (err) {
        const asked =
          err instanceof RateLimitedError
            ? (err.retryAfterS ?? 0)
            : err instanceof SourceRefusedError && options.refusalWaitMs !== undefined
              ? options.refusalWaitMs / 1000
              : 0;
        const wait = Math.min(Math.max(FAILURE_WAIT_S, asked), MAX_FAILURE_WAIT_S);
        retryAt = Date.now() + wait * 1000;
        lastError = err instanceof RateLimitedError ? new RateLimitedError(wait) : err;
        throw lastError;
      }
    },
    failing(): boolean {
      return rememberedFailure(Date.now()) !== null;
    },
    reset(): void {
      nextAllowedAt = 0;
      retryAt = 0;
      lastError = null;
    },
  };
}
