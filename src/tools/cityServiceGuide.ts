import { z } from "zod";
import { FileTooLargeError, LocalFileError } from "../localfs.js";
import { fail, ok, type ToolContext, type ToolDef } from "./common.js";
import {
  CATALOG_FILE,
  CITY_SERVICES_SOURCE_URL,
  InvalidCatalogError,
  loadCatalog,
  OBITUARY_HOST,
  queryWords,
  type Catalog,
} from "./cityServicesSearch.js";

/**
 * Hosts a step link may point to (docs/adr/0010). Exact hosts, plus any subdomain of curitiba.pr.gov.br (the
 * Prefeitura's zone) except the obituary system. How each was checked: docs/tools.md, `city_service_guide`.
 */
export const EXACT_HOSTS: readonly string[] = ["www.detran.pr.gov.br", "www.agendamento.detran.pr.gov.br", "www.gov.br"];
export const CITY_ZONE = "curitiba.pr.gov.br";

/**
 * Backslash, whitespace and control characters: WHATWG URL parsing strips or rewrites them, so the raw text could be
 * read with another host by a different parser (`https://www.gov.br\\@evil.com/` is evil.com to RFC 3986).
 */
const UNSAFE_RAW = /[\\\s\x00-\x20\x7f]/;

/**
 * The normalized URL (`URL.href`) when `raw` is an https URL on an allowed host, with no credentials, no port, no
 * punycode label and no character that parsers read differently; else null. Only the normalized form is ever emitted.
 */
export function allowedUrl(raw: string): string | null {
  if (UNSAFE_RAW.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username !== "" || u.password !== "" || u.port !== "") return null;
  const host = u.hostname.toLowerCase();
  if (host.split(".").some((label) => label.startsWith("xn--"))) return null;
  if (host === OBITUARY_HOST || host.endsWith(`.${OBITUARY_HOST}`)) return null;
  return EXACT_HOSTS.includes(host) || host.endsWith(`.${CITY_ZONE}`) ? u.href : null;
}

export function isAllowedUrl(raw: string): boolean {
  return allowedUrl(raw) !== null;
}

/** Date the guides were written and their fixed links checked (see docs/tools.md). */
export const GUIDES_CHECKED_AT = "2026-11-24";

export const AUTORIZACAO_DIGITAL_URL =
  "https://www.curitiba.pr.gov.br/noticias/prefeitura-de-curitiba-ganha-dois-premios-por-inovacoes-digitais-na-gestao-urbana/80104";

const DELEGATION =
  "Autorização Digital: segundo a Prefeitura (notícia de 2025-10-26), o cidadão pode autorizar, no e-Cidadão, outra " +
  "pessoa ou empresa a usar serviços em seu nome. Quem faz isso é o cidadão, no e-Cidadão; o CuritibAI não faz nem " +
  "verifica essa autorização.";

/** Where a step's link comes from: a fixed official URL, or the matched service of the user's Carta copy. */
type LinkRef = { fixed: string } | "carta_page" | "carta_online" | null;

interface StepDef {
  action: string;
  /** Plain-Portuguese description of what will happen; set exactly when the step leaves the conversation. */
  consent?: string;
  /** What the citizen will type on the official site (never in the conversation). */
  types?: string[];
  link?: LinkRef;
}

interface GuideDef {
  title: string;
  what: string;
  /** Alternative title queries for the Carta copy; every word of one query must be in the service title. */
  carta: string[][];
  steps: StepDef[];
}

const FIRST_STEP: StepDef = {
  action:
    "Pergunte ao cidadão o que ele quer fazer e se quer seguir este guia. Não peça nesta conversa CPF, senha, cartão, " +
    "endereço nem outro dado pessoal: esses dados ele digita só no site oficial.",
};

const LOGIN_ECIDADAO: StepDef = {
  action: "Entrar no site com a conta e-Cidadão, se o site pedir.",
  consent:
    "O cidadão entra com a conta e-Cidadão: ele mesmo digita CPF e senha no site oficial. O assistente não digita a senha.",
  types: ["CPF (ou cartão SUS no Saúde Já)", "senha do e-Cidadão"],
};

const CARTA_PAGE: StepDef = {
  action: "Abrir a página oficial do serviço na Carta de Serviços da Prefeitura e ler os requisitos.",
  consent: "Abrir a página oficial do serviço no site da Prefeitura, no navegador do cidadão. Nada é digitado.",
  link: "carta_page",
};

const CHOOSE_TIME: StepDef = {
  action: "Escolher o serviço, o dia e o horário entre as opções do site.",
  consent: "O cidadão escolhe o serviço, o dia e o horário no site oficial. Nada é enviado nesta etapa.",
  types: ["escolha de serviço, dia e horário"],
};

const PAY: StepDef = {
  action: "Pagar, se houver valor a pagar.",
  consent:
    "O cidadão paga por conta própria, no banco, no app do banco ou por PIX. O assistente nunca digita dados de " +
    "cartão, senha de banco ou código PIX.",
  types: ["dados de pagamento, só no banco"],
};

export const GUIDES = {
  "156": {
    title: "Central 156: pedido, informação, denúncia ou elogio",
    what: "Canal de atendimento da Prefeitura; também pelo telefone 156.",
    carta: [["156"]],
    steps: [
      FIRST_STEP,
      {
        action: "Abrir o site oficial da Central 156.",
        consent: "Abrir 156.curitiba.pr.gov.br no navegador do cidadão. Nada é digitado.",
        link: { fixed: "https://156.curitiba.pr.gov.br/" },
      },
      LOGIN_ECIDADAO,
      {
        action: "Abrir o formulário \"Abrir Pedido\" do site da Central 156.",
        consent: "Abrir o formulário \"Abrir Pedido\" em 156.curitiba.pr.gov.br no navegador do cidadão. Nada é digitado.",
        link: { fixed: "https://156.curitiba.pr.gov.br/Solicitacao/Abra-sua-solicitacao-servico-informacao-na-prefeitura-de-curitiba" },
      },
      {
        action: "Escrever o pedido no formulário junto com o cidadão.",
        consent:
          "O cidadão escreve no formulário oficial a descrição do pedido e, se o site pedir, o endereço do local. " +
          "Revise o texto com ele antes de seguir.",
        types: ["descrição do pedido", "endereço do local, se o site pedir"],
      },
      {
        action: "Enviar o pedido e anotar o protocolo.",
        consent: "Enviar o pedido à Prefeitura. Só se o cidadão confirmar; ele anota o número de protocolo que o site mostrar.",
      },
    ],
  },
  saude_ja: {
    title: "Saúde Já: agendar o primeiro atendimento na Unidade de Saúde",
    what: "Agendamento do primeiro atendimento na Unidade Municipal de Saúde. Emergência: SAMU 192.",
    carta: [["saude", "ja"]],
    steps: [
      FIRST_STEP,
      {
        action: "Abrir o site oficial do Saúde Já.",
        consent: "Abrir saudeja.curitiba.pr.gov.br no navegador do cidadão. Nada é digitado.",
        link: { fixed: "https://saudeja.curitiba.pr.gov.br/" },
      },
      LOGIN_ECIDADAO,
      CHOOSE_TIME,
      {
        action: "Confirmar o agendamento e anotar o comprovante.",
        consent: "Confirmar o agendamento no site oficial. Só se o cidadão confirmar.",
      },
    ],
  },
  iptu: {
    title: "IPTU: guia, segunda via e pagamento",
    what: "Imposto do imóvel. Prazos e descontos de 2026: city_calendar com topic \"iptu\".",
    carta: [["iptu"]],
    steps: [
      FIRST_STEP,
      CARTA_PAGE,
      {
        action: "Abrir o serviço online indicado pela página oficial do serviço.",
        consent: "Abrir o serviço online oficial no navegador do cidadão. Nada é digitado.",
        link: "carta_online",
      },
      {
        action: "Digitar no serviço online os dados do imóvel.",
        consent: "O cidadão digita no site oficial os dados do imóvel que o site pedir. Nada é emitido nem enviado nesta etapa.",
        types: ["dados do imóvel que o site pedir"],
      },
      {
        action: "Emitir a guia.",
        consent: "Emitir a guia no site oficial. Só se o cidadão confirmar.",
      },
      PAY,
    ],
  },
  cartao_transporte: {
    title: "Cartão Transporte: cartão e créditos",
    what: "Cartão do transporte coletivo de Curitiba. A página oficial do serviço diz onde fazer cada coisa.",
    carta: [["cartao", "transporte"]],
    steps: [
      FIRST_STEP,
      CARTA_PAGE,
      {
        action: "Abrir o site da URBS e procurar ali o Cartão Transporte.",
        consent: "Abrir www.urbs.curitiba.pr.gov.br no navegador do cidadão. Nada é digitado.",
        link: { fixed: "https://www.urbs.curitiba.pr.gov.br/" },
      },
      {
        action: "Entrar no site oficial, se ele pedir login.",
        consent: "O cidadão digita o login no site oficial. O assistente não digita a senha.",
        types: ["login que o site pedir"],
      },
      {
        action: "Informar no site oficial os dados do cartão, se o serviço pedir.",
        consent: "O cidadão digita no site oficial os dados do cartão que o site pedir. Nada é pago nesta etapa.",
        types: ["dados do cartão que o site pedir"],
      },
      PAY,
    ],
  },
  agenda_online: {
    title: "Agenda Online: agendar atendimento na Prefeitura",
    what: "Agendamento online da Prefeitura; os serviços que podem ser agendados aparecem no próprio site.",
    carta: [["agendamento"]],
    steps: [
      FIRST_STEP,
      {
        action: "Abrir a Agenda Online oficial.",
        consent: "Abrir agendaonline.curitiba.pr.gov.br no navegador do cidadão. Nada é digitado.",
        link: { fixed: "https://agendaonline.curitiba.pr.gov.br/" },
      },
      {
        action: "Escolher o serviço, o local e o horário.",
        consent: "O cidadão escolhe o serviço, o local e o horário no site oficial. Nada é enviado nesta etapa.",
        types: ["escolha de serviço, local, dia e horário"],
      },
      {
        action: "Digitar no site os dados de identificação que ele pedir.",
        consent: "O cidadão digita no site oficial os dados que ele pedir para identificá-lo. O assistente não digita esses dados.",
        types: ["dados de identificação que o site pedir"],
      },
      {
        action: "Confirmar o agendamento e anotar o comprovante.",
        consent: "Confirmar o agendamento no site oficial. Só se o cidadão confirmar.",
      },
    ],
  },
  creche: {
    title: "Creche (CMEI): cadastro para vaga",
    what: "Cadastro para vaga em creche e cadastro escolar da rede municipal.",
    carta: [["creche"], ["cadastramento", "escolar"]],
    steps: [
      FIRST_STEP,
      CARTA_PAGE,
      {
        action:
          "Abrir o portal oficial da Educação. O menu tem \"Cadastro Online\" e \"Cadastramento Escolar\"; confira na " +
          "página oficial do serviço qual deles é o cadastro para vaga em creche.",
        consent: "Abrir educacao.curitiba.pr.gov.br no navegador do cidadão. Nada é digitado.",
        link: { fixed: "https://educacao.curitiba.pr.gov.br/" },
      },
      {
        action: "Preencher o cadastro no site oficial.",
        consent: "O cidadão digita no site oficial os dados da criança e do responsável que o site pedir. Só se ele confirmar.",
        types: ["dados da criança e do responsável que o site pedir"],
      },
      {
        action: "Enviar o cadastro e guardar o comprovante.",
        consent: "Enviar o cadastro à Prefeitura. Só se o cidadão confirmar.",
      },
    ],
  },
  detran: {
    title: "Detran-PR: serviços online e agendamento",
    what: "Serviços do Detran-PR. Calendário de licenciamento e unidades: detran_pr_info.",
    carta: [["detran"]],
    steps: [
      FIRST_STEP,
      {
        action: "Abrir o site oficial do Detran-PR e achar o serviço.",
        consent: "Abrir www.detran.pr.gov.br no navegador do cidadão. Nada é digitado.",
        link: { fixed: "https://www.detran.pr.gov.br/" },
      },
      {
        action: "Abrir o Portal de Serviços / Agendar Atendimento do Detran-PR.",
        consent: "Abrir o portal de agendamento do Detran-PR (www.agendamento.detran.pr.gov.br). Nada é digitado.",
        link: { fixed: "https://www.agendamento.detran.pr.gov.br/detran-agendamento/portal" },
      },
      {
        action: "Entrar no portal.",
        consent: "O cidadão entra no portal oficial e digita ali o login que ele pedir. O assistente não digita a senha.",
        types: ["login do portal"],
      },
      CHOOSE_TIME,
      {
        action: "Confirmar o pedido ou o agendamento e anotar o comprovante.",
        consent: "Confirmar o pedido ou o agendamento no site oficial. Só se o cidadão confirmar.",
      },
      PAY,
    ],
  },
} as const satisfies Record<string, GuideDef>;

export type GuideId = keyof typeof GUIDES;
export const GUIDE_IDS = Object.keys(GUIDES) as [GuideId, ...GuideId[]];

const CONSENT_RULE =
  "Consent rule: one step at a time. Before each step with needs_consent true, show its consent text to the user " +
  "and wait for an explicit yes; if the user does not confirm, stop. Never type passwords, CPF or payment data for " +
  "the user, and never ask for them in the conversation: the user types them only on the official site. This server " +
  "never logs in, submits or opens anything; open_step asks the user's client to show the link for approval.";

export const cityServiceGuideInput = {
  service: z.enum(GUIDE_IDS).describe("Which service guide."),
  open_step: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Ask the user's client to confirm opening this step's link (URL-mode elicitation); else returns the link."),
};

const Step = z.object({
  step: z.number().int(),
  action: z.string(),
  needs_consent: z.boolean(),
  consent: z.string().nullable(),
  citizen_types_on_site: z.array(z.string()),
  url: z.string().url().nullable(),
  url_host: z.string().nullable(),
  link_source: z.enum(["official_allowlist", "carta_copy"]).nullable(),
});

const CartaMatch = z.object({ title: z.string(), official_url: z.string().url() });

export const cityServiceGuideOutput = z.object({
  data: z.object({
    service: z.enum(GUIDE_IDS),
    title: z.string(),
    what: z.string(),
    steps: z.array(Step).optional(),
    carta: z.object({
      status: z.enum(["matched", "ambiguous", "no_match", "not_available", "invalid"]),
      matches: z.array(CartaMatch),
      message: z.string().nullable(),
    }),
    delegation: z.object({ text: z.string(), source_url: z.string().url() }),
    open_step: z
      .object({
        step: z.number().int(),
        result: z.enum(["accepted", "declined", "cancelled", "no_answer", "not_supported"]),
        url: z.string().url().nullable(),
        url_host: z.string().nullable(),
      })
      .optional(),
  }),
  source_url: z.string().url(),
  checked_at: z.string().date(),
  license_note: z.string(),
  note: z.string(),
});

type CartaInfo = z.infer<typeof cityServiceGuideOutput>["data"]["carta"];
type StepOut = z.infer<typeof Step>;
interface CartaLinks {
  page: string | null;
  online: string | null;
}

const CARTA_HOW_TO =
  `Without the local catalog copy the Carta links are left out. To add them, open ${CITY_SERVICES_SOURCE_URL} in a ` +
  `browser and save the listing yourself as ${CATALOG_FILE} in the folder set by CURITIBAI_DATA_DIR (shape and steps: ` +
  "docs/local-data.md, \"Finding a city service\"). The server never downloads it.";

/** Services of the user's Carta copy whose title has every word of one of the guide's queries, as whole words. */
export function matchCarta(catalog: Catalog, queries: readonly (readonly string[])[]) {
  const words = queries.map((q) => queryWords(q.join(" ")));
  return catalog.services
    .filter((s) => {
      const title = new Set(queryWords(s.title));
      return words.some((ws) => ws.every((w) => title.has(w)));
    })
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR") || a.id - b.id);
}

/** Longest Carta title returned: it is local-file text placed next to the consent rules. */
export const MAX_MATCH_TITLE = 120;
const clip = (t: string) => (t.length > MAX_MATCH_TITLE ? `${t.slice(0, MAX_MATCH_TITLE - 1)}…` : t);

/** Carta status and links for one guide. Links pass the allowlist or are left out; ambiguous matches give no link. */
export function cartaFor(catalog: Catalog | Error | null, guide: GuideDef): { info: CartaInfo; links: CartaLinks } {
  const none: CartaLinks = { page: null, online: null };
  if (catalog === null) return { info: { status: "not_available", matches: [], message: CARTA_HOW_TO }, links: none };
  if (catalog instanceof Error) return { info: { status: "invalid", matches: [], message: catalog.message }, links: none };
  // Each match's official_url passes the allowlist here (normalized), not only in the module that read the copy: a
  // match whose URL fails it is dropped. Ambiguity still counts every title match, so dropping one never turns two
  // candidates into a single confident link.
  const all = matchCarta(catalog, guide.carta);
  const found = all.flatMap((s) => {
    const official = allowedUrl(s.official_url);
    return official === null ? [] : [{ ...s, official_url: official }];
  });
  const matches = found.slice(0, 3).map((s) => ({ title: clip(s.title), official_url: s.official_url }));
  if (all.length === 0) {
    return { info: { status: "no_match", matches, message: "No service in the local Carta copy matched this guide." }, links: none };
  }
  if (all.length === 1 && found.length === 0) {
    const message =
      "1 service in the local Carta copy matched, but its link is not on the official-host allowlist; no Carta link " +
      "is given.";
    return { info: { status: "no_match", matches, message }, links: none };
  }
  if (all.length > 1) {
    const refused = found.length === 0 ? " none of their links is on the official-host allowlist, so" : "";
    const message =
      `${all.length} services in the local Carta copy match;${refused} no Carta link is given. Ask the user which one ` +
      "(matches, at most 3) or use city_services_search.";
    return { info: { status: "ambiguous", matches, message }, links: none };
  }
  const s = found[0]!;
  return {
    info: { status: "matched", matches, message: null },
    links: {
      page: allowedUrl(s.official_url),
      online: s.online_url === null ? null : allowedUrl(s.online_url),
    },
  };
}

/** The guide's steps with links resolved; any link that fails the allowlist becomes null. */
export function buildSteps(guide: GuideDef, links: CartaLinks): StepOut[] {
  return guide.steps.map((s, i) => {
    let url: string | null = null;
    let source: StepOut["link_source"] = null;
    if (s.link === "carta_page") {
      // Without a Carta match, the catalog listing itself (the user searches the service there).
      url = links.page ?? CITY_SERVICES_SOURCE_URL;
      source = links.page !== null ? "carta_copy" : "official_allowlist";
    } else if (s.link === "carta_online") {
      url = links.online;
      source = url !== null ? "carta_copy" : null;
    } else if (s.link) {
      url = s.link.fixed;
      source = "official_allowlist";
    }
    if (url !== null) url = allowedUrl(url);
    if (url === null) source = null;
    return {
      step: i + 1,
      action: s.action,
      needs_consent: s.consent !== undefined,
      consent: s.consent ?? null,
      citizen_types_on_site: [...(s.types ?? [])],
      url,
      url_host: url === null ? null : new URL(url).hostname,
      link_source: source,
    };
  });
}

const LICENSE_NOTE =
  "Guides written by this project from the official sites named in each step (checked " + GUIDES_CHECKED_AT + "); " +
  "Carta links come from your local copy of the Prefeitura's Carta de Serviços. Unofficial; not affiliated with the " +
  "Prefeitura de Curitiba, URBS or Detran-PR. The sites may change: follow what the official page says.";

async function readCatalog(): Promise<Catalog | Error | null> {
  try {
    return await loadCatalog();
  } catch (err) {
    if (err instanceof LocalFileError) return err.code === "file_not_allowed" ? new Error(`${CATALOG_FILE} is not allowed (see docs/local-data.md).`) : null;
    if (err instanceof FileTooLargeError) return new Error(`${CATALOG_FILE} is too large.`);
    if (err instanceof InvalidCatalogError) return err;
    return new Error(`${CATALOG_FILE} could not be read.`);
  }
}

/** Fixed server text for the elicitation: the guide's own words and the link's host, never Carta text. */
export function elicitationMessage(guide: GuideDef, step: number, host: string): string {
  const def = guide.steps[step - 1]!;
  return (
    `CuritibAI, guia "${guide.title}", passo ${step}: abrir ${host} no seu navegador? ${def.consent ?? ""} ` +
    "Você digita seus dados só no site oficial."
  );
}

const ELICITATION_RESULT = { accept: "accepted", decline: "declined", cancel: "cancelled" } as const;

export async function cityServiceGuideResult(
  id: GuideId,
  openStep: number | undefined,
  catalog: Catalog | Error | null,
  ctx: ToolContext | undefined,
) {
  const guide: GuideDef = GUIDES[id];
  const { info, links } = cartaFor(catalog, guide);
  const steps = buildSteps(guide, links);
  const base: { service: GuideId; title: string; what: string; carta: CartaInfo; delegation: { text: string; source_url: string } } = {
    service: id,
    title: guide.title,
    what: guide.what,
    carta: info,
    delegation: { text: DELEGATION, source_url: AUTORIZACAO_DIGITAL_URL },
  };
  const envelope = { source_url: CITY_SERVICES_SOURCE_URL, checked_at: GUIDES_CHECKED_AT, license_note: LICENSE_NOTE };
  if (openStep === undefined) return { ok: true as const, payload: { data: { ...base, steps }, ...envelope, note: CONSENT_RULE } };

  const step = steps[openStep - 1];
  if (!step) return { ok: false as const, message: `open_step must be between 1 and ${steps.length} for this guide.` };
  if (step.url === null || step.url_host === null) {
    return { ok: false as const, message: `Step ${openStep} has no link to open (call without open_step to see the steps).` };
  }
  // Only the status: matches carry official_url, the very link the user may refuse.
  base.carta = { status: info.status, matches: [], message: null };
  const answer = ctx ? await ctx.elicitUrl(elicitationMessage(guide, openStep, step.url_host), step.url) : "unsupported";
  const result = answer === "unsupported" ? "not_supported" : answer === "error" ? "no_answer" : ELICITATION_RESULT[answer];
  // The link is returned only when the user accepted, or when the client cannot ask (then the assistant must ask).
  const showLink = result === "accepted" || result === "not_supported";
  const note =
    result === "accepted"
      ? "The user approved opening this link in their client. Wait for them before the next step. "
      : result === "not_supported"
        ? "This client cannot show a consent prompt: ask the user in the conversation before giving or opening the link. "
        : result === "no_answer"
          ? "No answer from the user in time: do not give or open the link; ask the user whether to try this step again. "
          : "The user did not approve: stop here and do not give or open the link. ";
  return {
    ok: true as const,
    payload: {
      data: {
        ...base,
        open_step: { step: openStep, result, url: showLink ? step.url : null, url_host: showLink ? step.url_host : null },
      },
      ...envelope,
      note: note + CONSENT_RULE,
    },
  };
}

export const cityServiceGuide: ToolDef<typeof cityServiceGuideInput, typeof cityServiceGuideOutput> = {
  name: "city_service_guide",
  title: "Guide to a Curitiba service that needs a login",
  description:
    "Steps and official links to use a city service that needs a login. Never logs in or submits. Ask the user " +
    "before each needs_consent step; never type their passwords or payment data.",
  inputSchema: cityServiceGuideInput,
  outputSchema: cityServiceGuideOutput,
  handler: async (args, ctx) => {
    const res = await cityServiceGuideResult(args.service, args.open_step, await readCatalog(), ctx);
    return res.ok ? ok(res.payload) : fail("invalid_argument", res.message);
  },
};
