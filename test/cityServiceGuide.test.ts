import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema, type ElicitRequest } from "@modelcontextprotocol/sdk/types.js";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { createServer } from "../src/server.js";
import { buildCatalog, CATALOG_FILE, CITY_SERVICES_SOURCE_URL } from "../src/tools/cityServicesSearch.js";
import {
  buildSteps,
  cartaFor,
  cityServiceGuideOutput,
  cityServiceGuideResult,
  GUIDE_IDS,
  GUIDES,
  isAllowedUrl,
} from "../src/tools/cityServiceGuide.js";
import { connectClient, errorOf } from "./helpers.js";

// Invented services in the real file shape (no real catalog text); written to a temp folder, never committed.
function carta(items: { title: string; slug: string; id: number; online: string | null }[]) {
  return {
    source: "synthetic test data",
    captured: "2026-11-20",
    count: items.length,
    items: items.map((x) => ({
      cat: "Teste",
      title: x.title,
      what: "O que é? Texto sintético.",
      url: `https://servicos.curitiba.pr.gov.br/${x.slug}/${x.id}`,
      online: x.online,
    })),
  };
}
const SYNTHETIC = carta([
  { title: "IPTU sintético de teste", slug: "iptu-sintetico", id: 9101, online: "https://iptu-sintetico.curitiba.pr.gov.br/guia" },
  { title: "Cartão Transporte sintético", slug: "cartao-sintetico", id: 9102, online: "https://loja.exemplo.com.br/creditos" },
  { title: "Creche sintética A", slug: "creche-a", id: 9103, online: null },
  { title: "Creche sintética B", slug: "creche-b", id: 9104, online: null },
  { title: "Detran sintético", slug: "detran-sintetico", id: 9105, online: "https://www.detran.pr.gov.br:8443/x" },
]);
const CATALOG = buildCatalog(SYNTHETIC);

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-guide-")));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

type Output = ReturnType<typeof cityServiceGuideOutput.parse>;
const allSteps = (o: Output) => o.data.steps ?? [];

/** Every guide, with the synthetic Carta copy and without one. */
async function everyOutput(): Promise<Output[]> {
  const out: Output[] = [];
  for (const id of GUIDE_IDS) {
    for (const catalog of [CATALOG, null]) {
      const res = await cityServiceGuideResult(id, undefined, catalog, undefined);
      if (!res.ok) throw new Error(res.message);
      out.push(cityServiceGuideOutput.parse(res.payload));
    }
  }
  return out;
}

describe("host allowlist", () => {
  it.each([
    "https://156.curitiba.pr.gov.br/",
    "https://servicos.curitiba.pr.gov.br/x/1",
    "https://www.detran.pr.gov.br/",
    "https://www.agendamento.detran.pr.gov.br/detran-agendamento/portal",
    "https://www.gov.br/pt-br",
    "https://SAUDEJA.Curitiba.PR.gov.br/",
  ])("allows %s", (url) => expect(isAllowedUrl(url)).toBe(true));

  it.each([
    "http://156.curitiba.pr.gov.br/",
    "https://curitiba.pr.gov.br.evil.com/",
    "https://evilcuritiba.pr.gov.br/",
    "https://gov.br@evil.com/",
    "https://user:pw@156.curitiba.pr.gov.br/",
    "https://156.curitiba.pr.gov.br:8443/",
    "https://xn--curitba-xza.curitiba.pr.gov.br/",
    "https://obituarios.curitiba.pr.gov.br/",
    "https://detran.pr.gov.br/",
    "https://gov.br/",
    "https://pr.gov.br/",
    "https://loja.exemplo.com.br/",
    "https://www.gov.br\\@evil.com/",
    "https://www.gov.br\\@evil.com/login",
    "https://www.gov.br\t.evil.com/",
    "https://156.curitiba.pr.gov.br\n/",
    " https://156.curitiba.pr.gov.br/",
    "https://156.curitiba.pr.gov.br/a b",
    "https://156.curitiba.pr.gov.br/\u0000",
    "javascript:alert(1)",
    "not a url",
  ])("refuses %s", (url) => expect(isAllowedUrl(url)).toBe(false));
});

describe("guide invariants (every guide, with and without the Carta copy)", () => {
  it("every step that opens a link or has the citizen type data needs consent and says what happens", async () => {
    for (const o of await everyOutput()) {
      for (const s of allSteps(o)) {
        if (s.url !== null || s.citizen_types_on_site.length > 0) expect(s.needs_consent, `${o.data.service} #${s.step}`).toBe(true);
        expect(s.needs_consent).toBe(s.consent !== null);
        if (s.consent !== null) expect(s.consent.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("every guide starts with a step that stays in the conversation and says not to ask for personal data", async () => {
    for (const o of await everyOutput()) {
      const first = allSteps(o)[0]!;
      expect(first.needs_consent).toBe(false);
      expect(first.url).toBeNull();
      expect(first.action).toMatch(/Não peça nesta conversa CPF, senha/);
    }
  });

  it("choosing and confirming are separate steps: no consent text both chooses and confirms", async () => {
    for (const o of await everyOutput()) {
      for (const s of allSteps(o)) {
        const c = (s.consent ?? "").toLowerCase();
        expect(c.includes("escolhe") && c.includes("confirma"), `${o.data.service} #${s.step}: ${c}`).toBe(false);
      }
    }
  });

  it("every outward action (open, type, pay, send, schedule) is a consent step", async () => {
    const outward = /\b(abrir|entrar|enviar|pagar|escolher|confirmar)\b/i;
    for (const o of await everyOutput()) {
      for (const s of allSteps(o).slice(1)) {
        if (outward.test(s.action)) expect(s.needs_consent, `${o.data.service} #${s.step}: ${s.action}`).toBe(true);
      }
    }
  });

  it("one outward action per step: a step that opens a link has the citizen type nothing", async () => {
    for (const o of await everyOutput()) {
      for (const s of allSteps(o)) {
        if (s.url !== null) expect(s.citizen_types_on_site, `${o.data.service} #${s.step}`).toEqual([]);
      }
    }
    for (const g of Object.values(GUIDES)) {
      for (const s of g.steps) {
        const x = s as { link?: unknown; types?: unknown[] };
        if (x.link) expect(x.types ?? []).toEqual([]);
      }
    }
  });

  it("no URL outside the allowlist, and url_host matches the URL", async () => {
    for (const o of await everyOutput()) {
      for (const s of allSteps(o)) {
        if (s.url === null) continue;
        expect(isAllowedUrl(s.url), s.url).toBe(true);
        expect(s.url_host).toBe(new URL(s.url).hostname);
      }
      expect(isAllowedUrl(o.data.delegation.source_url)).toBe(true);
    }
  });

  it("no step asks the user to give personal data in the conversation; data is typed only on the site", async () => {
    const askInChat = /\b(informe|me (diga|passe|envie)|digite aqui|nesta conversa (o|a|seu|sua))\b/i;
    for (const o of await everyOutput()) {
      for (const s of allSteps(o)) {
        expect(`${s.action} ${s.consent ?? ""}`).not.toMatch(askInChat);
      }
      expect(o.note).toMatch(/never ask for them in the conversation/);
      expect(o.note).toMatch(/Never type passwords, CPF or payment data/);
    }
  });

  it("the input accepts only a guide id and a step number: no free text can carry personal data", async () => {
    const client = await connectClient();
    const tool = (await client.listTools()).tools.find((t) => t.name === "city_service_guide")!;
    const props = tool.inputSchema.properties as Record<string, { type?: string; enum?: string[] }>;
    expect(Object.keys(props).sort()).toEqual(["open_step", "service"]);
    expect(props.service!.enum).toEqual([...GUIDE_IDS]);
    expect(props.open_step!.type).toBe("integer");
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: true });
  });

  it("every fixed link in the guide table is on the allowlist", () => {
    for (const g of Object.values(GUIDES)) {
      for (const s of g.steps) {
        const link = (s as { link?: unknown }).link;
        if (link && typeof link === "object") expect(isAllowedUrl((link as { fixed: string }).fixed)).toBe(true);
      }
    }
  });

  it("mentions Autorização Digital only as information", async () => {
    for (const o of await everyOutput()) {
      expect(o.data.delegation.text).toMatch(/o CuritibAI não faz nem verifica/);
    }
  });
});

describe("Carta copy", () => {
  it("one match: the page and an allowlisted online link come from the copy", () => {
    const { info, links } = cartaFor(CATALOG, GUIDES.iptu);
    expect(info.status).toBe("matched");
    expect(links).toEqual({
      page: "https://servicos.curitiba.pr.gov.br/iptu-sintetico/9101",
      online: "https://iptu-sintetico.curitiba.pr.gov.br/guia",
    });
    const steps = buildSteps(GUIDES.iptu, links);
    expect(steps[1]).toMatchObject({ url: links.page, link_source: "carta_copy" });
    expect(steps[2]).toMatchObject({ url: links.online, link_source: "carta_copy", url_host: "iptu-sintetico.curitiba.pr.gov.br" });
  });

  it("a Carta online link that another parser reads with another host is dropped (backslash before @)", () => {
    const tricky = buildCatalog(
      carta([{ title: "IPTU sintético", slug: "iptu-t", id: 9401, online: "https://www.gov.br\\@evil.com/login" }]),
    );
    const { links } = cartaFor(tricky, GUIDES.iptu);
    expect(links.online).toBeNull();
    expect(buildSteps(GUIDES.iptu, links)[2]!.url).toBeNull();
  });

  it("links are emitted in normalized form (URL.href), url_host from the same parse", () => {
    const mixed = buildCatalog(
      carta([{ title: "IPTU sintético", slug: "iptu-m", id: 9402, online: "https://IPTU-X.Curitiba.PR.gov.br/Guia" }]),
    );
    const step = buildSteps(GUIDES.iptu, cartaFor(mixed, GUIDES.iptu).links)[2]!;
    expect(step).toMatchObject({ url: "https://iptu-x.curitiba.pr.gov.br/Guia", url_host: "iptu-x.curitiba.pr.gov.br" });
  });

  it("a match whose official_url fails the allowlist is dropped, whatever module built the catalog", () => {
    // Built by hand (not by buildCatalog), so cartaFor alone has to refuse these URLs.
    const base = buildCatalog(
      carta([
        { title: "IPTU sintético um", slug: "iptu-e", id: 9411, online: null },
        { title: "IPTU sintético dois", slug: "iptu-j", id: 9412, online: null },
        { title: "IPTU sintético três", slug: "iptu-ok", id: 9413, online: null },
      ]),
    );
    const bad = ["https://evil.example/phish", "javascript:alert(1)"];
    const services = base.services.map((s, i) => (i < bad.length ? { ...s, official_url: bad[i]! } : s));
    const kept = services[2]!;
    const { info, links } = cartaFor({ ...base, services }, GUIDES.iptu);
    expect(info.status).toBe("matched");
    expect(info.matches).toEqual([{ title: kept.title, official_url: kept.official_url }]);
    expect(links.page).toBe(kept.official_url);
    const out = JSON.stringify({ info, links, steps: buildSteps(GUIDES.iptu, links) });
    for (const u of bad) expect(out).not.toContain(u);

    const onlyBad = { ...base, services: services.slice(0, 2) };
    expect(cartaFor(onlyBad, GUIDES.iptu)).toMatchObject({ info: { status: "no_match", matches: [] }, links: { page: null } });
  });

  it("Carta titles in matches are cut to 120 characters", () => {
    const long = buildCatalog(carta([{ title: `IPTU ${"x".repeat(300)}`, slug: "iptu-l", id: 9403, online: null }]));
    const title = cartaFor(long, GUIDES.iptu).info.matches[0]!.title;
    expect(title).toHaveLength(120);
    expect(title.endsWith("…")).toBe(true);
  });

  it("drops an online link whose host is not allowed (third party, port)", () => {
    expect(cartaFor(CATALOG, GUIDES.cartao_transporte).links.online).toBeNull();
    expect(cartaFor(CATALOG, GUIDES.detran).links.online).toBeNull();
  });

  it("several matches: no Carta link, candidates as data", () => {
    const { info, links } = cartaFor(CATALOG, GUIDES.creche);
    expect(info.status).toBe("ambiguous");
    expect(info.matches.map((m) => m.title)).toEqual(["Creche sintética A", "Creche sintética B"]);
    expect(links).toEqual({ page: null, online: null });
    // The page step falls back to the catalog listing, an official fixed URL.
    expect(buildSteps(GUIDES.creche, links)[1]).toMatchObject({ url: CITY_SERVICES_SOURCE_URL, link_source: "official_allowlist" });
  });

  it("no match; query words must be whole title words (\"ja\" is not \"jardim\", \"156\" is not \"1560\")", () => {
    expect(cartaFor(CATALOG, GUIDES.saude_ja).info.status).toBe("no_match");
    const near = buildCatalog(
      carta([
        { title: "Saúde no Jardim sintético", slug: "saude-jardim", id: 9301, online: null },
        { title: "Lei 1560 sintética", slug: "lei-1560", id: 9302, online: null },
        { title: "Saúde Já sintético", slug: "saude-ja", id: 9303, online: null },
      ]),
    );
    expect(cartaFor(near, GUIDES["156"]).info.status).toBe("no_match");
    expect(cartaFor(near, GUIDES.saude_ja).info.matches.map((m) => m.title)).toEqual(["Saúde Já sintético"]);
  });

  it("without the file: guide still returned, Carta links left out, message says how to save the copy", async () => {
    vi.stubEnv(DATA_DIR_ENV, tmp);
    const client = await connectClient();
    const res = await client.callTool({ name: "city_service_guide", arguments: { service: "iptu" } });
    const o = cityServiceGuideOutput.parse(res.structuredContent);
    expect(o.data.carta.status).toBe("not_available");
    expect(o.data.carta.message).toContain(`save the listing yourself as ${CATALOG_FILE}`);
    expect(o.data.carta.message).toContain("docs/local-data.md");
    expect(o.data.carta.message).toContain(CITY_SERVICES_SOURCE_URL);
    expect(o.data.steps![2]!.url).toBeNull(); // carta_online
    expect(o.data.steps![1]!.url).toBe(CITY_SERVICES_SOURCE_URL);
  });

  it("with the file in CURITIBAI_DATA_DIR the tool reads it", async () => {
    writeFileSync(join(tmp, CATALOG_FILE), JSON.stringify(SYNTHETIC));
    vi.stubEnv(DATA_DIR_ENV, tmp);
    const client = await connectClient();
    const res = await client.callTool({ name: "city_service_guide", arguments: { service: "iptu" } });
    const o = cityServiceGuideOutput.parse(res.structuredContent);
    expect(o.data.carta.status).toBe("matched");
    expect(o.data.steps![2]!.url).toBe("https://iptu-sintetico.curitiba.pr.gov.br/guia");
  });

  it("an invalid file is reported, the guide still works", async () => {
    writeFileSync(join(tmp, CATALOG_FILE), "{");
    vi.stubEnv(DATA_DIR_ENV, tmp);
    const client = await connectClient();
    const res = await client.callTool({ name: "city_service_guide", arguments: { service: "156" } });
    const o = cityServiceGuideOutput.parse(res.structuredContent);
    expect(o.data.carta.status).toBe("invalid");
    expect(o.data.steps![1]!.url).toBe("https://156.curitiba.pr.gov.br/");
  });
});

describe("open_step (URL-mode elicitation)", () => {
  async function clientWith(answer: "accept" | "decline" | "cancel" | null) {
    vi.stubEnv(DATA_DIR_ENV, tmp);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverTransport);
    const asked: ElicitRequest["params"][] = [];
    const client = new Client(
      { name: "test", version: "0.0.0" },
      answer === null ? {} : { capabilities: { elicitation: { url: {} } } },
    );
    if (answer !== null) {
      client.setRequestHandler(ElicitRequestSchema, async (req) => {
        asked.push(req.params);
        return { action: answer };
      });
    }
    await client.connect(clientTransport);
    await client.listTools();
    return { client, asked };
  }
  const open = (client: Client, step: number) =>
    client.callTool({ name: "city_service_guide", arguments: { service: "saude_ja", open_step: step } });

  it("accept: the client was asked with the URL and a fixed message naming the host; link returned", async () => {
    const { client, asked } = await clientWith("accept");
    const o = cityServiceGuideOutput.parse((await open(client, 2)).structuredContent);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ mode: "url", url: "https://saudeja.curitiba.pr.gov.br/" });
    expect((asked[0] as { message: string }).message).toContain("abrir saudeja.curitiba.pr.gov.br no seu navegador?");
    expect((asked[0] as { elicitationId: string }).elicitationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(o.data.open_step).toEqual({ step: 2, result: "accepted", url: "https://saudeja.curitiba.pr.gov.br/", url_host: "saudeja.curitiba.pr.gov.br" });
    expect(o.data.steps).toBeUndefined();
  });

  it.each([
    ["decline", "declined"],
    ["cancel", "cancelled"],
  ] as const)("%s: no link, told to stop", async (answer, result) => {
    const { client } = await clientWith(answer);
    const o = cityServiceGuideOutput.parse((await open(client, 2)).structuredContent);
    expect(o.data.open_step).toEqual({ step: 2, result, url: null, url_host: null });
    expect(JSON.stringify(o)).not.toContain("saudeja.curitiba.pr.gov.br");
    expect(o.note).toMatch(/stop here/);
  });

  it.each(["decline", "cancel", "error"] as const)(
    "%s on a Carta link: the payload holds no Carta URL (matches left out), only the status",
    async (answer) => {
      const one = buildCatalog(
        carta([{ title: "IPTU sintético", slug: "iptu-d", id: 9501, online: "https://iptu-d.curitiba.pr.gov.br/guia" }]),
      );
      const res = await cityServiceGuideResult("iptu", 2, one, { elicitUrl: async () => answer });
      if (!res.ok) throw new Error(res.message);
      const o = cityServiceGuideOutput.parse(res.payload);
      expect(o.data.carta).toEqual({ status: "matched", matches: [], message: null });
      expect(JSON.stringify(res.payload)).not.toContain("servicos.curitiba.pr.gov.br");
      expect(JSON.stringify(res.payload)).not.toContain("iptu-d.curitiba.pr.gov.br");
    },
  );

  it("no answer (timeout or a failed request): no link, offer to ask again", async () => {
    const res = await cityServiceGuideResult("saude_ja", 2, null, { elicitUrl: async () => "error" });
    if (!res.ok) throw new Error(res.message);
    const o = cityServiceGuideOutput.parse(res.payload);
    expect(o.data.open_step).toEqual({ step: 2, result: "no_answer", url: null, url_host: null });
    expect(o.note).toMatch(/ask the user whether to try this step again/);
  });

  it("client without URL elicitation: falls back to the link and tells the assistant to ask first", async () => {
    const { client, asked } = await clientWith(null);
    const o = cityServiceGuideOutput.parse((await open(client, 2)).structuredContent);
    expect(asked).toHaveLength(0);
    expect(o.data.open_step).toMatchObject({ result: "not_supported", url: "https://saudeja.curitiba.pr.gov.br/" });
    expect(o.note).toMatch(/ask the user in the conversation before/);
  });

  it("a step without a link, or out of range, is invalid_argument and asks nothing", async () => {
    const { client, asked } = await clientWith("accept");
    expect(errorOf(await open(client, 1))).toMatchObject({ error: "invalid_argument" });
    expect(errorOf(await open(client, 4))).toMatchObject({ error: "invalid_argument" });
    expect(errorOf(await open(client, 9))).toMatchObject({ error: "invalid_argument" });
    expect(asked).toHaveLength(0);
  });

  it("a Carta link outside the allowlist is never offered for opening", async () => {
    const bad = carta([{ title: "IPTU sintético", slug: "iptu-x", id: 9201, online: "https://loja.exemplo.com.br/iptu" }]);
    writeFileSync(join(tmp, CATALOG_FILE), JSON.stringify(bad));
    const { client, asked } = await clientWith("accept");
    const res = await client.callTool({ name: "city_service_guide", arguments: { service: "iptu", open_step: 3 } });
    expect(errorOf(res)).toMatchObject({ error: "invalid_argument" });
    expect(asked).toHaveLength(0);
  });
});
