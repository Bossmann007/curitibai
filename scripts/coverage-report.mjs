#!/usr/bin/env node
// Coverage scoreboard for the 1.0 gate (docs/roadmap-1.0.md). Dev only, not in the package; reads, never writes.
// (a) the "Compared with the Curitiba App" table in docs/tools.md: rows by status (data, guide, partial, none, extra);
// (b) the user's local Carta de Serviços copy (CURITIBAI_DATA_DIR/carta-servicos.json, the file city_services_search
//     reads): each service is data (a tool answers it), guide (a hand-written city_service_guide guide, or the guide
//     the tool generates from the copy, counted apart as guide_generated) or none, by the rules below. Absent copy:
//     part (a) only.
// Uncovered services are ranked by usefulness to a Curitiba citizen (usefulness below); their titles go to the terminal only; the JSON summary at the end holds numbers per category (category labels, counts, percentages), never a service title.
// Usage: scripts/coverage-report.mjs [--tools <docs/tools.md>] [--carta <carta-servicos.json>]
// Exit: 0 report printed, 2 an input could not be read or parsed (unknown table status, bad catalog shape, a --carta
// file that does not exist; only the CURITIBAI_DATA_DIR copy may be absent).
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const TOP_UNCOVERED = 30;

/** Same words as city_services_search's queryWords: accents and case folded, split on anything not a letter or digit. */
export function titleWords(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** city_service_guide's Carta queries (GUIDES[id].carta in src/tools/cityServiceGuide.ts; a test keeps them equal). */
export const GUIDE_TERMS = {
  156: [["156"]],
  saude_ja: [["saude", "ja"]],
  iptu: [["iptu"]],
  cartao_transporte: [["cartao", "transporte"]],
  agenda_online: [["agendamento"]],
  creche: [["creche"], ["cadastramento", "escolar"]],
  detran: [["detran"]],
  le_digital: [["le", "digital"]],
  estar: [["estar", "estacionamento", "regulamentado"], ["est", "r", "estacionamento"]],
  defesa_civil: [["alerta", "defesa", "civil"], ["alertas", "defesa", "civil"]],
};

/** city_service_guide's notFor words (GUIDES[id].notFor; a test keeps them equal): such a title skips that guide. */
export const GUIDE_NOT_FOR = {
  estar: [
    "aviso", "avisos", "irregularidade", "irregularidades", "recurso", "recursos", "notificacao", "notificacoes",
    "multa", "multas", "defesa", "credencial", "credenciais",
  ],
};

/**
 * A service city_service_guide's generated guide reaches (carta_id, since 0.37.0): its official page is a Carta
 * service page, the same pattern the tool accepts (OFFICIAL_URL in src/tools/cityServicesSearch.ts; a test keeps them
 * equal) and every such page passes the tool's host allowlist.
 */
export const GENERIC_GUIDE_URL = /^https:\/\/servicos\.curitiba\.pr\.gov\.br\/[a-z0-9-]+\/(\d+)$/;

/**
 * Title rules for "a tool answers it": every word of one term set, as whole title words. Narrow on purpose: a miss
 * counts as none, so the scoreboard understates coverage rather than overstates it.
 */
export const DATA_RULES = [
  { tool: "vaccination_sites_search", terms: [["vacina"], ["vacinas"], ["vacinacao"]] },
  { tool: "health_units_search", terms: [["unidade", "saude"], ["unidades", "saude"]] },
  { tool: "bus_lines_search / bus_departures / bus_line_stops", terms: [["linhas", "onibus"], ["horario", "onibus"], ["horarios", "onibus"], ["itinerario"], ["itinerarios"]] },
  { tool: "bus_stops_near", terms: [["ponto", "onibus"], ["pontos", "onibus"]] },
  {
    tool: "city_facilities_search",
    terms: [
      ["feira"], ["feiras"], ["ecoponto"], ["ecopontos"], ["rua", "cidadania"], ["ruas", "cidadania"],
      ["academia", "ar", "livre"], ["academias", "ar", "livre"], ["biblioteca"], ["bibliotecas"], ["museu"], ["museus"],
      ["teatro"], ["teatros"], ["gibiteca"], ["centro", "cultural"], ["centros", "culturais"], ["parque"], ["parques"],
      ["ciclovia"], ["ciclovias"], ["banheiro", "publico"], ["banheiros", "publicos"],
    ],
  },
  { tool: "events_search", terms: [["agenda", "cultural"], ["eventos"]] },
  { tool: "city_calendar", terms: [["feriado"], ["feriados"], ["calendario", "escolar"]] },
  { tool: "procurement_search", terms: [["licitacao"], ["licitacoes"]] },
  { tool: "open_datasets_search", terms: [["dados", "abertos"]] },
  { tool: "useful_phones", terms: [["telefones", "uteis"]] },
  { tool: "weather_forecast", terms: [["previsao", "tempo"]] },
  { tool: "river_levels", terms: [["nivel", "rios"]] },
  { tool: "place_at_point", terms: [["local", "votacao"], ["locais", "votacao"], ["zoneamento"]] },
  { tool: "tax_reform_curitiba", terms: [["reforma", "tributaria"]] },
];

/** A title with one of these words asks the citizen to act (enrol, request, book, pay): no read-only tool answers it. */
export const ACTION_WORDS = new Set([
  "matricula", "cadastro", "cadastramento", "inscricao", "inscricoes", "solicitacao", "requerimento", "pedido",
  "agendamento", "emissao", "licenca", "alvara", "autorizacao", "denuncia", "permissao", "cessao", "uso", "reserva",
  "locacao", "alteracao", "pagamento", "parcelamento", "isencao", "via",
]);

export const GENERATED_VIA = "city_service_guide carta_id (generated)";

const matches = (words, terms) => terms.some((t) => t.every((w) => words.has(w)));

/**
 * Usefulness to a Curitiba citizen (docs/roadmap-1.0.md): 3 everyday need, 2 other, 1 business-only or internal. Read
 * from the words of the title and the category; a business or internal word wins over an everyday one.
 */
export const EVERYDAY_WORDS = new Set([
  // health
  "saude", "vacina", "vacinas", "vacinacao", "consulta", "consultas", "medicamento", "medicamentos", "farmacia", "upa",
  "ubs", "hospital", "dengue", "zoonoses",
  // transport
  "onibus", "transporte", "estacionamento", "estar", "taxi", "transito", "detran",
  // school
  "escola", "escolas", "escolar", "creche", "cmei", "cmeis", "educacao", "matricula",
  // taxes and documents
  "iptu", "itbi", "tributos", "tributo", "taxa", "taxas", "divida", "certidao", "certidoes", "documento", "documentos",
  "via",
  // social assistance
  "social", "cras", "creas", "beneficio", "beneficios", "auxilio", "cesta", "alimentar", "habitacao", "moradia", "idoso",
  "idosos", "deficiencia",
  // safety
  "guarda", "defesa", "civil", "seguranca", "violencia", "emergencia",
  // waste and utilities
  "lixo", "coleta", "residuos", "reciclagem", "reciclaveis", "ecoponto", "agua", "esgoto", "iluminacao", "poda", "arvore",
  "arvores", "buraco", "pavimentacao", "calcada",
]);
export const BUSINESS_WORDS = new Set([
  "empresa", "empresas", "empresarial", "fornecedor", "fornecedores", "servidor", "servidores", "licitacao",
  "licitacoes", "pregao", "credenciamento", "cnpj", "industria", "industrial", "comercial", "estabelecimento",
  "estabelecimentos", "funcionario", "funcionarios",
]);

export function usefulness(item) {
  const words = new Set([...titleWords(item.title), ...titleWords(item.cat)]);
  if ([...words].some((w) => BUSINESS_WORDS.has(w))) return 1;
  return [...words].some((w) => EVERYDAY_WORDS.has(w)) ? 3 : 2;
}

/**
 * Coverage of one Carta service: data (with the tool), guide (a hand-written guide's id, else the generated guide when
 * its official URL is one the tool reaches) or none.
 */
export function classifyService(title, url) {
  const words = new Set(titleWords(title));
  if (![...words].some((w) => ACTION_WORDS.has(w))) {
    const rule = DATA_RULES.find((r) => matches(words, r.terms));
    if (rule) return { coverage: "data", via: rule.tool };
  }
  const guide = Object.entries(GUIDE_TERMS).find(
    ([id, terms]) => !(GUIDE_NOT_FOR[id] ?? []).some((w) => words.has(w)) && matches(words, terms),
  );
  if (guide) return { coverage: "guide", via: `city_service_guide ${guide[0]}` };
  if (typeof url === "string" && GENERIC_GUIDE_URL.test(url)) return { coverage: "guide", via: GENERATED_VIA };
  return { coverage: "none", via: null };
}

export class InputError extends Error {}

const STATUS = [
  [/^✓/, "data"],
  [/^guide \+ official link/, "guide"],
  [/^partial\b/, "partial"],
  [/^—$/, "none"],
  [/^extra\b/, "extra"],
];

const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
/** Feature name without its source notes: a parenthesis holding a link is dropped, other links keep their text. */
const plain = (md) =>
  md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "\u0000$1")
    .replace(/\s*\([^()]*\u0000[^()]*\)/g, "")
    .replace(/\u0000|\s*\*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Rows of the "Compared with the Curitiba App" table: feature (links removed) and status class. Unknown status throws. */
export function parseAppTable(markdown) {
  const section = markdown.split(/^## Compared with the Curitiba App\s*$/m)[1];
  if (section === undefined) throw new InputError('no "## Compared with the Curitiba App" section');
  const lines = section.split(/^## /m)[0].split("\n");
  const start = lines.findIndex((l) => /^\|\s*Curitiba App feature\s*\|/.test(l));
  if (start < 0) throw new InputError("no Curitiba App comparison table");
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    const [feature = "", status = ""] = cells(line);
    const hit = STATUS.find(([re]) => re.test(status));
    if (!hit) throw new InputError(`unknown status "${status}" in row "${plain(feature)}"`);
    rows.push({ feature: hit[1] === "extra" ? "extra" : plain(feature), status: hit[1] });
  }
  if (rows.length === 0) throw new InputError("the Curitiba App comparison table has no rows");
  return rows;
}

const pct = (n, total) => (total === 0 ? 0 : Math.round((n * 1000) / total) / 10);

/** Part (a): counts by status; the gate counts every non-extra row, covered = data or guide (partial is not covered). */
export function appReport(rows) {
  const count = (s) => rows.filter((r) => r.status === s).length;
  const gated = rows.filter((r) => r.status !== "extra");
  const covered = gated.filter((r) => r.status === "data" || r.status === "guide").length;
  return {
    rows: gated.length,
    data: count("data"),
    guide: count("guide"),
    partial: count("partial"),
    none: count("none"),
    extra: count("extra"),
    covered,
    covered_pct: pct(covered, gated.length),
    not_covered: gated.filter((r) => r.status === "partial" || r.status === "none").map((r) => `${r.feature} (${r.status})`),
  };
}

/** Validates the parts of the catalog this script reads (items with string cat and title); throws InputError otherwise. */
export function cartaItems(json) {
  const items = json?.items;
  if (!Array.isArray(items) || !items.every((x) => typeof x?.cat === "string" && typeof x?.title === "string")) {
    throw new InputError('the catalog has no "items" list of objects with string "cat" and "title"');
  }
  return items;
}

/** Part (b): per category counts and %, overall totals, and the uncovered services (category, title) for the terminal. */
export function cartaReport(items) {
  const byCat = new Map();
  const uncovered = [];
  const generatedOnly = [];
  for (const item of items) {
    const { coverage, via } = classifyService(item.title, item.url);
    const c = byCat.get(item.cat) ?? { category: item.cat, total: 0, data: 0, guide: 0, guide_generated: 0, none: 0 };
    c.total += 1;
    c[coverage] += 1;
    if (via === GENERATED_VIA) {
      c.guide_generated += 1;
      generatedOnly.push({ category: item.cat, title: item.title, usefulness: usefulness(item) });
    }
    byCat.set(item.cat, c);
    if (coverage === "none") uncovered.push({ category: item.cat, title: item.title, usefulness: usefulness(item) });
  }
  const categories = [...byCat.values()]
    .map((c) => ({ ...c, reachable_pct: pct(c.data + c.guide, c.total) }))
    .sort((a, b) => b.none - a.none || a.category.localeCompare(b.category, "pt-BR"));
  const sum = (k) => categories.reduce((n, c) => n + c[k], 0);
  const total = items.length;
  const byUsefulness = (a, b) =>
    b.usefulness - a.usefulness || a.category.localeCompare(b.category, "pt-BR") || a.title.localeCompare(b.title, "pt-BR");
  uncovered.sort(byUsefulness);
  generatedOnly.sort(byUsefulness);
  const tier = (n) => uncovered.filter((u) => u.usefulness === n).length;
  return {
    total,
    data: sum("data"),
    guide: sum("guide"),
    guide_generated: sum("guide_generated"),
    none: sum("none"),
    data_pct: pct(sum("data"), total),
    guide_pct: pct(sum("guide"), total),
    guide_generated_pct: pct(sum("guide_generated"), total),
    none_pct: pct(sum("none"), total),
    reachable_pct: pct(sum("data") + sum("guide"), total),
    reachable_without_generated_pct: pct(sum("data") + sum("guide") - sum("guide_generated"), total),
    uncovered_by_usefulness: { everyday: tier(3), other: tier(2), business_or_internal: tier(1) },
    categories,
    uncovered,
    generated_only: generatedOnly,
  };
}

/** The JSON summary: numbers per category (labels, counts, percentages), never a service title. */
export function summary(app, carta) {
  return {
    app: { ...app },
    carta: carta === null ? null : Object.fromEntries(Object.entries(carta).filter(([k]) => k !== "uncovered" && k !== "generated_only")),
  };
}

function parseArgs(argv, env) {
  const opts = { tools: join(fileURLToPath(new URL("..", import.meta.url)), "docs", "tools.md"), carta: null, explicit: false };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if ((flag !== "--tools" && flag !== "--carta") || value === undefined || value.startsWith("--")) {
      throw new InputError(`usage: coverage-report.mjs [--tools <file>] [--carta <file>] (got "${flag}")`);
    }
    opts[flag.slice(2)] = value;
  }
  opts.explicit = opts.carta !== null;
  if (opts.carta === null && env.CURITIBAI_DATA_DIR) opts.carta = join(env.CURITIBAI_DATA_DIR, "carta-servicos.json");
  return opts;
}

function readInput(path, what) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new InputError(`cannot read ${what} (${e?.code ?? "error"})`);
  }
}

/** Null when the CURITIBAI_DATA_DIR copy is absent (part (b) skipped); a missing --carta file is an error (exit 2). */
function readCarta(path, explicit) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if (e?.code === "ENOENT" && !explicit) return null;
    throw new InputError(`cannot read the catalog (${e?.code ?? "error"})`);
  }
  try {
    return cartaItems(JSON.parse(text));
  } catch (e) {
    throw e instanceof InputError ? e : new InputError("the catalog is not valid JSON");
  }
}

export function main(argv, env = process.env, out = console.log, err = console.error) {
  try {
    const opts = parseArgs(argv, env);
    const app = appReport(parseAppTable(readInput(opts.tools, "the tools table")));
    out(`Curitiba App comparison (docs/tools.md): ${app.rows} rows, ${app.covered} covered (${app.covered_pct}%)`);
    out(`  data ${app.data} | guide ${app.guide} | partial ${app.partial} | none ${app.none} | extras ${app.extra}`);
    for (const f of app.not_covered) out(`  not covered: ${f}`);
    const items = opts.carta === null ? null : readCarta(opts.carta, opts.explicit);
    let carta = null;
    if (items === null) {
      out(opts.carta === null ? "Carta de Serviços: CURITIBAI_DATA_DIR not set and no --carta; part (b) skipped" : "Carta de Serviços: no carta-servicos.json in CURITIBAI_DATA_DIR; part (b) skipped");
    } else {
      carta = cartaReport(items);
      out(`Carta de Serviços (local copy): ${carta.total} services, reachable ${carta.reachable_pct}%`);
      out(`  data ${carta.data} (${carta.data_pct}%) | guide ${carta.guide} (${carta.guide_pct}%; generated ${carta.guide_generated}) | none ${carta.none} (${carta.none_pct}%)`);
      for (const c of carta.categories) out(`  ${c.category}: ${c.total} | data ${c.data} | guide ${c.guide} (generated ${c.guide_generated}) | none ${c.none} | reachable ${c.reachable_pct}%`);
      const t = carta.uncovered_by_usefulness;
      out(`  uncovered by usefulness: everyday ${t.everyday} | other ${t.other} | business or internal ${t.business_or_internal}`);
      out(`Top ${TOP_UNCOVERED} uncovered services by usefulness to a citizen (3 everyday, 2 other, 1 business; local titles, terminal only):`);
      for (const u of carta.uncovered.slice(0, TOP_UNCOVERED)) out(`  ${u.usefulness} [${u.category}] ${u.title}`);
      out(`  reachable without generated guides ${carta.reachable_without_generated_pct}%`);
      out(`Top ${TOP_UNCOVERED} services reached only by the generated guide, by usefulness (candidates for a hand-written guide; terminal only):`);
      for (const u of carta.generated_only.slice(0, TOP_UNCOVERED)) out(`  ${u.usefulness} [${u.category}] ${u.title}`);
    }
    out("JSON summary (numbers per category):");
    out(JSON.stringify(summary(app, carta), null, 2));
    return 0;
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    err(`coverage-report: FAIL: ${e.message}`);
    return 2;
  }
}

// Run as a script (also through a symlink), not when the tests import it.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
