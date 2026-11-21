import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  curitibaDate,
  decodeBody,
  DEADLINE_MS,
  GAP_MS,
  inWindow,
  listPath,
  parseDates,
  parseDetailPage,
  parseListPage,
  parseRobots,
  robotsAllows,
  robotsGroupFor,
  robotsMatchesRecorded,
  robotsPatternMatches,
  run,
  USER_AGENT,
  validEvent,
  type RunDeps,
} from "../scripts/fetch-events.mjs";
import { fixture } from "./helpers.js";

// Synthetic pages only (test/fixtures/events_synthetic): invented events that imitate the site's structure.
const LIST = fixture("events_synthetic/list_page.html");
const DETAIL = fixture("events_synthetic/detail_page.html");
const ORIGIN = "https://turismo.curitiba.pr.gov.br";

const ROBOTS = [
  "User-agent: *",
  "Request-rate: 1/5",
  "Visit-time: 0200-0600",
  "Disallow: /bin",
  "Disallow: /Imagem",
  "Disallow: *.pdf",
  "Disallow: *.asp",
  "Allow: *.aspx",
  "",
].join("\n");

/** A list page for 21-11-2026 with the given items and highest page number (same markup as the fixture). */
function listHtml(items: { id: number; slug: string }[], maxPage = 1, date = "21-11-2026"): string {
  const blocks = items
    .map(
      (it, i) => `<div class="itemEventoConteudo">
<span class="dataEvento dataEventoMenor">21</span><span class="dataEvento dataEventoMenor">11</span>
<span class="categoria">Lazer</span>
<h4><a id="cphMasterPortal_rptEventos_hlkEvento_${i}" href="/evento/${it.slug}/${it.id}">Evento sintético ${it.id}</a></h4>
</div>`,
    )
    .join("\n");
  const pager = Array.from({ length: maxPage }, (_, i) => (i === 0 ? "<li><a>1</a></li>" : `<li><a href="/eventos/${date}/${i + 1}">${i + 1}</a></li>`)).join("");
  return `<html><head><meta charset="utf-8" /></head><body>
<input name="ctl00$cphMasterPortal$txtFiltroDataInicio" type="text" value="${date}" id="cphMasterPortal_txtFiltroDataInicio" />
${blocks}
<ul id="cphMasterPortal_ucPaginador_ulsPaginacao" role="navigation" class="paginacao">${pager}</ul></body></html>`;
}

interface DetailFields {
  title?: string;
  category?: string;
  dates?: string;
  time?: string;
  local?: string | null;
}

/** A detail page with the same span ids as the fixture. */
function detailHtml(f: DetailFields = {}): string {
  const local = f.local === undefined ? "Lugar Fictício | Rua Inventada, 1" : f.local;
  return `<html><head><meta charset="utf-8" /></head><body>
<span id="cphMasterPortal_lblCategoriaEvento" class="categoria categoriaMaior">${f.category ?? "Lazer"}</span>
<h2><span id="cphMasterPortal_lblTitulo">${f.title ?? "Evento Sintético"}</span></h2>
<span id="cphMasterPortal_lblDescricao"><p><span>DESCRIPTION-SENTINEL</span></p></span>
<div class="infoEvento">
<p>Data(s): <span id="cphMasterPortal_lblDatas">${f.dates ?? "21/11/2026"}</span></p>
<p>Horário: <span id="cphMasterPortal_lblHorario">${f.time ?? "20h."}</span></p>
${local === null ? "" : `<p>Local: <span id="cphMasterPortal_lblLocal">${local}</span></p>`}
<p>Site: <a id="cphMasterPortal_hlkSite" href="https://external.example/x">x</a></p>
</div></body></html>`;
}

describe("time and dates", () => {
  it("allows requests only from 02:00 to 05:49 UTC", () => {
    expect(inWindow(new Date("2026-11-21T01:59:59Z"))).toBe(false);
    expect(inWindow(new Date("2026-11-21T02:00:00Z"))).toBe(true);
    expect(inWindow(new Date("2026-11-21T05:49:59Z"))).toBe(true);
    expect(inWindow(new Date("2026-11-21T05:50:00Z"))).toBe(false);
    expect(inWindow(new Date("2026-11-21T14:00:00Z"))).toBe(false);
  });

  it("uses Curitiba's date: 23:30 local on the 20th is 02:30Z on the 21st", () => {
    expect(curitibaDate(new Date("2026-11-21T02:30:00Z"))).toBe("2026-11-20");
    expect(curitibaDate(new Date("2026-11-21T02:59:59Z"))).toBe("2026-11-20");
    expect(curitibaDate(new Date("2026-11-21T03:00:00Z"))).toBe("2026-11-21");
    expect(listPath(curitibaDate(new Date("2026-11-21T02:30:00Z")), 1)).toBe("/eventos/20-11-2026/1");
    expect(listPath("2026-01-05", 3)).toBe("/eventos/05-01-2026/3");
  });

  it("reads every calendar-valid DD/MM/YYYY date, sorted", () => {
    expect(parseDates("22/11/2026 a 23/11/2026")).toEqual(["2026-11-22", "2026-11-23"]);
    expect(parseDates("30/11/2026, 01/12/2026 e 28/11/2026")).toEqual(["2026-11-28", "2026-11-30", "2026-12-01"]);
    expect(parseDates("31/02/2026 e 10/13/2026")).toEqual([]);
    expect(parseDates("Todos os sábados")).toEqual([]);
  });
});

describe("robots.txt", () => {
  it("matches wildcards from the start of the path; *.asp matches any path containing .asp", () => {
    expect(robotsPatternMatches("*.asp", "/a/b/page.asp")).toBe(true);
    expect(robotsPatternMatches("*.asp", "/page.aspx")).toBe(true); // contains ".asp"
    expect(robotsPatternMatches("*.asp", "/x.asp/y")).toBe(true);
    expect(robotsPatternMatches("*.asp", "/eventos/21-11-2026/1")).toBe(false);
    expect(robotsPatternMatches("/bin", "/bin/x")).toBe(true);
    expect(robotsPatternMatches("/bin", "/binary")).toBe(true); // prefix match, as robots.txt defines it
    expect(robotsPatternMatches("/bin", "/a/bin")).toBe(false);
    expect(robotsPatternMatches("bin", "/bin")).toBe(false);
    expect(robotsPatternMatches("/*.pdf$", "/a.pdf")).toBe(true);
    expect(robotsPatternMatches("/*.pdf$", "/a.pdf.html")).toBe(false);
    expect(robotsPatternMatches("/a.b", "/axb")).toBe(false); // "." is literal
  });

  it("applies the longest match, Allow winning ties", () => {
    const g = robotsGroupFor(parseRobots(ROBOTS))!;
    expect(robotsAllows(g, "/page.asp")).toBe(false);
    expect(robotsAllows(g, "/page.aspx")).toBe(true); // Allow *.aspx is longer than Disallow *.asp
    expect(robotsAllows(g, "/Imagem/1.png")).toBe(false);
    expect(robotsAllows(g, "/doc.pdf")).toBe(false);
    expect(robotsAllows(g, "/eventos/21-11-2026/1")).toBe(true);
    expect(robotsAllows(g, "/evento/feira-ficticia/9001")).toBe(true);
    expect(robotsAllows({ allow: ["/a"], disallow: ["/a"] }, "/a")).toBe(true);
  });

  it("accepts only the recorded Disallow, Visit-time and Request-rate", () => {
    expect(robotsMatchesRecorded(robotsGroupFor(parseRobots(ROBOTS)))).toBe(true);
    expect(robotsMatchesRecorded(robotsGroupFor(parseRobots(ROBOTS.replace(/\n/g, "\r\n") + "# comment\n")))).toBe(true);
    const changed = [
      ROBOTS.replace("Request-rate: 1/5", "Request-rate: 1/10"),
      ROBOTS.replace("Visit-time: 0200-0600", "Visit-time: 0300-0500"),
      ROBOTS.replace("Disallow: /bin\n", ""),
      ROBOTS + "Disallow: /eventos\n",
      ROBOTS.replace("Visit-time: 0200-0600\n", ""),
      ROBOTS + "\nUser-agent: curitibai-mcp\nDisallow: /\n", // a group naming this script takes over
      "User-agent: *\nDisallow: /\n",
      "",
    ];
    for (const text of changed) expect({ text, ok: robotsMatchesRecorded(robotsGroupFor(parseRobots(text))) }).toMatchObject({ ok: false });
  });
});

describe("parsing", () => {
  it("reads ids and slugs from the list page and the pager's highest page number", () => {
    expect(parseListPage(LIST, "2026-11-21")).toEqual({
      items: [
        { id: 9001, slug: "feira-ficticia-de-exemplo" },
        { id: 9002, slug: "concerto-inventado" },
        { id: 9003, slug: "congresso-imaginario" },
      ],
      maxPage: 2,
      noEvents: false,
    });
    expect(parseListPage(listHtml([], 10), "2026-11-21").maxPage).toBe(10);
    expect(() => parseListPage(listHtml([], 11), "2026-11-21")).toThrow("layout_changed"); // never a partial file
  });

  it("stops with layout_changed when the list page is not the expected one", () => {
    const bad = [
      LIST.replace('value="21-11-2026"', 'value="22-11-2026"'), // another date
      LIST.replace('id="cphMasterPortal_txtFiltroDataInicio"', ""), // no date filter
      LIST.replace('href="/evento/concerto-inventado/9002"', 'href="https://evil.example/evento/x/9002"'),
      LIST.replace('href="/evento/concerto-inventado/9002"', 'href="/evento/Concerto_Inventado/9002"'),
      LIST.replace('href="/evento/concerto-inventado/9002"', 'href="/evento/concerto-inventado/0"'),
    ];
    for (const html of bad) expect(() => parseListPage(html, "2026-11-21")).toThrow("layout_changed");
  });

  it("keeps only the known fields of a detail page, decoded, with the link built from slug and id", () => {
    const e = parseDetailPage(DETAIL, { id: 9002, slug: "concerto-inventado" });
    expect(e).toEqual({
      id: 9002,
      title: "Concerto Inventado | Edição Teste",
      start_date: "2026-11-22",
      end_date: "2026-11-23",
      time: "10h30.",
      place: "Teatro Imaginário",
      address: "Rua Exemplo, 100, Centro",
      category: "Geral",
      link: "https://turismo.curitiba.pr.gov.br/evento/concerto-inventado/9002",
    });
    const text = JSON.stringify(e);
    for (const s of ["SENTINEL", "produtora", "3333", "external.example", "Livre", "imagem"]) expect(text).not.toContain(s);
    expect(validEvent(e)).toBe(true);
  });

  it("splits place and address only at the first ' | ', and allows a missing place", () => {
    const one = parseDetailPage(detailHtml({ local: "Praça A | Rua B | Fundos" }), { id: 1, slug: "a" });
    expect([one.place, one.address]).toEqual(["Praça A", "Rua B | Fundos"]);
    const none = parseDetailPage(detailHtml({ local: null }), { id: 1, slug: "a" });
    expect([none.place, none.address]).toEqual(["", ""]);
  });

  it("strips control and format characters (bidi, zero width, tags), applies NFC, masks PII and caps at 120", () => {
    const e = parseDetailPage(
      detailHtml({
        title: `Show\u202E\u2066 X\u200B\u{E0049}\u{E0047}\u0007 Cafe\u0301 tel (41) 3333-4444 ${"y".repeat(200)}`,
        local: `Casa\u200F de maria@example.com | Rua 1, 123.456.789-09`,
      }),
      { id: 7, slug: "show-x" },
    );
    expect(e.title.startsWith("Show X Café tel [masked] y")).toBe(true);
    expect([...e.title]).toHaveLength(120);
    expect(e.title.endsWith("…")).toBe(true);
    expect(e.title).not.toMatch(/[\p{Cc}\p{Cf}]/u);
    expect(e.place).toBe("Casa de [masked]");
    expect(e.address).toBe("Rua 1, [masked]");
  });

  it("stops with layout_changed on missing, repeated or nested known fields, or no valid date", () => {
    const base = detailHtml();
    const bad = [
      base.replace('id="cphMasterPortal_lblTitulo"', 'id="x"'),
      base.replace('<span id="cphMasterPortal_lblHorario">', '<span id="cphMasterPortal_lblHorario">a</span><span id="cphMasterPortal_lblHorario">'),
      detailHtml({ title: "<b>x</b>" }),
      detailHtml({ title: "   " }),
      detailHtml({ dates: "todo sábado" }),
      base.replace('<span id="cphMasterPortal_lblDatas">', '<span id="cphMasterPortal_lblDatas2">'),
    ];
    for (const html of bad) expect(() => parseDetailPage(html, { id: 1, slug: "a" })).toThrow("layout_changed");
  });

  it("decodes with the declared charset (header, then meta) and refuses unknown ones", () => {
    const latin = Buffer.from("<p>Feira de Inverno \xe9</p>", "latin1");
    expect(decodeBody("text/html; charset=ISO-8859-1", latin)).toContain("Inverno é");
    expect(decodeBody("text/html", Buffer.from('<meta charset="iso-8859-1"><p>\xe7</p>', "latin1"))).toContain("ç");
    expect(decodeBody("text/html; charset=utf-8", Buffer.from("ação"))).toContain("ação");
    expect(() => decodeBody("text/html", Buffer.from("<p>x</p>"))).toThrow("layout_changed");
    expect(() => decodeBody("text/html; charset=shift_jis", Buffer.from("x"))).toThrow("layout_changed");
    expect(() => decodeBody("text/html; charset=utf-8", latin)).toThrow("layout_changed");
  });
});

// ---------- whole runs, with a fake clock and a fake network ----------

let root: string;
let dataDir: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-events-")));
  dataDir = join(root, "data");
  mkdirSync(dataDir);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

interface FakeRoute {
  status?: number;
  body?: string;
  contentType?: string;
  headers?: Record<string, string>;
}

interface Harness {
  deps: RunDeps;
  calls: { url: string; at: number; init: RequestInit }[];
  lines: string[];
  clock: { t: number };
}

function harness(routes: Record<string, FakeRoute | (() => FakeRoute)>, start = "2026-11-21T05:00:00Z", latencyMs = 200): Harness {
  const clock = { t: Date.parse(start) };
  const calls: Harness["calls"] = [];
  const lines: string[] = [];
  const deps: RunDeps = {
    now: () => new Date(clock.t),
    sleep: async (ms) => {
      clock.t += ms;
    },
    env: { CURITIBAI_DATA_DIR: dataDir },
    log: (line) => lines.push(line),
    fetch: async (url, init) => {
      calls.push({ url, at: clock.t, init });
      clock.t += latencyMs;
      const r = routes[url];
      if (r === undefined) throw new Error(`unexpected request in test: ${url}`);
      const route = typeof r === "function" ? r() : r;
      return new Response(route.body ?? "", {
        status: route.status ?? 200,
        headers: { "content-type": route.contentType ?? "text/html; charset=utf-8", ...(route.headers ?? {}) },
      });
    },
  };
  return { deps, calls, lines, clock };
}

const ids = (n: number, from = 100) => Array.from({ length: n }, (_, i) => ({ id: from + i, slug: `evento-sintetico-${from + i}` }));

/** Robots, `pages` list pages for 21-11-2026 and a detail page for every listed id. */
function siteRoutes(pages: { id: number; slug: string }[][]): Record<string, FakeRoute> {
  const routes: Record<string, FakeRoute> = {
    [`${ORIGIN}/robots.txt`]: { body: ROBOTS, contentType: "text/plain" },
  };
  pages.forEach((items, i) => {
    routes[`${ORIGIN}/eventos/21-11-2026/${i + 1}`] = { body: listHtml(items, pages.length) };
    for (const it of items) routes[`${ORIGIN}/evento/${it.slug}/${it.id}`] = { body: detailHtml({ title: `Evento ${it.id}` }) };
  });
  return routes;
}

const eventsFile = () => join(dataDir, "events", "events.json");
const statusFile = () => join(dataDir, "events", "status.json");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

describe("run", () => {
  it("fetches robots first, then the list pages and the details, politely, and writes both files", async () => {
    const h = harness(siteRoutes([ids(3, 100), ids(2, 200)]));
    const res = await run(h.deps);
    expect(res).toMatchObject({ code: "ok", exit: 0, counts: { pages: 2, listed: 5, fetched: 5, cached: 0, events: 5 } });
    expect(h.calls.map((c) => c.url.replace(ORIGIN, ""))).toEqual([
      "/robots.txt",
      "/eventos/21-11-2026/1",
      "/eventos/21-11-2026/2",
      "/evento/evento-sintetico-100/100",
      "/evento/evento-sintetico-101/101",
      "/evento/evento-sintetico-102/102",
      "/evento/evento-sintetico-200/200",
      "/evento/evento-sintetico-201/201",
    ]);
    for (const [i, c] of h.calls.entries()) {
      expect(new Headers(c.init.headers).get("user-agent")).toBe(USER_AGENT);
      expect(c.init.method).toBe("GET");
      expect(c.init.redirect).toBe("manual");
      if (i > 0) expect(c.at - h.calls[i - 1]!.at).toBeGreaterThanOrEqual(GAP_MS);
    }
    const doc = readJson(eventsFile());
    expect(doc).toMatchObject({ format: 1, list_date: "2026-11-21", count: 5, checked_at: expect.any(String) });
    expect(doc.events.map((e: { id: number }) => e.id)).toEqual([100, 101, 102, 200, 201]);
    expect(doc.events.every(validEvent)).toBe(true);
    expect(readJson(statusFile())).toMatchObject({ code: "ok", attempt: "2026-11-21T05:00:00.000Z", success: expect.any(String) });
    expect(readdirSync(join(dataDir, "events")).sort()).toEqual(["events.json", "status.json"]); // no temp file left
  });

  it("prints only fixed status lines and counts, never page text", async () => {
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/evento/evento-sintetico-100/100`] = { body: detailHtml({ title: "TITLE-SENTINEL" }) };
    const h = harness(routes);
    await run(h.deps);
    expect(h.lines).toEqual([
      "fetch-events: code=ok",
      "fetch-events: pages=1 listed=3 details_fetched=3 details_cached=0 events=3",
      "fetch-events: exit=0",
    ]);
    const failing = harness({ ...routes, [`${ORIGIN}/eventos/21-11-2026/1`]: { body: "<html>PAGE-SENTINEL</html>" } });
    await run(failing.deps);
    expect(failing.lines.join("\n")).not.toMatch(/SENTINEL|<|html/i);
    for (const line of [...h.lines, ...failing.lines]) {
      expect(line).toMatch(/^fetch-events: (code=[a-z_]+( http_status=\d+)?|pages=\d+ listed=\d+ details_fetched=\d+ details_cached=\d+ events=\d+|exit=\d)$/);
    }
  });

  it("reads details only for new ids, reusing the previous file's records", async () => {
    await run(harness(siteRoutes([ids(3, 100)])).deps);
    // The next day: same three ids plus one new one, on the list for 22-11-2026.
    const routes = siteRoutes([ids(4, 100)]);
    const next = harness(
      Object.fromEntries(
        Object.entries(routes).map(([k, v]) => [k.replace("21-11-2026", "22-11-2026"), { ...v, body: v.body?.replaceAll("21-11-2026", "22-11-2026") }]),
      ),
      "2026-11-22T05:00:00Z",
    );
    const res = await run(next.deps);
    expect(res.counts).toMatchObject({ listed: 4, fetched: 1, cached: 3, events: 4 });
    expect(next.calls.filter((c) => c.url.includes("/evento/")).map((c) => c.url)).toEqual([`${ORIGIN}/evento/evento-sintetico-103/103`]);
    expect(readJson(eventsFile()).list_date).toBe("2026-11-22");
  });

  it("never requests anything outside the window and keeps the old file", async () => {
    await run(harness(siteRoutes([ids(3)])).deps);
    const before = readFileSync(eventsFile(), "utf8");
    for (const at of ["2026-11-21T05:50:00Z", "2026-11-21T01:59:00Z", "2026-11-21T15:00:00Z"]) {
      const h = harness(siteRoutes([ids(3)]), at);
      expect(await run(h.deps)).toMatchObject({ code: "window_closed", exit: 1 });
      expect(h.calls).toEqual([]);
    }
    expect(readFileSync(eventsFile(), "utf8")).toBe(before);
    expect(readJson(statusFile())).toMatchObject({ code: "window_closed", success: expect.any(String) });
  });

  it("checks the window before every request: closing mid-run stops it and keeps the old file", async () => {
    await run(harness(siteRoutes([ids(3)])).deps);
    const before = readFileSync(eventsFile(), "utf8");
    const h = harness(siteRoutes([ids(30)]), "2026-11-21T05:49:00Z");
    const res = await run(h.deps);
    expect(res.code).toBe("window_closed");
    expect(h.calls.length).toBeGreaterThan(0);
    for (const c of h.calls) expect(inWindow(new Date(c.at))).toBe(true);
    expect(readFileSync(eventsFile(), "utf8")).toBe(before);
  });

  it("stops at the 10-minute deadline", async () => {
    const routes = siteRoutes([ids(10, 100), ids(10, 200), ids(10, 300), ids(10, 400), ids(10, 500), ids(10, 600), ids(10, 700), ids(10, 800), ids(10, 900), ids(10, 1000)]);
    const h = harness(routes, "2026-11-21T03:00:00Z", 2_000); // 111 requests at 7 s each would take about 13 minutes
    const res = await run(h.deps);
    expect(res.code).toBe("deadline");
    expect(h.calls.length).toBeGreaterThan(50);
    for (const c of h.calls) expect(c.at - Date.parse("2026-11-21T03:00:00Z")).toBeLessThan(DEADLINE_MS);
    expect(existsSync(eventsFile())).toBe(false);
  });

  it.each([403, 429, 500, 503, 404])("stops on HTTP %i without retrying and keeps the old file", async (status) => {
    await run(harness(siteRoutes([ids(3)])).deps);
    const before = readFileSync(eventsFile(), "utf8");
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/eventos/21-11-2026/1`] = { status, body: "x" };
    const h = harness(routes, "2026-11-21T03:30:00Z");
    const res = await run(h.deps);
    expect(res).toMatchObject({ code: "http_error", exit: 1 });
    expect(h.calls.map((c) => c.url)).toEqual([`${ORIGIN}/robots.txt`, `${ORIGIN}/eventos/21-11-2026/1`]);
    expect(h.lines[0]).toBe(`fetch-events: code=http_error http_status=${status}`);
    expect(readFileSync(eventsFile(), "utf8")).toBe(before);
    expect(readJson(statusFile())).toMatchObject({ code: "http_error", http_status: status });
  });

  it("follows no redirect, same host or not", async () => {
    for (const location of ["https://evil.example/eventos/21-11-2026/1", `${ORIGIN}/eventos/21-11-2026/9`]) {
      const routes = siteRoutes([ids(3)]);
      routes[`${ORIGIN}/eventos/21-11-2026/1`] = { status: 302, headers: { location } };
      const h = harness(routes);
      expect((await run(h.deps)).code).toBe("redirect");
      expect(h.calls).toHaveLength(2);
    }
  });

  it("aborts before any page when robots.txt changed", async () => {
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/robots.txt`] = { body: ROBOTS.replace("1/5", "1/30"), contentType: "text/plain" };
    const h = harness(routes);
    expect(await run(h.deps)).toMatchObject({ code: "robots_changed", exit: 1 });
    expect(h.calls).toHaveLength(1);
  });

  it("refuses pages over the size caps", async () => {
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/eventos/21-11-2026/1`] = { body: listHtml(ids(3)) + " ".repeat(512 * 1024) };
    expect((await run(harness(routes).deps)).code).toBe("too_large");
    const detail = siteRoutes([ids(3)]);
    detail[`${ORIGIN}/evento/evento-sintetico-100/100`] = { body: detailHtml() + " ".repeat(256 * 1024) };
    expect((await run(harness(detail).deps)).code).toBe("too_large");
  });

  it("keeps the old file when a page fails to parse, with code layout_changed", async () => {
    await run(harness(siteRoutes([ids(3)])).deps);
    const before = readFileSync(eventsFile(), "utf8");
    // 101 and 102 come from the cache; the new id 103 has a detail page without the title field.
    const fresh = siteRoutes([ids(3, 101)]);
    fresh[`${ORIGIN}/evento/evento-sintetico-103/103`] = { body: detailHtml().replace("lblTitulo", "lblNome") };
    const res = await run(harness(fresh, "2026-11-21T04:00:00Z").deps);
    expect(res).toMatchObject({ code: "layout_changed", exit: 1 });
    expect(readFileSync(eventsFile(), "utf8")).toBe(before);
    expect(readJson(statusFile()).code).toBe("layout_changed");
  });

  it("treats 0 events (no marker known) and counts outside 0.3x–3x of the previous file as a layout change", async () => {
    const empty = siteRoutes([[]]);
    expect((await run(harness(empty).deps)).code).toBe("layout_changed");
    expect(existsSync(eventsFile())).toBe(false);

    await run(harness(siteRoutes([ids(10)])).deps);
    const before = readFileSync(eventsFile(), "utf8");
    expect((await run(harness(siteRoutes([ids(2, 100)])).deps)).code).toBe("layout_changed"); // 0.2x
    expect((await run(harness(siteRoutes([ids(10, 100), ids(10, 200), ids(10, 300), ids(1, 400)])).deps)).code).toBe("layout_changed"); // 3.1x
    expect(readFileSync(eventsFile(), "utf8")).toBe(before);
    expect((await run(harness(siteRoutes([ids(3, 100)])).deps)).code).toBe("ok"); // 0.3x
  });

  it("exits 2 without any request when CURITIBAI_DATA_DIR is not set", async () => {
    const h = harness(siteRoutes([ids(3)]));
    h.deps.env = {};
    expect(await run(h.deps)).toMatchObject({ code: "data_dir_not_set", exit: 2 });
    expect(h.calls).toEqual([]);
  });

  it("writes only under CURITIBAI_DATA_DIR/events", async () => {
    writeFileSync(join(root, "outside.txt"), "x");
    mkdirSync(join(dataDir, "urbs"));
    writeFileSync(join(dataDir, "urbs", "keep.json"), "[]");
    const snapshot = () =>
      readdirSync(root, { recursive: true, encoding: "utf8" })
        .filter((p) => !p.startsWith(join("data", "events")))
        .sort()
        .map((p) => [p, existsSync(join(root, p)) && !p.endsWith("urbs") && !p.endsWith("data") ? readFileSync(join(root, p), "utf8") : ""]);
    const before = snapshot();
    expect((await run(harness(siteRoutes([ids(3)])).deps)).code).toBe("ok");
    expect(snapshot()).toEqual(before);
    expect(readdirSync(join(dataDir, "events")).sort()).toEqual(["events.json", "status.json"]);
  });

  it("replaces a symlinked events.json with a file instead of writing through it", async () => {
    mkdirSync(join(dataDir, "events"));
    writeFileSync(join(root, "target.json"), "untouched");
    symlinkSync(join(root, "target.json"), join(dataDir, "events", "events.json"));
    expect((await run(harness(siteRoutes([ids(3)])).deps)).code).toBe("ok");
    expect(readFileSync(join(root, "target.json"), "utf8")).toBe("untouched");
    expect(readJson(eventsFile()).count).toBe(3);
  });

  it("refuses an events folder that is a symlink out of the data folder", async () => {
    mkdirSync(join(root, "elsewhere"));
    symlinkSync(join(root, "elsewhere"), join(dataDir, "events"));
    const h = harness(siteRoutes([ids(3)]));
    expect((await run(h.deps)).code).toBe("write_failed");
    expect(h.calls).toEqual([]);
    expect(readdirSync(join(root, "elsewhere"))).toEqual([]);
  });
});
