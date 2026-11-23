import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  issueTitle,
  MAX_BYTES,
  RECEITA_URL,
  RELEASE_REPOS,
  run,
  USER_AGENT,
  VERSION_FILE,
  versionLabel,
  type RunDeps,
  type VersionRecord,
} from "../scripts/check-receita-version.mjs";

const REPO = "Bossmann007/curitibai";
const API = "https://api.github.com";

/** The real answer of 2026-11-23 (no personal data). */
const RECEITA_BODY = {
  ambiente: "apr",
  dataVersaoDb: "2026-11-09",
  descricaoVersaoApp: "1.7.2-0d9b30c1",
  descricaoVersaoDb: "Nova tabela de Classificações Tributárias (IT 2025.002 v.1.71), publicada em 30/10/2026.",
  versaoApp: "1.7.2-0d9b30c1",
  versaoDb: "V0073",
};
const RELEASES: Record<string, { tag_name: string; html_url: string; published_at: string }> = {
  "calculadora-rtc-regime-regular": {
    tag_name: "1.7.2",
    html_url: "https://github.com/ReceitaFederal/calculadora-rtc-regime-regular/releases/tag/1.7.2",
    published_at: "2026-11-19T23:05:50Z",
  },
  "calculadora-rtc-simples-nacional": {
    tag_name: "1.0.2",
    html_url: "https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional/releases/tag/1.0.2",
    published_at: "2026-11-20T00:46:54Z",
  },
};

interface Call {
  url: string;
  init: RequestInit;
}
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let dir: string;
let calls: Call[];
let logs: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "receita-version-"));
  calls = [];
  logs = [];
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Default network: the Receita answer above, both releases, no open issue, issue creation OK. */
function network(over: Partial<Record<"receita" | "releases" | "issues" | "create", Handler>> = {}) {
  return async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const u = new URL(url);
    if (url === RECEITA_URL) return (over.receita ?? (() => json(RECEITA_BODY)))(url, init);
    if (u.host === "api.github.com" && u.pathname.startsWith("/repos/ReceitaFederal/")) {
      if (over.releases) return over.releases(url, init);
      const repo = u.pathname.split("/")[3]!;
      return json(RELEASES[repo]);
    }
    if (u.host === "api.github.com" && u.pathname === `/repos/${REPO}/issues` && (init.method ?? "GET") === "GET") {
      expect(u.searchParams.get("state")).toBe("open");
      return (over.issues ?? (() => json([])))(url, init);
    }
    if (u.host === "api.github.com" && u.pathname === `/repos/${REPO}/issues` && init.method === "POST") {
      return (over.create ?? (() => json({ number: 7, html_url: `https://github.com/${REPO}/issues/7` }, 201)))(url, init);
    }
    throw new Error(`unexpected request ${url}`);
  };
}

function deps(fetch: RunDeps["fetch"], env: Record<string, string | undefined> = {}) {
  return {
    fetch,
    now: () => new Date("2026-12-01T09:23:00Z"),
    env: { CURITIBAI_DATA_DIR: dir, GITHUB_REPOSITORY: REPO, GH_TOKEN: "test-token", ...env },
    log: (l: string) => {
      logs.push(l);
    },
  };
}

const file = () => join(dir, VERSION_FILE);
const readRecord = () => JSON.parse(readFileSync(file(), "utf8")) as VersionRecord;
const posts = () => calls.filter((c) => c.init.method === "POST");

async function baseline(): Promise<VersionRecord> {
  const r = await run(deps(network()));
  expect(r).toMatchObject({ code: "baseline", exit: 0 });
  const rec = readRecord();
  calls = [];
  logs = [];
  return rec;
}

describe("check-receita-version", () => {
  it("first run: records the baseline, opens no issue", async () => {
    const rec = await baseline();
    expect(rec).toEqual({
      versaoApp: "1.7.2-0d9b30c1",
      versaoDb: "V0073",
      dataVersaoDb: "2026-11-09",
      descricaoVersaoDb: RECEITA_BODY.descricaoVersaoDb,
      releases: {
        "calculadora-rtc-regime-regular": {
          tag: "1.7.2",
          url: RELEASES["calculadora-rtc-regime-regular"]!.html_url,
          published_at: "2026-11-19T23:05:50Z",
        },
        "calculadora-rtc-simples-nacional": {
          tag: "1.0.2",
          url: RELEASES["calculadora-rtc-simples-nacional"]!.html_url,
          published_at: "2026-11-20T00:46:54Z",
        },
      },
      recorded_at: "2026-12-01T09:23:00.000Z",
    });
  });

  it("same version: no write, no issue, exit 0", async () => {
    const before = await baseline();
    const text = readFileSync(file(), "utf8");
    const r = await run(deps(network({ create: () => { throw new Error("must not create"); } })));
    expect(r).toMatchObject({ code: "unchanged", exit: 0 });
    expect(readFileSync(file(), "utf8")).toBe(text);
    expect(readRecord()).toEqual(before);
    expect(posts()).toHaveLength(0);
    expect(calls.some((c) => c.url.includes(`/repos/${REPO}/issues`))).toBe(false);
  });

  it("changed: opens one issue with before → after, release links and the 2027 reminder, then writes the file", async () => {
    await baseline();
    const changed = { ...RECEITA_BODY, versaoApp: "1.8.0-aaaa1111", versaoDb: "V0074", dataVersaoDb: "2026-12-01" };
    const r = await run(deps(network({ receita: () => json(changed) })));
    expect(r).toMatchObject({ code: "changed", exit: 0 });
    const [post] = posts();
    expect(posts()).toHaveLength(1);
    expect(post!.url).toBe(`${API}/repos/${REPO}/issues`);
    const body = JSON.parse(post!.init.body as string) as { title: string; body: string };
    expect(body.title).toBe("Receita: calculadora mudou (app 1.7.2-0d9b30c1, base V0073 (2026-11-09), regular 1.7.2, simples 1.0.2 → app 1.8.0-aaaa1111, base V0074 (2026-12-01), regular 1.7.2, simples 1.0.2)");
    expect(body.body).toContain("`versaoApp`: 1.7.2-0d9b30c1 → 1.8.0-aaaa1111");
    expect(body.body).toContain("`versaoDb`: V0073 → V0074");
    expect(body.body).toContain(RELEASES["calculadora-rtc-regime-regular"]!.html_url);
    expect(body.body).toContain("2027");
    expect(body.body).toContain("simulated");
    expect(readRecord().versaoApp).toBe("1.8.0-aaaa1111");
  });

  it("changed: an open issue with the same title is not duplicated, the file is still written", async () => {
    const before = await baseline();
    const changed = { ...RECEITA_BODY, versaoDb: "V0074" };
    const title = issueTitle(before, { ...before, versaoDb: "V0074" });
    const r = await run(
      deps(network({ receita: () => json(changed), issues: () => json([{ number: 3, title, html_url: "x" }]) })),
    );
    expect(r).toMatchObject({ code: "changed", exit: 0, issue: "existing" });
    expect(posts()).toHaveLength(0);
    expect(readRecord().versaoDb).toBe("V0074");
  });

  it("only a release tag changed: the title still differs (release tags are part of the label)", async () => {
    const before = await baseline();
    const after = {
      ...before,
      releases: { ...before.releases, "calculadora-rtc-simples-nacional": { tag: "1.0.3", url: "u", published_at: "p" } },
    };
    expect(versionLabel(before)).not.toBe(versionLabel(after));
  });

  it("issue creation fails: exit 1 and the previous file is kept (next run retries)", async () => {
    await baseline();
    const text = readFileSync(file(), "utf8");
    const r = await run(deps(network({ receita: () => json({ ...RECEITA_BODY, versaoDb: "V0074" }), create: () => json({}, 403) })));
    expect(r.exit).toBe(1);
    expect(readFileSync(file(), "utf8")).toBe(text);
  });

  it("Receita host down: exit 1, nothing written, no issue", async () => {
    const r = await run(deps(network({ receita: () => { throw new TypeError("fetch failed"); } })));
    expect(r).toMatchObject({ code: "receita_unavailable", exit: 1 });
    expect(existsSync(file())).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it.each([
    ["HTTP 503", () => json({}, 503)],
    ["a redirect", () => new Response(null, { status: 302, headers: { location: "https://elsewhere.example/" } })],
    ["HTML instead of JSON", () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } })],
  ])("Receita answers %s: exit 1, nothing written", async (_n, h) => {
    const r = await run(deps(network({ receita: h })));
    expect(r.exit).toBe(1);
    expect(existsSync(file())).toBe(false);
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a missing versaoDb", JSON.stringify({ ...RECEITA_BODY, versaoDb: undefined })],
    ["a versaoApp with markup", JSON.stringify({ ...RECEITA_BODY, versaoApp: "1.0 <b>@all</b>" })],
    ["a bad date", JSON.stringify({ ...RECEITA_BODY, dataVersaoDb: "09/11/2026" })],
  ])("Receita answers %s: exit 1, previous file kept, no issue", async (_n, text) => {
    await baseline();
    const kept = readFileSync(file(), "utf8");
    const r = await run(deps(network({ receita: () => new Response(text, { headers: { "content-type": "application/json" } }) })));
    expect(r).toMatchObject({ code: "invalid_response", exit: 1 });
    expect(readFileSync(file(), "utf8")).toBe(kept);
    expect(posts()).toHaveLength(0);
  });

  it("a release lookup that fails keeps the previous tag (never records null, no false change)", async () => {
    const before = await baseline();
    const r = await run(deps(network({ releases: () => json({}, 500) })));
    expect(r).toMatchObject({ code: "unchanged", exit: 0 });
    expect(readRecord().releases).toEqual(before.releases);
    expect(posts()).toHaveLength(0);
  });

  it("sends the token to api.github.com only, the project User-Agent everywhere, never follows redirects", async () => {
    await run(deps(network()));
    expect(calls.length).toBe(1 + RELEASE_REPOS.length);
    for (const c of calls) {
      const h = new Headers(c.init.headers);
      expect(h.get("user-agent")).toBe(USER_AGENT);
      expect(c.init.redirect).toBe("manual");
      expect(c.init.signal).toBeInstanceOf(AbortSignal);
      if (new URL(c.url).host === "api.github.com") expect(h.get("authorization")).toBe("Bearer test-token");
      else expect(h.has("authorization")).toBe(false);
    }
  });

  it("without GH_TOKEN or GITHUB_REPOSITORY: exit 1 before any request", async () => {
    const r = await run(deps(network(), { GH_TOKEN: undefined }));
    expect(r.exit).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it("an unreadable previous file: exit 1, the file is not replaced", async () => {
    mkdirSync(join(dir, "receita"));
    writeFileSync(file(), "{broken");
    const r = await run(deps(network()));
    expect(r.exit).toBe(1);
    expect(readFileSync(file(), "utf8")).toBe("{broken");
  });

  it("first run with a failed release lookup: exit 1, no baseline (a null tag would be a false change next month)", async () => {
    const r = await run(deps(network({ releases: () => json({}, 503) })));
    expect(r).toMatchObject({ code: "release_unavailable", exit: 1 });
    expect(existsSync(file())).toBe(false);
  });

  it("only the base date changed: the title still shows the change", async () => {
    const before = await baseline();
    const r = await run(deps(network({ receita: () => json({ ...RECEITA_BODY, dataVersaoDb: "2026-12-02" }) })));
    expect(r).toMatchObject({ code: "changed", exit: 0, issue: "created" });
    const { title } = JSON.parse(posts()[0]!.init.body as string) as { title: string };
    expect(title).toContain("(2026-11-09)");
    expect(title).toContain("(2026-12-02)");
    expect(versionLabel(before)).not.toBe(versionLabel(readRecord()));
  });

  it("duplicate check reads the next page of open issues", async () => {
    const before = await baseline();
    const title = issueTitle(before, { ...before, versaoDb: "V0074" });
    const filler = Array.from({ length: 100 }, (_, i) => ({ number: 100 + i, title: `other ${i}` }));
    const r = await run(
      deps(
        network({
          receita: () => json({ ...RECEITA_BODY, versaoDb: "V0074" }),
          issues: (url) => json(new URL(url).searchParams.get("page") === "1" ? filler : [{ number: 5, title }]),
        }),
      ),
    );
    expect(r).toMatchObject({ code: "changed", issue: "existing" });
    expect(posts()).toHaveLength(0);
  });

  it("a body over the cap is refused (Content-Length or streamed size)", async () => {
    const big = JSON.stringify({ ...RECEITA_BODY, pad: "x".repeat(MAX_BYTES) });
    const streamed = await run(deps(network({ receita: () => new Response(big, { headers: { "content-type": "application/json" } }) })));
    expect(streamed).toMatchObject({ code: "receita_unavailable", exit: 1 });
    const declared = await run(
      deps(network({ receita: () => new Response("{}", { headers: { "content-type": "application/json", "content-length": "999999" } }) })),
    );
    expect(declared.exit).toBe(1);
    expect(existsSync(file())).toBe(false);
  });

  it("a previous file without dataVersaoDb is unreadable, not a change", async () => {
    const before = await baseline();
    const partial: Partial<VersionRecord> = { ...before };
    delete partial.dataVersaoDb;
    writeFileSync(file(), JSON.stringify(partial));
    const r = await run(deps(network()));
    expect(r).toMatchObject({ code: "previous_unreadable", exit: 1 });
    expect(posts()).toHaveLength(0);
  });
});
