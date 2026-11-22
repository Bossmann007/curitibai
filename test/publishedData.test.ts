import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePhonesPage } from "../scripts/fetch-events.mjs";
import { ALLOWED_HOSTS } from "../src/config.js";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { PUBLISHED_CACHE_TTL_MS, publishedUrl, REMOTE_DATA_ENV } from "../src/sources/publishedData.js";
import { eventsSearchOutput } from "../src/tools/eventsSearch.js";
import { PHONES_SOURCE_URL, usefulPhonesOutput } from "../src/tools/usefulPhones.js";
import { connectClient, errorOf, fixture, stubFetch, type Route } from "./helpers.js";

const EVENTS_URL = publishedUrl("events/events.json");
const PHONES_URL = publishedUrl("phones/phones.json");
const DAY = 86_400_000;

// Invented events only.
const ev = (id: number) => ({
  id,
  title: `Evento Sintético ${id}`,
  start_date: "2026-01-01",
  end_date: "2099-12-31",
  time: "20h.",
  place: "Teatro Imaginário",
  address: "Rua Inventada, 1, Centro",
  category: "Lazer",
  link: `https://turismo.curitiba.pr.gov.br/evento/evento-sintetico-${id}/${id}`,
});
const eventsFile = (checkedAt: Date, ids = [1]) => ({
  format: 1,
  source: "https://turismo.curitiba.pr.gov.br/eventos/",
  checked_at: checkedAt.toISOString(),
  list_date: checkedAt.toISOString().slice(0, 10),
  count: ids.length,
  events: ids.map(ev),
});
const ENTRIES = parsePhonesPage(fixture("useful_phones/telefones_uteis_trimmed.html")).entries;
const phonesFile = (checkedAt: Date) => ({
  format: 1,
  source: PHONES_SOURCE_URL,
  checked_at: checkedAt.toISOString(),
  count: ENTRIES.length,
  dropped: 0,
  entries: ENTRIES,
});

const json = (doc: unknown): Route => ({ body: JSON.stringify(doc), contentType: "text/plain; charset=utf-8" });
const events = async (args: Record<string, unknown> = {}) => (await connectClient()).callTool({ name: "events_search", arguments: args });
const phones = async (args: Record<string, unknown> = {}) => (await connectClient()).callTool({ name: "useful_phones", arguments: args });

describe("published nightly copy", () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-published-")));
    vi.stubEnv(DATA_DIR_ENV, dir);
    vi.stubEnv(REMOTE_DATA_ENV, "");
  });
  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });
  const writeLocal = (file: string, text: string) => {
    mkdirSync(join(dir, file.split("/")[0]!), { recursive: true });
    writeFileSync(join(dir, file), text);
  };

  it("reads only fixed URLs on raw.githubusercontent.com, an allowed host", () => {
    expect(EVENTS_URL).toBe("https://raw.githubusercontent.com/Bossmann007/curitibai/data/events/events.json");
    expect(PHONES_URL).toBe("https://raw.githubusercontent.com/Bossmann007/curitibai/data/phones/phones.json");
    expect(ALLOWED_HOSTS).toContain("raw.githubusercontent.com");
  });

  it("events_search reads the published file when there is no local one, with checked_at and a note saying so", async () => {
    const checked = new Date(Date.now() - 3600_000);
    const calls = stubFetch({ [`GET ${EVENTS_URL}`]: json(eventsFile(checked, [1, 2])) });
    const res = await events();
    expect(res.isError).toBeFalsy();
    const out = eventsSearchOutput.parse(res.structuredContent);
    expect(out.data.items.map((e) => e.id)).toEqual([1, 2]);
    expect(out.checked_at).toBe(checked.toISOString());
    expect(out.stale).toBe(false);
    expect(out.note).toMatch(/nightly collection publishes/);
    expect(out.note).toContain(EVENTS_URL);
    expect(calls).toEqual([{ url: EVENTS_URL, method: "GET" }]);
  });

  it("also reads the published file when CURITIBAI_DATA_DIR is not set", async () => {
    vi.stubEnv(DATA_DIR_ENV, "");
    stubFetch({ [`GET ${PHONES_URL}`]: json(phonesFile(new Date(Date.now() - 3600_000))) });
    const res = await phones({ query: "samu" });
    expect(res.isError).toBeFalsy();
    const out = usefulPhonesOutput.parse(res.structuredContent);
    expect(out.data.items[0]!.numbers).toEqual(["192"]);
    expect(out).toMatchObject({ stale: false });
    expect(out.note).toContain(PHONES_URL);
  });

  it("local first: a local file is read and the network is never asked", async () => {
    writeLocal("events/events.json", JSON.stringify(eventsFile(new Date(), [7])));
    writeLocal("phones/phones.json", JSON.stringify(phonesFile(new Date())));
    const calls = stubFetch({});
    const e = eventsSearchOutput.parse((await events()).structuredContent);
    expect(e.data.items.map((i) => i.id)).toEqual([7]);
    expect(e.note).toMatch(/^Read from the local file/);
    expect(usefulPhonesOutput.parse((await phones()).structuredContent).note).toMatch(/^Read from the local file/);
    expect(calls).toEqual([]);
  });

  it("a broken or too old local file keeps its error: the published copy never hides it", async () => {
    const calls = stubFetch({});
    writeLocal("events/events.json", "{not json");
    expect(errorOf(await events())).toMatchObject({ error: "invalid_data" });
    writeLocal("events/events.json", JSON.stringify(eventsFile(new Date(Date.now() - 8 * DAY))));
    const old = errorOf(await events()) as { error: string; message: string };
    expect(old.error).toBe("data_not_available");
    expect(old.message).toMatch(/remove the local file to use the published copy/);
    writeLocal("phones/phones.json", "[]");
    expect(errorOf(await phones())).toMatchObject({ error: "invalid_data" });
    expect(calls).toEqual([]);
  });

  it(`${REMOTE_DATA_ENV}=0 turns the published copy off: no request, data_not_available`, async () => {
    for (const value of ["0", "off", " OFF "]) {
      vi.stubEnv(REMOTE_DATA_ENV, value);
      const calls = stubFetch({});
      expect(errorOf(await events())).toMatchObject({ error: "data_not_available" });
      expect(errorOf(await phones())).toMatchObject({ error: "data_not_available" });
      expect(calls).toEqual([]);
    }
  });

  it("fails closed on a published file with another shape, a bad row or no JSON", async () => {
    const bad = { ...eventsFile(new Date()), count: 5 };
    stubFetch({ [`GET ${EVENTS_URL}`]: json(bad), [`GET ${PHONES_URL}`]: { body: "<html>not json</html>" } });
    expect(errorOf(await events())).toMatchObject({ error: "invalid_data" });
    expect(errorOf(await phones())).toMatchObject({ error: "invalid_data" });
  });

  it("fails closed on an event whose link points elsewhere", async () => {
    const doc = eventsFile(new Date());
    doc.events[0]!.link = "https://evil.example/evento/x/1";
    stubFetch({ [`GET ${EVENTS_URL}`]: json(doc) });
    expect(errorOf(await events())).toMatchObject({ error: "invalid_data" });
  });

  it("refuses a published file over the size cap", async () => {
    stubFetch({ [`GET ${PHONES_URL}`]: { body: "x", headers: { "content-length": String(10 * 1024 * 1024) } } });
    expect(errorOf(await phones())).toMatchObject({ error: "source_unavailable" });
  });

  it("follows no redirect away from this repository's data branch", async () => {
    stubFetch({
      [`GET ${EVENTS_URL}`]: { status: 302, headers: { location: "https://raw.githubusercontent.com/someone/else/main/events.json" } },
    });
    expect(errorOf(await events())).toMatchObject({ error: "source_unavailable" });
  });

  it("before the first nightly run (HTTP 404) says the copy is not published yet", async () => {
    stubFetch({ [`GET ${EVENTS_URL}`]: { status: 404, body: "404: Not Found" } });
    const err = errorOf(await events()) as { error: string; message: string };
    expect(err.error).toBe("data_not_available");
    expect(err.message).toMatch(/no published copy yet/);
  });

  it("caches a good file for 1 hour, then asks again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-22T12:00:00Z"));
    const calls = stubFetch({ [`GET ${EVENTS_URL}`]: json(eventsFile(new Date("2026-11-22T02:40:00Z"))) });
    expect((await events()).isError).toBeFalsy();
    expect((await events({ text: "sintetico" })).isError).toBeFalsy();
    expect(calls).toHaveLength(1);
    vi.setSystemTime(new Date(Date.now() + PUBLISHED_CACHE_TTL_MS + 1000));
    expect((await events()).isError).toBeFalsy();
    expect(calls).toHaveLength(2);
  });

  it("remembers a failure (host gate): no new request for at least 60 s", async () => {
    const calls = stubFetch({ [`GET ${EVENTS_URL}`]: { status: 500 } });
    expect(errorOf(await events())).toMatchObject({ error: "source_unavailable" });
    expect(errorOf(await events())).toMatchObject({ error: "source_unavailable" });
    expect(calls).toHaveLength(1);
  });

  it("stale: true after 3 days with a note that the nightly collection may have stopped; refused after 7", async () => {
    stubFetch({
      [`GET ${EVENTS_URL}`]: json(eventsFile(new Date(Date.now() - 4 * DAY))),
      [`GET ${PHONES_URL}`]: json(phonesFile(new Date(Date.now() - 4 * DAY))),
    });
    const e = eventsSearchOutput.parse((await events()).structuredContent);
    expect(e.stale).toBe(true);
    expect(e.note).toMatch(/nightly collection may have stopped/);
    const p = usefulPhonesOutput.parse((await phones()).structuredContent);
    expect(p.stale).toBe(true);
    expect(p.note).toMatch(/nightly collection may have stopped/);
  });

  it("a published events file over 7 days old is data_not_available, pointing at the nightly collection", async () => {
    stubFetch({ [`GET ${EVENTS_URL}`]: json(eventsFile(new Date(Date.now() - 8 * DAY))) });
    const err = errorOf(await events()) as { error: string; message: string };
    expect(err.error).toBe("data_not_available");
    expect(err.message).toMatch(/nightly collection may have stopped/);
  });
});
