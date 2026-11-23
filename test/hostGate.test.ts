import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHostGate } from "../src/hostGate.js";
import { RateLimitedError, SourceUnavailableError } from "../src/http.js";

// Own gates on a fake clock (Date and timers): the source gates are adjusted by test/setup.ts.
const T0 = 1_000_000;

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});

afterEach(() => {
  vi.useRealTimers();
});

/** A task that records when it started (ms after T0) and resolves at once. */
function recorder() {
  const starts: number[] = [];
  const task = (id: string) => async () => {
    starts.push(Date.now() - T0);
    return id;
  };
  return { starts, task };
}

const fail = (err: unknown) => async () => {
  throw err;
};

describe("createHostGate", () => {
  it("starts requests at least minIntervalMs apart, in call order", async () => {
    const gate = createHostGate({ minIntervalMs: 1000, maxQueueWaitMs: 5000 });
    const { starts, task } = recorder();
    const all = Promise.all([gate.run(task("a")), gate.run(task("b")), gate.run(task("c"))]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await all).toEqual(["a", "b", "c"]);
    expect(starts).toEqual([0, 1000, 2000]);
    // A request after a quiet period starts at once.
    await vi.advanceTimersByTimeAsync(10_000);
    await gate.run(task("d"));
    expect(starts.at(-1)).toBe(12_000);
  });

  it("refuses a turn more than maxQueueWaitMs away with rate_limited, reserving no slot and remembering no failure", async () => {
    const gate = createHostGate({ minIntervalMs: 1000, maxQueueWaitMs: 2000 });
    const { starts, task } = recorder();
    const accepted = [gate.run(task("a")), gate.run(task("b")), gate.run(task("c"))]; // turns at 0, 1000, 2000 (= max)
    const refused = gate.run(task("d")); // turn at 3000: 3000 ms away
    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    await expect(refused).rejects.toMatchObject({ retryAfterS: 3 });
    expect(gate.failing()).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    // The refused call took no slot: the next turn is still 3000, now 2000 away, so it is accepted.
    const next = gate.run(task("e"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(await Promise.all([...accepted, next])).toEqual(["a", "b", "c", "e"]);
    expect(starts).toEqual([0, 1000, 2000, 3000]);
  });

  it.each([
    [null, 60],
    [30, 60],
    [120, 120],
    [7200, 3600],
  ])("remembers a 429 with Retry-After %s for %i s (at least 60 s, at most 1 hour)", async (retryAfterS, waitS) => {
    const gate = createHostGate({ minIntervalMs: 0, maxQueueWaitMs: 0 });
    await expect(gate.run(fail(new RateLimitedError(retryAfterS)))).rejects.toMatchObject({ retryAfterS: waitS });
    const task = vi.fn(async () => "ok");
    await vi.advanceTimersByTimeAsync(waitS * 1000 - 1);
    expect(gate.failing()).toBe(true);
    await expect(gate.run(task)).rejects.toBeInstanceOf(RateLimitedError);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(gate.failing()).toBe(false);
    expect(await gate.run(task)).toBe("ok");
  });

  it("returns a remembered 429 with the remaining wait, rounded up to whole seconds", async () => {
    const gate = createHostGate({ minIntervalMs: 0, maxQueueWaitMs: 0 });
    await expect(gate.run(fail(new RateLimitedError(120)))).rejects.toMatchObject({ retryAfterS: 120 });
    await vi.advanceTimersByTimeAsync(50_500);
    await expect(gate.run(async () => "ok")).rejects.toMatchObject({ retryAfterS: 70 });
  });

  it("remembers any other failure 60 s and returns the same error without a request", async () => {
    const gate = createHostGate({ minIntervalMs: 0, maxQueueWaitMs: 0 });
    const err = new SourceUnavailableError("HTTP 503");
    await expect(gate.run(fail(err))).rejects.toBe(err);
    const task = vi.fn(async () => "ok");
    await vi.advanceTimersByTimeAsync(59_999);
    await expect(gate.run(task)).rejects.toBe(err);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await gate.run(task)).toBe("ok");
  });

  it("refuses a waiting request without running it when an earlier one failed meanwhile", async () => {
    const gate = createHostGate({ minIntervalMs: 1000, maxQueueWaitMs: 5000 });
    const err = new SourceUnavailableError("HTTP 503");
    const first = gate.run(fail(err));
    const second = vi.fn(async () => "ok");
    const waiting = gate.run(second); // passes the first check (no failure yet) and waits for its turn at 1000
    await expect(first).rejects.toBe(err);
    const refused = expect(waiting).rejects.toBe(err);
    await vi.advanceTimersByTimeAsync(1000);
    await refused;
    expect(second).not.toHaveBeenCalled();
  });
});
