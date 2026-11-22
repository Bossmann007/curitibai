import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PhonesStatus } from "../src/tools/usefulPhones.js";
import {
  acquireLock,
  CACHE_FILE,
  curitibaDate,
  decodeBody,
  DEADLINE_MS,
  GAP_MS,
  inWindow,
  listPath,
  LOCK_FILE,
  needsDetail,
  parseDates,
  parseDetailPage,
  parseListPage,
  parsePhonesPage,
  parseRobots,
  PHONES_PATH,
  politeGapMs,
  RECORDED_ROBOTS,
  readCache,
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
// Trimmed from the real page read on 2026-11-22 (public organ and company numbers only; see docs/sources.md).
const PHONES = fixture("useful_phones/telefones_uteis_trimmed.html");
const ORIGIN = "https://turismo.curitiba.pr.gov.br";

// Same directives as the recorded group, in the live file's shape: CRLF, comments after tabs with Latin-1 bytes, no
// charset in Content-Type and no final newline (the comments here are invented).
const ROBOTS = [
  "User-agent: *",
  "Request-rate: 1/5\t\t# no m\u00e1ximo uma p\u00e1gina a cada 5 s",
  "Visit-time: 0200-0600\t# s\u00f3 entre 2:00 e 6:00 UT",
  "Disallow: /App_Browsers",
  "Disallow: /App_Themes",
  "Disallow: /bin",
  "Disallow: /Cache",
  "Disallow: /Imagem",
  "Disallow: /Include",
  "Disallow: *.mdb",
  "Disallow: *.pdf",
  "Disallow: *.dll",
  "Disallow: *.log",
  "Disallow: *.asp",
  "Disallow: *.config",
  "Disallow: *.jpg",
  "Disallow: *.gif",
  "Disallow: *.ascx",
  "Allow: *.aspx",
  "Allow: *.html",
  "Allow: *.htm",
  "Disallow: /es/contenido/*/categoria/*/conteudos/*",
].join("\r\n");
const robotsBytes = (text: string) => Buffer.from(text, "latin1");
const group = (text: string) => robotsGroupFor(parseRobots(text));

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
    const g = group(ROBOTS)!;
    expect(robotsAllows(g, "/page.asp")).toBe(false);
    expect(robotsAllows(g, "/page.aspx")).toBe(true); // Allow *.aspx is longer than Disallow *.asp
    expect(robotsAllows(g, "/Imagem/1.png")).toBe(false);
    expect(robotsAllows(g, "/doc.pdf")).toBe(false);
    expect(robotsAllows(g, "/es/contenido/1/categoria/2/conteudos/3")).toBe(false);
    expect(robotsAllows({ allow: ["/a"], disallow: ["/a"] }, "/a")).toBe(true);
  });

  it("allows the list and event page paths under the whole recorded group", () => {
    const g = group(ROBOTS)!;
    for (const path of ["/eventos/21-11-2026/1", "/eventos/01-01-2027/10", "/evento/feira-ficticia/9001", "/evento/a-b-c-1/1"]) {
      expect({ path, ok: robotsAllows(g, path) }).toEqual({ path, ok: true });
    }
  });

  it("reads the live file's shape: CRLF, tab-separated Latin-1 comments, no final newline", () => {
    const text = new TextDecoder("windows-1252").decode(robotsBytes(ROBOTS));
    expect(group(text)!.lines).toEqual([...RECORDED_ROBOTS]);
    expect(robotsMatchesRecorded(group(text))).toBe(true);
    expect(robotsMatchesRecorded(group(ROBOTS.replace(/\r\n/g, "\n") + "\n# comment\n"))).toBe(true);
    expect(robotsMatchesRecorded(group(`\uFEFF${ROBOTS}`))).toBe(true); // a byte order mark, decoded as UTF-8
    expect(robotsMatchesRecorded(group(`\u00EF\u00BB\u00BF${ROBOTS}`))).toBe(true); // or as Windows-1252
    expect(robotsMatchesRecorded(group([...ROBOTS.split("\r\n")].reverse().join("\n")))).toBe(false); // agent line last
    expect(robotsMatchesRecorded(group(["User-agent: *", ...ROBOTS.split("\r\n").slice(1).reverse()].join("\n")))).toBe(true); // order ignored
  });

  it("compares the whole group: any added, removed or changed directive is a change", () => {
    const changed = [
      ROBOTS.replace("Request-rate: 1/5", "Request-rate: 1/10"),
      ROBOTS.replace("Visit-time: 0200-0600", "Visit-time: 0300-0500"),
      ROBOTS.replace("Disallow: /bin\r\n", ""),
      ROBOTS.replace("Allow: *.html\r\n", ""), // a removed Allow
      ROBOTS + "\r\nAllow: /eventos", // an added Allow
      ROBOTS + "\r\nCrawl-delay: 10", // an added Crawl-delay
      ROBOTS + "\r\nCrawl-delay: 1", // even a shorter one
      ROBOTS + "\r\nDisallow: /eventos",
      ROBOTS + "\r\nDisallow:", // an empty Disallow is still a new directive
      ROBOTS + "\r\nDisallow: /bin", // a repeated directive
      ROBOTS + "\r\nSitemap: https://turismo.curitiba.pr.gov.br/sitemap.xml",
      ROBOTS + "\r\nNoindex: /x", // an unknown key
      ROBOTS.replace("Disallow: *.pdf", "Disallow: *.PDF"),
      ROBOTS.replace("Visit-time: 0200-0600\t# s\u00f3 entre 2:00 e 6:00 UT\r\n", ""),
      ROBOTS + "\r\n\r\nUser-agent: curitibai-mcp\r\nDisallow: /", // a group naming this script takes over
      "User-agent: *\nDisallow: /\n",
      "",
    ];
    for (const text of changed) expect({ text, ok: robotsMatchesRecorded(group(text)) }).toMatchObject({ ok: false });
  });

  it("waits the larger of 5 s and a recorded Crawl-delay or Request-rate", () => {
    expect(politeGapMs(group(ROBOTS)!)).toBe(GAP_MS);
    expect(politeGapMs({ lines: ["crawl-delay: 10"] })).toBe(10_000);
    expect(politeGapMs({ lines: ["crawl-delay: 2"] })).toBe(GAP_MS);
    expect(politeGapMs({ lines: ["crawl-delay: 7.5"] })).toBe(7_500);
    expect(politeGapMs({ lines: ["request-rate: 1/20"] })).toBe(20_000);
    expect(politeGapMs({ lines: ["request-rate: 1/1m"] })).toBe(60_000);
    expect(politeGapMs({ lines: ["request-rate: 2/5"] })).toBe(GAP_MS);
    expect(politeGapMs({ lines: ["crawl-delay: soon"] })).toBe(GAP_MS);
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
  body?: string | Uint8Array;
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
      return new Response(typeof route.body === "string" || route.body === undefined ? (route.body ?? "") : new Uint8Array(route.body), {
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
    [`${ORIGIN}/robots.txt`]: { body: robotsBytes(ROBOTS), contentType: "text/plain" },
    [`${ORIGIN}${PHONES_PATH}`]: { body: PHONES },
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
      "/conteudo/telefones-uteis/92",
    ]);
    expect(USER_AGENT).toBe("curitibai-mcp/0.10 (+https://github.com/Bossmann007/curitibai)");
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
    expect(readdirSync(join(dataDir, "events")).sort()).toEqual([CACHE_FILE, "events.json", "status.json"]); // no temp file or lock left
    expect(readdirSync(join(dataDir, "phones")).sort()).toEqual(["phones.json", "status.json"]);
    expect(res.phones).toEqual({ code: "ok", entries: 60, dropped: 0 });
  });

  it("facts only: neither events.json nor the detail cache keeps the event description (or any part of it)", async () => {
    await run(harness(siteRoutes([ids(2, 100)])).deps);
    for (const f of [eventsFile(), join(dataDir, "events", CACHE_FILE)]) {
      const text = readFileSync(f, "utf8");
      expect(text).not.toMatch(/DESCRIPTION-SENTINEL|descri/i);
    }
    for (const e of readJson(eventsFile()).events) {
      expect(Object.keys(e).sort()).toEqual(["address", "category", "end_date", "id", "link", "place", "start_date", "time", "title"]);
    }
  });

  it("prints only fixed status lines and counts, never page text", async () => {
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/evento/evento-sintetico-100/100`] = { body: detailHtml({ title: "TITLE-SENTINEL" }) };
    const h = harness(routes);
    await run(h.deps);
    expect(h.lines).toEqual([
      "fetch-events: code=ok",
      "fetch-events: pages=1 listed=3 details_fetched=3 details_cached=0 events=3",
      "fetch-events: phones_code=ok phones=60 phones_dropped=0",
      "fetch-events: exit=0",
    ]);
    const failing = harness({ ...routes, [`${ORIGIN}/eventos/21-11-2026/1`]: { body: "<html>PAGE-SENTINEL</html>" } });
    await run(failing.deps);
    expect(failing.lines.join("\n")).not.toMatch(/SENTINEL|<|html/i);
    for (const line of [...h.lines, ...failing.lines]) {
      expect(line).toMatch(/^fetch-events: (code=[a-z_]+( http_status=\d+)?|pages=\d+ listed=\d+ details_fetched=\d+ details_cached=\d+ events=\d+|phones_code=[a-z_]+( phones_http_status=\d+)? phones=\d+ phones_dropped=\d+|exit=\d)$/);
    }
  });

  it("reads details only for new ids, reusing the previous file's records", async () => {
    await run(harness(siteRoutes([ids(3, 100)])).deps);
    // The next day: same three ids plus one new one, on the list for 22-11-2026.
    const routes = siteRoutes([ids(4, 100)]);
    const next = harness(
      Object.fromEntries(
        Object.entries(routes).map(([k, v]) => [k.replace("21-11-2026", "22-11-2026"), { ...v, body: typeof v.body === "string" ? v.body.replaceAll("21-11-2026", "22-11-2026") : v.body }]),
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

  it("stops at the 30-minute deadline keeping the details read, and the next run reads only the rest", async () => {
    const pages = Array.from({ length: 10 }, (_, p) => ids(30, 100 * (p + 1))); // 300 events: 311 requests
    const start = Date.parse("2026-11-21T03:00:00Z");
    const h = harness(siteRoutes(pages), "2026-11-21T03:00:00Z", 1_000); // 6 s per request: about 31 minutes
    const res = await run(h.deps);
    expect(res.code).toBe("deadline");
    for (const c of h.calls) expect(c.at - start).toBeLessThan(DEADLINE_MS);
    expect(h.calls.length).toBeGreaterThan(250);
    expect(existsSync(eventsFile())).toBe(false);
    const kept = readCache(join(dataDir, "events"));
    expect(kept.size).toBe(res.counts.fetched);
    expect(kept.size).toBeGreaterThan(200);

    const next = harness(siteRoutes(pages), "2026-11-21T03:40:00Z");
    const done = await run(next.deps);
    expect(done).toMatchObject({ code: "ok", counts: { listed: 300, cached: kept.size, fetched: 300 - kept.size, events: 300 } });
    const detailCalls = next.calls.filter((c) => c.url.includes("/evento/")).map((c) => Number(c.url.split("/").pop()));
    expect(detailCalls).toHaveLength(300 - kept.size);
    for (const id of detailCalls) expect(kept.has(id)).toBe(false);
    expect(readJson(eventsFile()).count).toBe(300);
  });

  it("keeps the details read before a page fails, so the next run does not read them again", async () => {
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/evento/evento-sintetico-102/102`] = { status: 503, body: "x" };
    expect((await run(harness(routes).deps)).code).toBe("http_error");
    expect([...readCache(join(dataDir, "events")).keys()]).toEqual([100, 101]);
    const next = harness(siteRoutes([ids(3)]), "2026-11-21T05:20:00Z");
    expect((await run(next.deps)).counts).toMatchObject({ fetched: 1, cached: 2, events: 3 });
  });

  it("stores fetched_at per event in the cache and prunes ids no longer listed after a successful run", async () => {
    await run(harness(siteRoutes([ids(4, 100)])).deps);
    const cache = JSON.parse(readFileSync(join(dataDir, "events", CACHE_FILE), "utf8"));
    expect(cache.format).toBe(1);
    expect(cache.details).toHaveLength(4);
    for (const d of cache.details) expect(d).toEqual({ fetched_at: expect.stringMatching(/^2026-11-21T05:0\d:\d{2}\.\d{3}Z$/), event: expect.any(Object) });
    // events.json keeps exactly the tool's fields (its schema is strict): no fetched_at there.
    for (const e of readJson(eventsFile()).events) expect(Object.keys(e)).not.toContain("fetched_at");
    await run(harness(siteRoutes([ids(3, 101)]), "2026-11-21T05:30:00Z").deps);
    expect([...readCache(join(dataDir, "events")).keys()]).toEqual([101, 102, 103]);
  });

  it("ignores a corrupt, oversized or linked cache file and reads every detail again", async () => {
    const dir = join(dataDir, "events");
    mkdirSync(dir);
    for (const write of [
      () => writeFileSync(join(dir, CACHE_FILE), "{not json"),
      () => writeFileSync(join(dir, CACHE_FILE), JSON.stringify({ format: 1, details: [{ fetched_at: "yesterday", event: {} }] })),
      () => writeFileSync(join(dir, CACHE_FILE), " ".repeat(4 * 1024 * 1024 + 1)),
      () => {
        rmSync(join(dir, CACHE_FILE), { force: true });
        writeFileSync(join(root, "cache-target.json"), "{}");
        symlinkSync(join(root, "cache-target.json"), join(dir, CACHE_FILE));
      },
    ]) {
      write();
      expect(readCache(dir).size).toBe(0);
    }
    expect((await run(harness(siteRoutes([ids(3)])).deps)).counts).toMatchObject({ fetched: 3, cached: 0 });
    expect(readFileSync(join(root, "cache-target.json"), "utf8")).toBe("{}"); // the link was replaced, not written through
  });

  it("re-reads a detail older than 7 days or starting in the next 3 days, never one read under 20 hours ago", () => {
    const item = { id: 5, slug: "evento-cinco" };
    const at = (iso: string, start: string) => ({
      fetched_at: iso,
      event: { id: 5, title: "x", start_date: start, end_date: start, time: "", place: "", address: "", category: "x", link: `${ORIGIN}/evento/evento-cinco/5` },
    });
    const now = Date.parse("2026-11-21T03:00:00Z");
    const today = "2026-11-21";
    expect(needsDetail(undefined, item, today, now)).toBe(true);
    expect(needsDetail(at("2026-11-20T03:00:00.000Z", "2026-12-20"), item, today, now)).toBe(false); // 1 day, far away
    expect(needsDetail(at("2026-11-14T03:00:00.000Z", "2026-12-20"), item, today, now)).toBe(true); // 7 days
    expect(needsDetail(at("2026-11-14T03:00:01.000Z", "2026-12-20"), item, today, now)).toBe(false);
    expect(needsDetail(at("2026-11-20T03:00:00.000Z", "2026-11-21"), item, today, now)).toBe(true); // starts today
    expect(needsDetail(at("2026-11-20T03:00:00.000Z", "2026-11-24"), item, today, now)).toBe(true); // in 3 days
    expect(needsDetail(at("2026-11-20T03:00:00.000Z", "2026-11-25"), item, today, now)).toBe(false); // in 4 days
    expect(needsDetail(at("2026-11-20T03:00:00.000Z", "2026-11-20"), item, today, now)).toBe(false); // already started
    expect(needsDetail(at("2026-11-21T02:30:00.000Z", "2026-11-21"), item, today, now)).toBe(false); // read tonight
    expect(needsDetail(at("2026-11-21T04:00:00.000Z", "2026-12-20"), item, today, now)).toBe(true); // read "in the future"
    expect(needsDetail(at("2026-11-20T03:00:00.000Z", "2026-12-20"), { id: 5, slug: "outro-slug" }, today, now)).toBe(true);
  });

  it("re-reads stale and soon-starting details within the same 5 s gap", async () => {
    const routes = siteRoutes([ids(3)]);
    const cached = (id: number, fetchedAt: string, start: string) => ({
      fetched_at: fetchedAt,
      event: { id, title: `Evento ${id}`, start_date: start, end_date: start, time: "20h.", place: "", address: "", category: "Lazer", link: `${ORIGIN}/evento/evento-sintetico-${id}/${id}` },
    });
    mkdirSync(join(dataDir, "events"));
    const details = [
      cached(100, "2026-11-13T05:00:00.000Z", "2026-12-20"), // read 8 days ago: re-read
      cached(101, "2026-11-20T05:00:00.000Z", "2026-11-23"), // starts in 2 days: re-read
      cached(102, "2026-11-20T05:00:00.000Z", "2026-12-01"), // recent and far away: kept
    ];
    writeFileSync(join(dataDir, "events", CACHE_FILE), JSON.stringify({ format: 1, details }));
    expect(readCache(join(dataDir, "events")).size).toBe(3);
    const h = harness(routes);
    const res = await run(h.deps);
    expect(res.counts).toMatchObject({ fetched: 2, cached: 1, events: 3 });
    const reads = h.calls.filter((c) => c.url.includes("/evento/"));
    expect(reads.map((c) => c.url.replace(ORIGIN, ""))).toEqual(["/evento/evento-sintetico-100/100", "/evento/evento-sintetico-101/101"]);
    for (const [i, c] of h.calls.entries()) if (i > 0) expect(c.at - h.calls[i - 1]!.at).toBeGreaterThanOrEqual(GAP_MS);
    const after = readCache(join(dataDir, "events"));
    expect(after.get(100)!.fetched_at).toBe(new Date(reads[0]!.at + 200).toISOString());
    expect(after.get(101)!.event.start_date).toBe("2026-11-21"); // the page's current date replaced the cached one
    expect(after.get(102)!.fetched_at).toBe("2026-11-20T05:00:00.000Z");
  });

  it("honours a recorded Crawl-delay above 5 s between every request", async () => {
    const routes = siteRoutes([ids(2)]);
    routes[`${ORIGIN}/robots.txt`] = { body: robotsBytes(ROBOTS + "\r\nCrawl-delay: 12"), contentType: "text/plain" };
    expect((await run(harness(routes).deps)).code).toBe("robots_changed"); // not recorded: stop
    const h = harness(routes);
    h.deps.recordedRobots = [...RECORDED_ROBOTS, "crawl-delay: 12"];
    expect((await run(h.deps)).code).toBe("ok");
    expect(h.calls).toHaveLength(5); // robots, 1 list page, 2 details, the phones page
    for (const [i, c] of h.calls.entries()) if (i > 1) expect(c.at - h.calls[i - 1]!.at).toBeGreaterThanOrEqual(12_000 + 200);
  });

  it("never overlaps: a run finding a fresh lock makes no request and changes no file", async () => {
    await run(harness(siteRoutes([ids(3)])).deps);
    const dir = join(dataDir, "events");
    const files = () => Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), "utf8")]));
    const release = acquireLock(dir, new Date("2026-11-21T04:30:00Z"));
    const before = files();
    const h = harness(siteRoutes([ids(4)]), "2026-11-21T05:00:00Z"); // 30 minutes after the lock was taken
    expect(await run(h.deps)).toMatchObject({ code: "locked", exit: 1 });
    expect(h.calls).toEqual([]);
    expect(files()).toEqual(before); // events.json, status.json, cache and the other run's lock untouched
    expect(h.lines[0]).toBe("fetch-events: code=locked");
    release();
    expect(existsSync(join(dir, LOCK_FILE))).toBe(false);
    expect((await run(harness(siteRoutes([ids(4)])).deps)).code).toBe("ok");
  });

  it("takes over a lock left for an hour or more (by its start time, else its mtime) and removes its own lock", async () => {
    const dir = join(dataDir, "events");
    mkdirSync(dir);
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify({ started: "2026-11-21T04:00:00.000Z" }));
    expect((await run(harness(siteRoutes([ids(3)]), "2026-11-21T05:00:00Z").deps)).code).toBe("ok");
    expect(existsSync(join(dir, LOCK_FILE))).toBe(false);

    writeFileSync(join(dir, LOCK_FILE), JSON.stringify({ started: "2026-11-21T04:00:01.000Z" })); // 59:59 old
    expect((await run(harness(siteRoutes([ids(3)]), "2026-11-21T05:00:00Z").deps)).code).toBe("locked");
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify({ started: "2026-11-21T09:00:00.000Z" })); // in the future
    expect((await run(harness(siteRoutes([ids(3)]), "2026-11-21T05:00:00Z").deps)).code).toBe("locked");

    writeFileSync(join(dir, LOCK_FILE), ""); // a run that died between create and write
    utimesSync(join(dir, LOCK_FILE), new Date("2026-11-21T04:30:00Z"), new Date("2026-11-21T04:30:00Z"));
    expect((await run(harness(siteRoutes([ids(3)]), "2026-11-21T05:00:00Z").deps)).code).toBe("locked");
    utimesSync(join(dir, LOCK_FILE), new Date("2026-11-21T03:00:00Z"), new Date("2026-11-21T03:00:00Z"));
    expect((await run(harness(siteRoutes([ids(3)]), "2026-11-21T05:00:00Z").deps)).code).toBe("ok");
    expect(existsSync(join(dir, LOCK_FILE))).toBe(false);
    expect(readdirSync(dir).filter((f) => f.startsWith(LOCK_FILE))).toEqual([]); // no stale lock left aside
  });

  it("releases the lock on every exit path, and only its own", async () => {
    const dir = join(dataDir, "events");
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/eventos/21-11-2026/1`] = { status: 503, body: "x" };
    for (const [r, at] of [
      [routes, "2026-11-21T05:00:00Z"],
      [siteRoutes([ids(3)]), "2026-11-21T15:00:00Z"],
    ] as const) {
      await run(harness(r, at).deps);
      expect(existsSync(join(dir, LOCK_FILE))).toBe(false);
    }
    const release = acquireLock(dir, new Date("2026-11-21T05:00:00Z"));
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify({ started: "2026-11-21T05:00:00.000Z", token: "another run" }));
    release();
    expect(existsSync(join(dir, LOCK_FILE))).toBe(true);
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
    routes[`${ORIGIN}/robots.txt`] = { body: robotsBytes(ROBOTS.replace("1/5", "1/30")), contentType: "text/plain" };
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

  it("writes only under CURITIBAI_DATA_DIR/events and CURITIBAI_DATA_DIR/phones", async () => {
    writeFileSync(join(root, "outside.txt"), "x");
    mkdirSync(join(dataDir, "urbs"));
    writeFileSync(join(dataDir, "urbs", "keep.json"), "[]");
    const snapshot = () =>
      readdirSync(root, { recursive: true, encoding: "utf8" })
        .filter((p) => !p.startsWith(join("data", "events")) && !p.startsWith(join("data", "phones")))
        .sort()
        .map((p) => [p, existsSync(join(root, p)) && !p.endsWith("urbs") && !p.endsWith("data") ? readFileSync(join(root, p), "utf8") : ""]);
    const before = snapshot();
    expect((await run(harness(siteRoutes([ids(3)])).deps)).code).toBe("ok");
    expect(snapshot()).toEqual(before);
    expect(readdirSync(join(dataDir, "events")).sort()).toEqual([CACHE_FILE, "events.json", "status.json"]);
    expect(readdirSync(join(dataDir, "phones")).sort()).toEqual(["phones.json", "status.json"]);
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

// ---------- useful phones (fixture trimmed from the real page) ----------

const phonesFile = () => join(dataDir, "phones", "phones.json");
const phonesStatus = () => join(dataDir, "phones", "status.json");
const entry = (name: string) => parsePhonesPage(PHONES).entries.filter((e) => e.name === name);

describe("useful phones page", () => {
  it("reads 60 entries in 4 sections, numbers as published, with no person data dropped", () => {
    const { entries, dropped } = parsePhonesPage(PHONES);
    expect(entries).toHaveLength(60);
    expect(dropped).toBe(0);
    expect([...new Set(entries.map((e) => e.section))]).toEqual(["Emergências", "Serviços", "Transporte", "Centrais de Radiotáxi de Curitiba"]);
    for (const e of entries) expect(Object.keys(e).sort()).toEqual(["name", "numbers", "section"]);
    expect(entries[0]).toEqual({ section: "Emergências", name: "SIATE(ambulância/bombeiros)", numbers: ["193"] });
  });

  it("handles the page's hard lines exactly", () => {
    expect(entry("Juizado de Menores")[0]!.numbers).toEqual(["(41) 3222-7561"]); // number split across tags
    expect(entry("DETRAN")[0]!.numbers).toEqual(["(41) 3361-1212", "0800 6437373"]);
    expect(entry("COPEL(energia elétrica)")[0]!.numbers).toEqual(["0800 5100116"]);
    expect(entry("Associação Radiotáxi Faixa Vermelha")[0]!.numbers).toEqual(["0800-414141", "(41) 3262-6262", "3362-6262"]);
    expect(entry("Vacinação para viagens no aeroporto")[0]!.numbers).toEqual(["(41) 3381-1281", "3381-1515"]); // note dropped
    expect(entry("PREFEITURA MUNICIPAL (serviços) - Curitiba Turismo")[0]!.numbers).toEqual(["(41) 3250-7721", "3250-7724"]); // "Fax:"
    expect(entry("Disque Turismo Municipal")[0]!.numbers).toEqual(["156", "(41) 3350-6456"]);
    expect(entry("Remoções 24h - UTI Móvel / Aérea (Problemas com drogas/psiquiátricos)")[0]!.numbers).toEqual(["(41) 3257-3336"]);
    expect(entry("Operadoras Pedágio - ECOVIA")[0]).toEqual({ section: "Transporte", name: "Operadoras Pedágio - ECOVIA", numbers: ["0800 410277"] });
    expect(entry("Polícia Civil - Atendimento ao Turista: 12º Distrito Policial")[0]!.numbers).toEqual(["(41) 3370-1200"]);
    expect(entry("Aeroclube Bacacheri").map((e) => e.section)).toEqual(["Serviços", "Transporte"]); // listed twice
    // The address line (Avenida Manoel Ribas 6693) and the notes are not kept anywhere.
    expect(JSON.stringify(parsePhonesPage(PHONES))).not.toMatch(/6693|Manoel|postos de sa|demais cidades/);
  });

  it("stops with layout_changed on a changed layout instead of guessing", () => {
    const bad = [
      PHONES.replace('class="listaEdital"', 'class="listaConteudo"'), // block renamed
      PHONES.replace("Telefones Úteis</h2>", "Contatos</h2>"), // another page
      PHONES.replace("<strong>Emerg&ecirc;ncias :</strong>", ""), // entries before any section
      PHONES.replace("<strong>193</strong>", "<span>193</span>"), // an unknown tag
      PHONES.replace("3304-8000", "3304.8000"), // a number in an unknown format
      PHONES.replace("- Defesa Civil:", "- Defesa Civil 3350"), // digits left in a name
      PHONES.replace(/<p><strong>Servi[\s\S]*<\/div>/, "</address>"), // too few entries left
    ];
    for (const html of bad) expect(() => parsePhonesPage(html)).toThrow(expect.objectContaining({ code: "layout_changed" }));
  });

  it("drops an entry with a mobile number or a masked name and counts it", () => {
    const html = PHONES.replace("- Defesa Civil:&nbsp;<strong>199</strong>", "- Fulano de Tal:&nbsp;<strong>(41) 99999-8888</strong>");
    const { entries, dropped } = parsePhonesPage(html);
    expect(dropped).toBe(1);
    expect(entries).toHaveLength(59);
    expect(JSON.stringify(entries)).not.toMatch(/Fulano|99999/);
    const mail = parsePhonesPage(PHONES.replace("- Defesa Civil:", "- fulano@exemplo.com:"));
    expect(mail.dropped).toBe(1);
  });

  it("writes phones.json with the kept fields only, through the same polite client", async () => {
    const h = harness(siteRoutes([ids(2)]));
    const res = await run(h.deps);
    expect(res.phones.code).toBe("ok");
    const last = h.calls[h.calls.length - 1]!;
    expect(last.url).toBe(`${ORIGIN}${PHONES_PATH}`);
    expect(new Headers(last.init.headers).get("user-agent")).toBe(USER_AGENT);
    expect(last.at - h.calls[h.calls.length - 2]!.at).toBeGreaterThanOrEqual(GAP_MS);
    const doc = readJson(phonesFile());
    expect(doc).toMatchObject({ format: 1, source: `${ORIGIN}${PHONES_PATH}`, count: 60, dropped: 0, checked_at: expect.any(String) });
    expect(Object.keys(doc).sort()).toEqual(["checked_at", "count", "dropped", "entries", "format", "source"]);
    expect(readJson(phonesStatus())).toMatchObject({ code: "ok", success: expect.any(String) });
    expect(PhonesStatus.safeParse(readJson(phonesStatus())).success).toBe(true); // the shape useful_phones reads
  });

  it("keeps the previous copy and writes layout_changed when the page no longer matches", async () => {
    await run(harness(siteRoutes([ids(3)])).deps);
    const before = readFileSync(phonesFile(), "utf8");
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}${PHONES_PATH}`] = { body: PHONES.replace('class="listaEdital"', 'class="outra"') };
    const res = await run(harness(routes, "2026-11-21T04:00:00Z").deps);
    expect(res).toMatchObject({ code: "ok", exit: 1, phones: { code: "layout_changed" } });
    expect(readFileSync(phonesFile(), "utf8")).toBe(before);
    expect(readJson(phonesStatus())).toMatchObject({ code: "layout_changed", success: expect.any(String) });
    expect(PhonesStatus.safeParse(readJson(phonesStatus())).success).toBe(true); // the shape useful_phones reads
    expect(readJson(statusFile()).code).toBe("ok"); // the events step is not affected
  });

  it("reuses the window and robots checks: no phones request outside the window or after robots changed", async () => {
    const closed = harness(siteRoutes([ids(3)]), "2026-11-21T12:00:00Z");
    expect(await run(closed.deps)).toMatchObject({ code: "window_closed", phones: { code: "window_closed" } });
    expect(closed.calls).toEqual([]);
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/robots.txt`] = { body: robotsBytes(ROBOTS + "\r\nDisallow: /conteudo/"), contentType: "text/plain" };
    const changed = harness(routes);
    expect(await run(changed.deps)).toMatchObject({ code: "robots_changed", phones: { code: "robots_changed" } });
    expect(changed.calls.map((c) => c.url)).toEqual([`${ORIGIN}/robots.txt`]);
    expect(robotsAllows(group(ROBOTS)!, PHONES_PATH)).toBe(true);
  });

  it("after a refusal (403) the run stops: no phones request, the phones status gets the same code", async () => {
    await run(harness(siteRoutes([ids(3)])).deps);
    const before = readFileSync(phonesFile(), "utf8");
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/eventos/21-11-2026/1`] = { status: 403, body: "x" };
    const h = harness(routes, "2026-11-21T03:30:00Z");
    expect(await run(h.deps)).toMatchObject({ code: "http_error", exit: 1, phones: { code: "http_error", entries: 0 } });
    expect(h.calls.some((c) => c.url.endsWith(PHONES_PATH))).toBe(false);
    expect(readFileSync(phonesFile(), "utf8")).toBe(before);
    expect(readJson(phonesStatus())).toMatchObject({ code: "http_error", success: expect.any(String) });
    expect(PhonesStatus.safeParse(readJson(phonesStatus())).success).toBe(true); // the shape useful_phones reads
  });

  it("still reads the phones page when the events step ends with layout_changed, and not after the window closed", async () => {
    const routes = siteRoutes([ids(3)]);
    routes[`${ORIGIN}/eventos/21-11-2026/1`] = { body: "<html></html>" };
    const res = await run(harness(routes).deps);
    expect(res).toMatchObject({ code: "layout_changed", exit: 1, phones: { code: "ok", entries: 60 } });
    // Started at 05:49:50: the events pages run past 05:50, so the phones request is refused by the window check.
    const late = harness(siteRoutes([ids(3)]), "2026-11-21T05:49:50Z");
    const out = await run(late.deps);
    expect(out.phones.code).toBe("window_closed");
    expect(late.calls.some((c) => c.url.endsWith(PHONES_PATH))).toBe(false);
  });
});
