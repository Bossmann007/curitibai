import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheDetails,
  cachedDetails,
  CALENDAR_URL,
  DETAILS_CACHE_MAX,
  DETAILS_CACHE_TTL_MS,
  detailsCacheSize,
  getListing,
  isPathAllowed,
  NO_DETAILS,
  LayoutChangedError,
  listingPageUrl,
  parseEventPage,
  parseListingPage,
  parseRobots,
  readDetails,
  ROBOTS_URL,
} from "../src/sources/guaira.js";
import { guairaEventsOutput } from "../src/tools/guairaEvents.js";
import { connectClient, errorOf, fixture, stubFetch, type Route } from "./helpers.js";

const HTML = "text/html; charset=UTF-8";
const list = (n: number) => fixture(`guaira/list_page${n}.html`);
const ROBOTS = fixture("guaira/robots.txt");
const event = (slug: string) => `https://www.teatroguaira.pr.gov.br/Evento/${slug}`;
const MUITO = event("Muito-Barulho-por-Nada-Teatro-de-Comedia-do-Parana");
const MIA = event("Tudo-Acaba-Nada-Tem-Fim-Festival-Mia-Cara-11deg-Edicao");
const OSP = event("Concerto-da-Orquestra-Sinfonica-do-Parana-9");

const OTHERS = ["Cartografia-da-Memoria-Bale-Teatro-Guaira-em-Cascavel", "Jon-Secada-e-Marina-Elali", "Me-Conte-Uma-Fofoca", "Andrea-Vermont-Arte-de-viver", "Pelos-4-Elementos-Um-Jornada-Musical-Sobre-Vida"].map(event);
const JON = OTHERS[1]!;

function routes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    ...Object.fromEntries(OTHERS.map((l) => [`GET ${l}`, { body: fixture("guaira/event_concerto_osp.html"), contentType: HTML }])),
    [`GET ${ROBOTS_URL}`]: { body: ROBOTS, contentType: "text/plain" },
    [`GET ${listingPageUrl(0)}`]: { body: list(0), contentType: HTML },
    [`GET ${listingPageUrl(1)}`]: { body: list(1), contentType: HTML },
    [`GET ${listingPageUrl(2)}`]: { body: list(2), contentType: HTML },
    [`GET ${MUITO}`]: { body: fixture("guaira/event_muito_barulho.html"), contentType: HTML },
    [`GET ${OSP}`]: { body: fixture("guaira/event_concerto_osp.html"), contentType: HTML },
    // A real site page whose body field is missing: Drupal's settings script present, so not a WAF page.
    [`GET ${MIA}`]: { body: `<script data-drupal-selector="drupal-settings-json">{}</script>${fixture("guaira/event_concerto_osp.html").replace("field--name-field-texto", "x")}`, contentType: HTML },
    ...over,
  };
}

/** Calls the tool and lets fake time run until it answers (each request waits for its 5 s slot). */
async function call(args: Record<string, unknown>) {
  const client = await connectClient();
  const pending = client.callTool({ name: "guaira_events", arguments: args });
  await vi.advanceTimersByTimeAsync(30_000);
  return pending;
}

/** Loads the listing (robots.txt and 3 pages, 15 s of fake time) so a call's budget goes to event pages. */
async function warmListing() {
  const pending = getListing();
  await vi.advanceTimersByTimeAsync(20_000);
  await pending;
}

async function search(args: Record<string, unknown>) {
  const res = await call(args);
  expect(errorOf(res)).toBeUndefined();
  return guairaEventsOutput.parse(res.structuredContent);
}

const NOW = new Date("2026-11-22T12:00:00Z"); // 09:00 in Curitiba

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("robots.txt", () => {
  it("allows the calendar and event pages under the real file, and disallows its listed paths", () => {
    const rules = parseRobots(ROBOTS);
    expect(isPathAllowed(rules, "/calendario-eventos")).toBe(true);
    expect(isPathAllowed(rules, "/calendario-eventos?page=2")).toBe(true);
    expect(isPathAllowed(rules, "/Evento/O-Vazio")).toBe(true);
    expect(isPathAllowed(rules, "/search/x")).toBe(false);
    expect(isPathAllowed(rules, "/core/a.css")).toBe(true); // Allow: /core/*.css$ is longer than Disallow: /core/
    expect(isPathAllowed(rules, "/core/a.php")).toBe(false);
  });

  it("uses the group naming this server over *, with * and $ wildcards and the longest match", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: other\nUser-agent: curitibai-mcp\nDisallow: /cal*$\nAllow: /calendario-eventos$\n");
    expect(isPathAllowed(rules, "/calendario-eventos")).toBe(true);
    expect(isPathAllowed(rules, "/calendario-eventos?page=1")).toBe(false); // "$" ends the Allow; "/cal*$" matches
    expect(isPathAllowed(rules, "/other")).toBe(true);
    expect(isPathAllowed(parseRobots("User-agent: *\nDisallow:\n"), "/x")).toBe(true);
  });
});

describe("parseListingPage", () => {
  it("reads title, start, end, city and link from real cards, and the next-page link", () => {
    const p = parseListingPage(list(0), 0);
    expect(p.hasNext).toBe(true);
    expect(p.rows).toHaveLength(4);
    expect(p.rows[0]).toEqual({
      title: "Muito Barulho por Nada | Teatro de Comédia do Paraná",
      start: "2026-11-12T20:30",
      end: "2026-12-06T18:00",
      city: "Curitiba",
      state: "PR",
      link: MUITO,
    });
    expect(p.rows[1]!.title).toBe("\"Tudo Acaba, Nada Tem Fim\" | Festival Mia Cara 11° Edição");
    expect(p.rows[3]!.city).toBe("Cascavel");
    expect(parseListingPage(list(1), 1).hasNext).toBe(true);
    expect(parseListingPage(list(2), 2)).toMatchObject({ hasNext: false, rows: [{ start: "2027-02-20T20:00" }, { start: "2027-02-21T19:00" }] });
  });

  const broken: [string, (h: string) => string][] = [
    ["no view block", (h) => h.replace('<div class="view-content">', "<div>")],
    ["no cards", (h) => h.replace(/<li class="card/g, "<li class=\"item")],
    ["a card without its end", (h) => h.replace("Término: ", "Fim: ")],
    ["a card with two starts", (h) => h.replace("<p><strong>Término: </strong>06/12/2026", "<p><strong>Início: </strong>06/12/2026")],
    ["a date in another format", (h) => h.replace("12/11/2026 - 20:30", "2026-11-12 20:30")],
    ["a date that does not exist", (h) => h.replace("12/11/2026 - 20:30", "31/11/2026 - 20:30")],
    ["an end before the start", (h) => h.replace("06/12/2026 - 18:00", "01/11/2026 - 18:00")],
    ["markup inside a title", (h) => h.replace(">Muito Barulho", "><b>Muito</b> Barulho")],
    ["an odd event link", (h) => h.replaceAll("/Evento/O-Vazio", "/Evento/O_Vazio?x=1").replaceAll("/Evento/Muito-Barulho-por-Nada-Teatro-de-Comedia-do-Parana", "/node/1")],
    ["a city without a state", (h) => h.replace(/Curitiba-\s+PR/, "Curitiba")],
    ["a next link to another page", (h) => h.replace("page=1\"", "page=5\"")],
    ["a pager without the rel=\"next\" link", (h) => h.replace(' rel="next"', "")],
    ["a list inside a card", (h) => h.replace("<div class=\"content-card\">", "<div class=\"content-card\"><ul class=\"tags\"><li>Dança</li></ul>")],
  ];
  it("ignores markup after the card list, even an event link", () => {
    const html = list(0).replace("  </ul>", '  </ul><div class="destaques"><a href="/Evento/Outro">x</a><p><strong>Local:</strong> Curitiba- PR</p></div>');
    expect(parseListingPage(html, 0).rows).toHaveLength(4);
  });

  it.each(broken)("fails closed on %s", (_name, edit) => {
    const html = edit(list(0));
    expect(html).not.toBe(list(0));
    expect(() => parseListingPage(html, 0)).toThrow(LayoutChangedError);
  });
});

describe("parseEventPage", () => {
  it("reads venue, age rating and price from real event pages, strictly", () => {
    expect(parseEventPage(fixture("guaira/event_muito_barulho.html"))).toEqual({
      status: "read",
      venue: "Auditório Salvador de Ferrante (Guairinha)",
      age_rating: "14 anos",
      price: "R$20,00 (inteira) | R$10,00 (meia-entrada)",
    });
    expect(parseEventPage(fixture("guaira/event_concerto_osp.html"))).toEqual({
      status: "read",
      venue: "Auditório Bento Munhoz da Rocha Neto (Guairão)",
      age_rating: "7 anos",
      price: "R$20,00 (inteira) | R$10,00",
    });
  });

  it("leaves unknown shapes null, never guesses, and masks contacts", () => {
    const body = (inner: string) => `<div class="field field--name-field-texto"><p>${inner}</p></div>`;
    expect(parseEventPage(body("<strong>Ingressos: </strong>Consulte a bilheteria<br /><strong>Classificação etária:</strong> Consultar<br />"))).toEqual({
      status: "read",
      venue: null,
      age_rating: null,
      price: null,
    });
    expect(parseEventPage(body("<strong>Ingressos: </strong>Entrada franca. Retirar 1h antes<br /><strong>Classificação etária:</strong> Livre<br />"))).toMatchObject({
      price: "Entrada franca",
      age_rating: "Livre",
    });
    // A known prefix followed by anything else is not the whole value: null, never a part of it.
    for (const tickets of ["R$ 40,00 (inteira) / R$ 20,00 (meia)", "R$ 30,00 e R$ 15,00", "Gratuito para menores de 12 anos; R$ 20,00 demais", "Entrada franca, exceto sábado"]) {
      expect(parseEventPage(body(`<strong>Ingressos: </strong>${tickets}<br />`)).price).toBeNull();
    }
    expect(parseEventPage(body("<strong>Classificação etária:</strong> Livre para maiores de 16 anos<br />")).age_rating).toBeNull();
    // The rest of a value hidden behind an inline tag: null too.
    expect(parseEventPage(body("<strong>Ingressos:</strong> Gratuito <em>para menores de 12 anos</em>; R$ 20,00 demais<br/>")).price).toBeNull();
    expect(parseEventPage(body("<strong>Classificação etária:</strong> Livre <b>para maiores de 16</b><br />")).age_rating).toBeNull();
    expect(parseEventPage(body("<strong>Local:</strong> Teatro <em>Guaíra</em><br />")).venue).toBeNull();
    expect(parseEventPage(body("<strong>Ingressos:</strong> Gratuito.<strong>Ingressos:</strong> R$ 20,00<br/>")).price).toBeNull();
    expect(parseEventPage("<div class=\"field--name-field-texto\"><ul><li><strong>Local:</strong> Teatro Guaíra</li></ul></div>").venue).toBe("Teatro Guaíra");
    expect(parseEventPage(body("<strong>Local:</strong> Sala, fone 41 99999-8888<br />")).venue).toBe("Sala, fone [masked]");
    expect(parseEventPage(body("<strong>Local:</strong> A<br /><strong>Local:</strong> B<br />")).venue).toBeNull();
    // Real variant (Festival Mia Cara page, 2026-11-22): the colon after </strong>; "Entrada gratuita, com ..." is not a whole value.
    expect(parseEventPage(body("<strong>Local:</strong> Teatro José Maria Santos<br /><strong>Classificação etária</strong>: Livre<br /></p><p><strong>Entrada gratuita, </strong>com distribuição de ingressos"))).toEqual({
      status: "read",
      venue: "Teatro José Maria Santos",
      age_rating: "Livre",
      price: null,
    });
    expect(parseEventPage("<p>nothing</p>").status).toBe("not_recognised");
    expect(parseEventPage('<div class="field--name-field-texto"><div>Sinopse</div><p><strong>Local:</strong> Guairão<br /></p></div>').status).toBe("not_recognised");
    expect(parseEventPage(body("<strong>Classificação etária:</strong> 18 ANOS<br />")).age_rating).toBe("18 anos");
  });
});

describe("guaira_events", () => {
  it("reads robots.txt and the 3 listing pages 5 s apart, then event pages until the 20 s budget; Curitiba only, today to 30 days", async () => {
    const calls = stubFetch(routes());
    const out = await search({});
    // Slots at 0, 5, 10, 15 and 20 s; the second event page's slot (25 s) is after the call's 20 s budget.
    expect(calls.map((c) => c.url)).toEqual([ROBOTS_URL, listingPageUrl(0), listingPageUrl(1), listingPageUrl(2), MUITO]);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(out.data).toMatchObject({ from: "2026-11-22", to: "2026-12-22", city: "Curitiba", total: 4, other_city_rows: 1, truncated: false, partial: true });
    expect(out.data.items.map((i) => i.link)).toEqual([MUITO, MIA, OSP, JON]);
    expect(out.data.items[0]).toMatchObject({ venue: "Auditório Salvador de Ferrante (Guairinha)", price: "R$20,00 (inteira) | R$10,00 (meia-entrada)", details: "read" });
    expect(out.data.items[1]).toMatchObject({ venue: null, details: "not_read" });
    expect(out.data.items[2]).toMatchObject({ venue: null, details: "not_read" });
    expect(out.note).toMatch(/20 s time budget of this call ran out/);
    expect(out).toMatchObject({ source_url: CALENDAR_URL, license_note: expect.stringMatching(/No licence found/) });
    expect(out.note).toMatch(/event\(s\) in other cities/);
  });

  it("still reads the first event page when the call's first request starts a few ms late (1 s slack)", async () => {
    const calls = stubFetch(routes());
    // An earlier read takes the slots at -4.99 s (robots.txt, then cached 24 h) and 0.01 s (OSP): this call's listing
    // pages start at 5.01, 10.01 and 15.01 s, and its first event page's slot is 20.01 s after the call began.
    vi.setSystemTime(NOW.getTime() - 4_990);
    const early = readDetails([OSP]);
    await vi.advanceTimersByTimeAsync(4_990);
    const out = await search({ limit: 1 });
    await early;
    expect(calls.map((c) => c.url)).toEqual([ROBOTS_URL, OSP, listingPageUrl(0), listingPageUrl(1), listingPageUrl(2), MUITO]);
    expect(out.data.items[0]).toMatchObject({ details: "read" });
  });

  it("a listing load that joins another call's robots.txt load which ran out of that call's budget still loads", async () => {
    const calls = stubFetch(routes());
    await warmListing(); // robots.txt read at 0 s, cached 24 h
    vi.setSystemTime(NOW.getTime() + 24 * 60 * 60 * 1000 - 1_000);
    const muito = readDetails([MUITO]); // robots.txt still cached: MUITO takes the slot now, the next one is 5 s away
    await vi.advanceTimersByTimeAsync(2_000); // robots.txt expired; the next slot is 3 s away
    const short = readDetails([OSP], 2, Date.now() + 1_000); // its robots.txt slot is after its 1 s budget: no request
    const listing = getListing(); // joins that robots.txt load
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await short).stopped).toBe("out_of_time");
    expect((await listing).value.rows.length).toBeGreaterThan(0);
    await muito;
    expect(calls.slice(4).map((c) => c.url)).toEqual([MUITO, ROBOTS_URL, listingPageUrl(0), listingPageUrl(1), listingPageUrl(2)]);
  });

  it("serves the listing from the cache for 1 hour and fills the next event pages on the next call", async () => {
    const calls = stubFetch(routes());
    await search({});
    const second = await search({});
    expect(calls.slice(5).map((c) => c.url)).toEqual([MIA, OSP]);
    expect(second.data.partial).toBe(false);
    expect(second.data.items[1]).toMatchObject({ details: "not_recognised" });
    expect(second.data.items[2]).toMatchObject({ venue: "Auditório Bento Munhoz da Rocha Neto (Guairão)", details: "read" });
    vi.setSystemTime(Date.now() + 60 * 60 * 1000);
    await search({ limit: 1 });
    expect(calls.slice(7).map((c) => c.url)).toEqual([listingPageUrl(0), listingPageUrl(1), listingPageUrl(2)]);
  });

  it("filters by city, all cities, words and dates; checks the range before any request", async () => {
    stubFetch(routes());
    expect((await search({ city: "cascavel" })).data.items.map((i) => i.city)).toEqual(["Cascavel"]);
    expect((await search({ city: "all" })).data.total).toBe(5);
    expect((await search({ text: "orquestra sinfonica" })).data.items.map((i) => i.link)).toEqual([OSP]);
    expect((await search({ from: "2027-02-20", to: "2027-02-20" })).data.items.map((i) => i.start)).toEqual(["2027-02-20T20:00"]);
    vi.stubGlobal("fetch", vi.fn());
    expect(errorOf(await call({ from: "2026-12-01", to: "2026-11-01" }))).toEqual({ error: "invalid_date_range", message: "'from' is after 'to'." });
    expect(errorOf(await call({ to: "2026-11-01" }))).toEqual({ error: "invalid_date_range", message: "'to' is before today (the default 'from')." });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns layout_changed and nothing else when the listing changes, then does not ask again for 60 s", async () => {
    const calls = stubFetch(routes({ [`GET ${listingPageUrl(1)}`]: { body: list(1).replace(/Término: /g, "Fim: "), contentType: HTML } }));
    expect(errorOf(await call({}))).toEqual({ error: "layout_changed", message: expect.stringMatching(/no longer has the expected layout/) });
    expect(errorOf(await call({}))).toMatchObject({ error: "layout_changed" });
    expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(60_000);
    await call({});
    expect(calls).toHaveLength(5);
  });

  it("marks the listing truncated when page 3 still has a next link", async () => {
    stubFetch(routes({ [`GET ${listingPageUrl(2)}`]: { body: list(1).replace("page=2\"", "page=3\""), contentType: HTML } }));
    const out = await search({ city: "all", from: "2026-11-01", to: "2027-03-01" });
    expect(out.data.truncated).toBe(true);
    expect(out.note).toMatch(/truncated: true/);
  });
});

describe("requests to the Teatro Guaíra host", () => {
  it("stops when robots.txt disallows the calendar, and reads it again only after 24 h", async () => {
    const calls = stubFetch(routes({ [`GET ${ROBOTS_URL}`]: { body: "User-agent: *\nDisallow: /calendario\n", contentType: "text/plain" } }));
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/robots\.txt now disallows/) });
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
    await call({});
    expect(calls.map((c) => c.url)).toEqual([ROBOTS_URL]);
  });

  it("re-reads robots.txt after 24 h and stops when the calendar became disallowed", async () => {
    stubFetch(routes());
    expect((await search({})).data.total).toBe(4);
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    const calls = stubFetch(routes({ [`GET ${ROBOTS_URL}`]: { body: `${ROBOTS}\nDisallow: /calendario-eventos\n`, contentType: "text/plain" } }));
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/robots\.txt now disallows/) });
    expect(calls.map((c) => c.url)).toEqual([ROBOTS_URL]);
  });

  it("reads no event page when robots.txt disallows /Evento/", async () => {
    const calls = stubFetch(routes({ [`GET ${ROBOTS_URL}`]: { body: "User-agent: *\nDisallow: /Evento/\n", contentType: "text/plain" } }));
    const out = await search({});
    expect(calls.map((c) => c.url)).not.toContain(MUITO);
    expect(out.data.items.every((i) => i.details === "not_read")).toBe(true);
    expect(out.note).toMatch(/robots\.txt does not allow event pages/);
  });

  it("treats a robots.txt 404 as no rules", async () => {
    stubFetch(routes({ [`GET ${ROBOTS_URL}`]: { status: 404 } }));
    expect((await search({})).data.total).toBe(4);
  });

  it("fails closed on a robots.txt 500 and remembers it for 60 s", async () => {
    const calls = stubFetch(routes({ [`GET ${ROBOTS_URL}`]: { status: 500 } }));
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable" });
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable" });
    expect(calls).toHaveLength(1);
  });

  it("starts requests at least 5 s apart", async () => {
    const at: number[] = [];
    const calls = stubFetch(routes());
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", (...a: Parameters<typeof fetch>) => (at.push(Date.now()), real(...a)));
    await warmListing();
    await search({});
    expect(calls).toHaveLength(6);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(5_000);
  });

  it("gives up on a request whose turn is more than 10 s away, without a request", async () => {
    const calls = stubFetch(routes());
    await search({ limit: 1 });
    vi.setSystemTime(Date.now() + 60_000);
    const links = [OSP, JON, OTHERS[2]!, OTHERS[3]!];
    const runs = links.map((l) => readDetails([l], 1));
    await vi.advanceTimersByTimeAsync(30_000);
    const res = await Promise.all(runs);
    expect(res.map((r) => r.stopped)).toEqual([null, null, null, "busy"]);
    expect(res[3]!.details.size).toBe(0);
    expect(calls.slice(5).map((c) => c.url)).toEqual(links.slice(0, 3));
  });

  it("honours a 429's Retry-After (capped at 1 hour) without a new request", async () => {
    const calls = stubFetch(routes({ [`GET ${listingPageUrl(0)}`]: { status: 429, headers: { "retry-after": "7200" } } }));
    expect(errorOf(await call({}))).toEqual({ error: "rate_limited", message: "The source is limiting requests; wait about 60 minutes before trying again." });
    vi.setSystemTime(Date.now() + 30 * 60 * 1000);
    expect(errorOf(await call({}))).toMatchObject({ error: "rate_limited" });
    expect(calls).toHaveLength(2);
  });

  it.each([401, 403])("blocks the host for 10 minutes after HTTP %i", async (status) => {
    const calls = stubFetch(routes({ [`GET ${listingPageUrl(0)}`]: { status } }));
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    vi.setSystemTime(Date.now() + 5 * 60 * 1000);
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    expect(calls).toHaveLength(2);
  });

  it("blocks the host on a CAPTCHA page", async () => {
    const calls = stubFetch(routes({ [`GET ${listingPageUrl(0)}`]: { status: 429, body: "<html>cf-turnstile captcha</html>", contentType: HTML } }));
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    expect(calls).toHaveLength(2);
  });

  it("blocks the host when a 200 page that does not parse is a challenge page", async () => {
    const calls = stubFetch(routes({ [`GET ${listingPageUrl(0)}`]: { body: "<html><div class=\"cf-turnstile\"></div></html>", contentType: HTML } }));
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    vi.setSystemTime(Date.now() + 5 * 60 * 1000);
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    expect(calls).toHaveLength(2);
  });

  it("does not take a normal site page with a captcha form for a challenge", async () => {
    const page = '<html><script data-drupal-selector="drupal-settings-json">{}</script><form class="captcha"></form></html>';
    const calls = stubFetch(routes({ [`GET ${MUITO}`]: { body: page, contentType: HTML } }));
    await warmListing();
    const out = await search({});
    expect(out.data.items[0]!.details).toBe("not_recognised");
    expect(calls.slice(4).map((c) => c.url)).toEqual([MUITO, MIA]);
  });

  it("leaves event pages not_read while the host is refused, also after the first 60 s", async () => {
    const calls = stubFetch(routes({ [`GET ${MUITO}`]: { status: 403 } }));
    expect((await search({})).data.items[0]!.details).toBe("unavailable");
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    const out = await search({});
    expect(out.data.items.map((i) => i.details)).toEqual(["not_read", "not_read", "not_read", "not_read"]);
    expect(calls).toHaveLength(5);
  });

  it("reports robots_failed, not a page failure, when robots.txt cannot be re-read for event pages", async () => {
    stubFetch(routes());
    await search({ limit: 1 });
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    const calls = stubFetch(routes({ [`GET ${ROBOTS_URL}`]: { status: 500 } }));
    const res = await readDetails([OSP]);
    expect(res).toEqual({ details: new Map(), stopped: "robots_failed" });
    expect(calls.map((c) => c.url)).toEqual([ROBOTS_URL]);
  });

  it("asks nothing, robots.txt included, while a failure is remembered (busy, not robots_failed)", async () => {
    stubFetch(routes());
    await search({ limit: 1 }); // robots.txt cached from here for 24 h
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 - 5 * 60 * 1000);
    stubFetch(routes({ [`GET ${OSP}`]: { status: 403 } }));
    expect((await search({ from: "2026-11-22", offset: 2, limit: 1 })).data.items[0]!.details).toBe("unavailable"); // listing reloaded, then the event page refused: host blocked 10 minutes
    vi.setSystemTime(Date.now() + 6 * 60 * 1000); // robots.txt cache expired, block still on
    const calls = stubFetch(routes());
    expect(await readDetails([JON])).toEqual({ details: new Map(), stopped: "busy" });
    expect(calls).toHaveLength(0);
  });

  it("treats a 200 event page that is not a page of the site (a WAF page) as a failure remembered 60 s", async () => {
    const calls = stubFetch(routes({ [`GET ${MUITO}`]: { body: "<html><h1>Request blocked</h1></html>", contentType: HTML } }));
    expect((await search({})).data.items.map((i) => i.details)).toEqual(["unavailable", "not_read", "not_read", "not_read"]);
    expect((await search({})).note).toMatch(/busy or failed a moment ago/);
    expect(calls).toHaveLength(5);
  });

  it("treats a 200 listing page that is not the calendar as a failure remembered 60 s", async () => {
    const calls = stubFetch(routes({ [`GET ${listingPageUrl(0)}`]: { body: "<html><h1>Request blocked</h1></html>", contentType: HTML } }));
    expect(errorOf(await call({}))).toMatchObject({ error: "layout_changed" });
    expect(errorOf(await call({}))).toMatchObject({ error: "layout_changed" });
    expect(calls).toHaveLength(2);
  });

  it("keeps the listing when an event page fails, and reads no more event pages in that call", async () => {
    const calls = stubFetch(routes({ [`GET ${MUITO}`]: { status: 500 } }));
    const out = await search({});
    expect(calls.map((c) => c.url)).toEqual([ROBOTS_URL, listingPageUrl(0), listingPageUrl(1), listingPageUrl(2), MUITO]);
    expect(out.data.items.map((i) => i.details)).toEqual(["unavailable", "not_read", "not_read", "not_read"]);
    expect(out.note).toMatch(/could not be read/);
  });

  it("treats a removed event page (404) as that page only: no host failure, the next page is still read", async () => {
    const calls = stubFetch(routes({ [`GET ${MUITO}`]: { status: 404 } }));
    await warmListing();
    const out = await search({});
    expect(calls.slice(4).map((c) => c.url)).toEqual([MUITO, MIA]);
    expect(out.data.items.map((i) => i.details)).toEqual(["unavailable", "not_recognised", "not_read", "not_read"]);
    expect(out.note).not.toMatch(/could not be read/);
  });

  it("leaves event pages not_read (not unavailable) while a failure is remembered", async () => {
    const calls = stubFetch(routes({ [`GET ${MUITO}`]: { status: 500 } }));
    await search({});
    const out = await search({});
    expect(calls).toHaveLength(5);
    expect(out.data.items.map((i) => i.details)).toEqual(["not_read", "not_read", "not_read", "not_read"]);
    expect(out.note).toMatch(/busy or failed a moment ago/);
  });

  it("does not follow a redirect to another host", async () => {
    stubFetch(routes({ [`GET ${listingPageUrl(0)}`]: { status: 302, headers: { location: "https://evil.example/x" } } }));
    expect(errorOf(await call({}))).toEqual({ error: "source_unavailable" });
  });
});

describe("details cache", () => {
  const link = (i: number) => `https://www.teatroguaira.pr.gov.br/Evento/x-${i}`;

  it(`holds at most ${DETAILS_CACHE_MAX} event pages, evicting the oldest insert; a re-insert moves a link to the end`, () => {
    for (let i = 0; i < DETAILS_CACHE_MAX; i++) cacheDetails(link(i), NO_DETAILS("read"));
    expect(detailsCacheSize()).toBe(DETAILS_CACHE_MAX);
    cacheDetails(link(0), NO_DETAILS("unavailable")); // refreshed: now the newest
    cacheDetails(link(DETAILS_CACHE_MAX), NO_DETAILS("read"));
    expect(detailsCacheSize()).toBe(DETAILS_CACHE_MAX);
    expect(cachedDetails(link(1))).toBeNull();
    expect(cachedDetails(link(0))).toMatchObject({ status: "unavailable" });
    expect(cachedDetails(link(2))).not.toBeNull();
    expect(cachedDetails(link(DETAILS_CACHE_MAX))).not.toBeNull();
  });

  it("sweeps expired entries on insert", () => {
    for (let i = 0; i < 10; i++) cacheDetails(link(i), NO_DETAILS("read"));
    vi.setSystemTime(Date.now() + DETAILS_CACHE_TTL_MS);
    cacheDetails(link(99), NO_DETAILS("read"));
    expect(detailsCacheSize()).toBe(1);
  });
});
