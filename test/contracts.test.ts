import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { connectClient } from "./helpers.js";

// Tool names and schemas are a public contract (Hyrum's law): clients depend on every field they can see. This test
// keeps them in a committed snapshot, read from the real server's tools/list, and fails on any change (SPEC.md).
const SNAPSHOT = new URL("./fixtures/tool-contracts.json", import.meta.url);
const UPDATE = process.env.CURITIBAI_UPDATE_CONTRACTS === "1";
const HOW_TO_UPDATE =
  "If the change is on purpose, rewrite the snapshot with `npm run contracts:update` and add a CHANGELOG.md entry for " +
  "it in the same pull request: tool names and schemas are a public contract.";

interface Contract {
  name: string;
  inputSchema: unknown;
  outputSchema?: unknown;
}

async function listTools() {
  const client = await connectClient();
  try {
    return (await client.listTools()).tools;
  } finally {
    await client.close();
  }
}

/** What a client sees as the contract of each tool, as JSON on the wire (the in-memory transport does not serialize), sorted by name. */
function contracts(tools: Awaited<ReturnType<typeof listTools>>): Contract[] {
  const list = tools
    .map((t) => ({ name: t.name, inputSchema: t.inputSchema, ...(t.outputSchema === undefined ? {} : { outputSchema: t.outputSchema }) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return JSON.parse(JSON.stringify(list)) as Contract[];
}

/** One line per tool added, removed or changed (naming the changed parts); empty when equal. */
function contractDiff(expected: Contract[], actual: Contract[]): string[] {
  const before = new Map(expected.map((c) => [c.name, c]));
  const after = new Map(actual.map((c) => [c.name, c]));
  const lines: string[] = [];
  for (const name of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const b = before.get(name);
    const a = after.get(name);
    if (!b) lines.push(`added: ${name}`);
    else if (!a) lines.push(`removed: ${name}`);
    else {
      const parts = (["inputSchema", "outputSchema"] as const).filter((k) => !isDeepStrictEqual(b[k], a[k]));
      if (parts.length > 0) lines.push(`changed: ${name} (${parts.join(", ")})`);
    }
  }
  return lines;
}

const size = (value: unknown) => (value === undefined ? 0 : JSON.stringify(value).length);

// Guard on what every tools/list costs the client (SPEC.md): one description at most MAX_DESCRIPTION characters
// (raw string), and all of them, measured as JSON like the baseline, at most MAX_DESCRIPTIONS_SUM.
const MAX_DESCRIPTION = 400;
const MAX_DESCRIPTIONS_SUM = 9_600;
/** The same 5 numbers at v0.24.1, before descriptions were shortened (SPEC.md). */
const BASELINE_V0_24_1 = { tools: 25, descriptions: 15_561, inputSchemas: 19_636, outputSchemas: 63_226, total: 107_011 };

describe("tool contracts", () => {
  it("tool names, inputSchemas and outputSchemas match test/fixtures/tool-contracts.json", async () => {
    const actual = contracts(await listTools());
    if (UPDATE) {
      writeFileSync(SNAPSHOT, JSON.stringify(actual, null, 2) + "\n");
      return;
    }
    if (!existsSync(SNAPSHOT)) throw new Error(`No snapshot at test/fixtures/tool-contracts.json. ${HOW_TO_UPDATE}`);
    const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Contract[];
    const diff = contractDiff(expected, actual);
    if (diff.length > 0) {
      throw new Error(`Tool contract changed (test/fixtures/tool-contracts.json):\n  ${diff.join("\n  ")}\n${HOW_TO_UPDATE}`);
    }
  });

  it("names every tool added, removed or changed", () => {
    const c = (name: string, inputSchema: unknown, outputSchema?: unknown): Contract => ({ name, inputSchema, outputSchema });
    expect(
      contractDiff(
        [c("a", { x: 1 }), c("b", { y: 1 }, { z: 1 }), c("c", {})],
        [c("b", { y: 2 }, { z: 2 }), c("c", {}), c("d", {})],
      ),
    ).toEqual(["removed: a", "changed: b (inputSchema, outputSchema)", "added: d"]);
  });

  it(`every description is at most ${MAX_DESCRIPTION} characters and their sum at most ${MAX_DESCRIPTIONS_SUM} (SPEC.md)`, async () => {
    const tools = await listTools();
    const sum = (pick: (t: (typeof tools)[number]) => unknown) => tools.reduce((n, t) => n + size(pick(t)), 0);
    const measured = {
      tools: tools.length,
      descriptions: sum((t) => t.description),
      inputSchemas: sum((t) => t.inputSchema),
      outputSchemas: sum((t) => t.outputSchema),
      total: size({ tools }),
    };
    process.stdout.write(`tools/list size (characters), v0.24.1: ${JSON.stringify(BASELINE_V0_24_1)}\n`);
    process.stdout.write(`tools/list size (characters), now:     ${JSON.stringify(measured)}\n`);
    // The measure itself works: names, titles and annotations make the total more than the three parts.
    expect(measured.total).toBeGreaterThan(measured.descriptions + measured.inputSchemas + measured.outputSchemas);
    expect(measured.descriptions).toBeGreaterThan(0);
    const tooLong = tools
      .filter((t) => (t.description ?? "").length > MAX_DESCRIPTION)
      .map((t) => `${t.name} (${(t.description ?? "").length})`);
    expect(tooLong, `descriptions over ${MAX_DESCRIPTION} characters`).toEqual([]);
    expect(measured.descriptions, `descriptions sum over the ceiling of ${MAX_DESCRIPTIONS_SUM}`).toBeLessThanOrEqual(MAX_DESCRIPTIONS_SUM);
  });
});
