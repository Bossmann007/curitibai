// Citizen eval (docs/roadmap-1.0.md, phase A): realistic questions of a Curitiba citizen, each mapped to the tool,
// arguments and answer shape expected. Offline: synthetic fixtures, one fixed clock, fetch stubbed per tool.
// Questions no tool answers yet have tool null and a gap label: counted, not failed.
import { readFileSync, rmSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DATA_DIR_ENV } from "../../src/localfs.js";
import { REMOTE_DATA_ENV } from "../../src/sources/publishedData.js";
import { tools } from "../../src/tools/index.js";
import { stubFetch } from "../helpers.js";
import { mismatches, observe, type Question } from "./check.js";
import { buildDataDir, NOW, routesFor } from "./world.js";

const BANK = JSON.parse(readFileSync(new URL("./citizen-questions.json", import.meta.url), "utf8")) as Question[];
const TOOLS = new Map<string, (typeof tools)[number]>(tools.map((t) => [t.name, t]));
/** The App gaps of docs/tools.md (rows partial or none, AI assistant aside) that the bank must ask about. */
const APP_GAPS = ["realtime_bus", "useful_phones"];

let dataDir = "";
beforeAll(() => {
  dataDir = buildDataDir();
});
afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * Runs the handler with the clock fixed at NOW. Only Date, setTimeout and clearTimeout are fake: file reads and other
 * real I/O progress on the real event loop (setImmediate stays real), so the loop yields to it first, and moves fake
 * time to the next timer only when one is pending (the host gates space requests 5 s apart). No fixed tick budget: a
 * slow disk under a loaded suite only takes longer, bounded by the test timeout.
 */
async function run(tool: (typeof tools)[number], args: Record<string, unknown>): Promise<CallToolResult> {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(NOW);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each handler is typed against its own schema
  const parsed = z.object(tool.inputSchema).strict().parse(args) as any;
  let settled = false;
  const call = (tool.handler as (a: unknown) => Promise<CallToolResult>)(parsed).finally(() => {
    settled = true;
  });
  while (!settled) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (!settled && vi.getTimerCount() > 0) await vi.advanceTimersToNextTimerAsync();
  }
  return call;
}

describe("citizen question bank", () => {
  it("has unique ids, a question each, and a tool or a gap label", () => {
    const ids = BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of BANK) {
      expect(q.question.length, q.id).toBeGreaterThan(10);
      if (q.tool === null) {
        expect(q.gap, `${q.id}: tool null needs a gap label`).toMatch(/^[a-z_]+$/);
        expect(q.args ?? q.expect, `${q.id}: a gap has no args or expect`).toBeUndefined();
      } else {
        expect(TOOLS.has(q.tool), `${q.id}: unknown tool ${q.tool}`).toBe(true);
        expect(q.expect, `${q.id}: expect`).toBeDefined();
        expect(q.gap, `${q.id}: a tool question has no gap`).toBeUndefined();
      }
    }
  });

  it("asks every tool at least twice and every Curitiba App gap at least once", () => {
    for (const name of TOOLS.keys()) expect(BANK.filter((q) => q.tool === name).length, name).toBeGreaterThanOrEqual(2);
    const gaps = new Set(BANK.map((q) => q.gap));
    for (const gap of APP_GAPS) expect(gaps.has(gap), gap).toBe(true);
    expect(BANK.some((q) => q.tags?.includes("outside_curitiba"))).toBe(true);
    expect(BANK.some((q) => q.tags?.includes("ambiguous"))).toBe(true);
  });

  it("every args object passes its tool's input schema, with no unknown key", () => {
    for (const q of BANK.filter((x) => x.tool !== null)) {
      const res = z.object(TOOLS.get(q.tool!)!.inputSchema).strict().safeParse(q.args ?? {});
      expect(res.success, `${q.id}: ${res.success ? "" : res.error.message}`).toBe(true);
    }
  });
});

describe("citizen questions answered offline", () => {
  it.each(BANK.filter((q) => q.tool !== null).map((q) => [q.id, q] as const))("%s", async (_id, q) => {
    const tool = TOOLS.get(q.tool!)!;
    vi.stubEnv(DATA_DIR_ENV, dataDir);
    vi.stubEnv(REMOTE_DATA_ENV, "0");
    stubFetch(routesFor(tool.name, q.args ?? {}));
    const res = await run(tool, q.args ?? {});
    const obs = observe(tool.name, res);
    expect(mismatches(q, obs), `${q.id} "${q.question}"`).toEqual([]);
    if (!res.isError) {
      // The same answer a client gets: the structured result passes the tool's output schema.
      expect(tool.outputSchema.safeParse(res.structuredContent).success, `${q.id}: output schema`).toBe(true);
    }
  });
});
