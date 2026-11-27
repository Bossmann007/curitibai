import { z } from "zod";
import { cleanPointField, THEMATIC_SERVICE_URL, VOTING_CREDIT, type Point, type PointFeature, type PointReads } from "../sources/geocuritiba.js";
import { FACILITIES_LICENSE_NOTE } from "./cityFacilitiesSearch.js";
import { OutOfTimeError } from "../hostGate.js";
import { SourceRefusedError } from "../http.js";

export const SERVICE_AREAS_SOURCE = "Fonte: IPPUC/GeoCuritiba (SMS e FAS)";
export const SAFETY_AREAS_SOURCE = "Fonte: IPPUC/GeoCuritiba (PMPR, PCPR e CBMPR)";
export const REGISTRY_AREAS_SOURCE = "Fonte: IPPUC/GeoCuritiba (circunscrições imobiliárias e registro civil)";
const MAX_AREAS = 3;

const referenceDate = z
  .string()
  .nullable()
  .describe("The area's reference date as published (`data`), e.g. \"março/2022\" or \"MAR-2019\"; the area may have changed since.");
const sourceAgency = z.string().nullable().describe("Agency named by the area (`fonte`), e.g. \"SMS-PMC\" or \"Fundação de Ação Social - FAS\".");
const approximate = z.boolean().nullable().describe("`geometriaaproximada` as published: true when the area's outline is marked approximate; null when unset.");

const HealthArea = z.object({
  name: z.string().nullable().describe("Health unit (unidade de saúde) whose area covers the point, e.g. \"US MÃE CURITIBANA\"."),
  district: z.string().nullable().describe("Sanitary district (distrito sanitário), e.g. \"MATRIZ\"."),
  reference_date: referenceDate,
  source_agency: sourceAgency,
  approximate,
});

const CrasArea = z.object({
  name: z.string().nullable().describe("CRAS whose territory covers the point, e.g. \"MATRIZ\"."),
  type: z.string().nullable().describe("Type as published (`tipo`), e.g. \"CRAS\"."),
  regional: z.string().nullable().describe("Regional (administrative region) as published (`regional`), e.g. \"MATRIZ\"."),
  reference_date: referenceDate,
  source_agency: sourceAgency,
  approximate,
});

const PoliceMilitaryArea = z.object({
  battalion: z.string().nullable().describe("Battalion as published (`nm_batalhao`), e.g. \"12º Batalhão\"."),
  battalion_code: z.string().nullable().describe("`sg_batalhao`, e.g. \"12º BPM\"."),
  company: z.string().nullable().describe("Company as published (`nm_companhia`), e.g. \"1ª Companhia\"."),
  company_code: z.string().nullable().describe("`sg_companhia`, e.g. \"1ª CIA\"."),
  reference_date: z.string().nullable().describe("`data_atualizacao` as published, e.g. \"09/2025\"."),
  source_agency: sourceAgency,
});

const PoliceCivilArea = z.object({
  district: z.string().nullable().describe("Police district as published (`nm_distrito`), e.g. \"3º Distrito Policial\"."),
  district_code: z.string().nullable().describe("`sg_distrito`, e.g. \"3º DP\"."),
  division: z.string().nullable().describe("`nm_divisao`, e.g. \"Divisão Policial da Capital\"."),
  source_agency: sourceAgency,
});

const FireArea = z.object({
  platoon: z.string().nullable().describe("Fire platoon as published (`pelotao`), e.g. \"Pelotão de Bombeiro Central\"."),
  platoon_code: z.string().nullable().describe("`sigla`, e.g. \"1ª Pel. BM\"."),
  company: z.string().nullable().describe("`companhia`, e.g. \"3º Companhia de Bombeiros\"."),
  battalion: z.string().nullable().describe("`batalhao`, e.g. \"1° Batalhão de Bombeiro Militar - Curitiba\"."),
  source_agency: sourceAgency,
});

const legalBasis = z.string().nullable().describe("`fonte` as published: the legal basis of the area, e.g. \"Tribunal de Justiça, 1968\"; it may have changed since.");

const PropertyRegistryArea = z.object({
  circumscription: z.string().nullable().describe("Circunscrição imobiliária (registro de imóveis) as published (`circunscricao`), e.g. \"6ª CIRCUNSCRIÇÃO\"."),
  legal_basis: legalBasis,
});

const CivilRegistryArea = z.object({
  service: z.string().nullable().describe("Registro civil serviço as published (`servicos`), e.g. \"4º SERVIÇO DE REGISTRO CIVIL\"."),
  legal_basis: legalBasis,
});

const count = z.number().int().nullable();
const ElectoralZone = z.object({
  zone: z.string().nullable().describe("Electoral zone as published (`zona_eleitoral`), e.g. \"174ª\"."),
  polling_places: count.describe("Voting places in the zone as published (`num_locais`)."),
  sections: count.describe("Voting sections in the zone as published (`num_secoes`)."),
  reference_date: z.string().nullable().describe("`data_alteracao` as published, day/month/year, e.g. \"31/08/2026\"; the counts are as of that date."),
});

const UNREAD_FIRST = " Empty: none covers the point. Null: not read (its group not asked, or its layer not read; see `partial`).";
const UNREAD = " Empty: none covers the point. Null: not read (its group not asked, its layer not asked outside Curitiba, or not read; see `partial`).";

export const serviceAreasAtPointOutput = z.object({
  data: z.object({
    lat: z.number().describe("The point rounded to 4 decimals (about 11 m): the only precision sent to the source."),
    lon: z.number(),
    areas: z.enum(["care", "safety", "registry", "civic", "all"]).describe("Which areas were asked (`all`: care and safety)."),
    inside_curitiba: z
      .boolean()
      .describe(
        "True when the first layer asked (health unit area; Polícia Militar company for `safety`; circunscrição for " +
          "`registry`; electoral zone for `civic`) or, when it has none, a Curitiba neighbourhood contains the point; false otherwise (a " +
          "neighbouring city), and then no other layer is asked.",
      ),
    health_units: z.array(HealthArea).nullable().describe(`\`care\`: health unit areas containing the point (distinct, by name, at most ${MAX_AREAS}).${UNREAD_FIRST}`),
    cras: z.array(CrasArea).nullable().describe(`\`care\`: CRAS territories containing the point (distinct, by name, at most ${MAX_AREAS}).${UNREAD}`),
    police_military: z.array(PoliceMilitaryArea).nullable().describe(`\`safety\`: Polícia Militar company areas containing the point (at most ${MAX_AREAS}).${UNREAD_FIRST}`),
    police_civil: z.array(PoliceCivilArea).nullable().describe(`\`safety\`: Polícia Civil district areas containing the point (at most ${MAX_AREAS}).${UNREAD}`),
    fire: z.array(FireArea).nullable().describe(`\`safety\`: fire platoon areas containing the point (at most ${MAX_AREAS}).${UNREAD}`),
    property_registry: z.array(PropertyRegistryArea).nullable().describe(`\`registry\`: circunscrição imobiliária areas containing the point (at most ${MAX_AREAS}); null with \`all\` (ask \`registry\`).${UNREAD_FIRST}`),
    civil_registry: z.array(CivilRegistryArea).nullable().describe(`\`registry\`: registro civil serviço areas containing the point (at most ${MAX_AREAS}); null with \`all\`.${UNREAD}`),
    electoral_zones: z.array(ElectoralZone).nullable().describe(`\`civic\`: TRE-PR electoral zones containing the point (at most ${MAX_AREAS}); null with \`all\` (ask \`civic\`).${UNREAD_FIRST}`),
    partial: z.boolean().describe("True when a layer of a group asked could not be read; its list is then null."),
  }),
  source: z.string(),
  source_url: z.string().url(),
  checked_at: z.string().datetime().describe("When the server read the oldest layer used (cached for up to 6 hours)."),
  license_note: z.string(),
  note: z.string(),
});

type Output = z.infer<typeof serviceAreasAtPointOutput>;
type Data = Output["data"];
type Lists = Omit<Data, "lat" | "lon" | "areas" | "inside_curitiba" | "partial">;

/** Every list not read is null; a group sets only its own. Key order is the schema's (an override keeps its place). */
const NO_LISTS: Lists = {
  health_units: null,
  cras: null,
  police_military: null,
  police_civil: null,
  fire: null,
  property_registry: null,
  civil_registry: null,
  electoral_zones: null,
};
const areasData = (p: Point, areas: Data["areas"], inside: boolean, lists: Partial<Lists>, partial: boolean): Data => ({
  lat: p.lat,
  lon: p.lon,
  areas,
  inside_curitiba: inside,
  ...NO_LISTS,
  ...lists,
  partial,
});
type HealthOut = z.infer<typeof HealthArea>;
type CrasOut = z.infer<typeof CrasArea>;
type PmOut = z.infer<typeof PoliceMilitaryArea>;
type CivilOut = z.infer<typeof PoliceCivilArea>;
type FireOut = z.infer<typeof FireArea>;
type PropertyOut = z.infer<typeof PropertyRegistryArea>;
type CivilRegOut = z.infer<typeof CivilRegistryArea>;
type ZoneOut = z.infer<typeof ElectoralZone>;

const NOTE =
  "Care areas (by SMS and FAS): each area is as of its `reference_date` and may have changed since: confirm with the " +
  "unit, the CRAS or 156 before going.";

const SAFETY_NOTE =
  "Safety areas (by PMPR, PCPR and CBMPR). Not for emergencies: call 190 (police) or 193 (fire). An area names who " +
  "covers the point, not the nearest station; areas change: confirm with the police or fire service.";

const REGISTRY_NOTE =
  "Registry areas as IPPUC publishes them, with their legal basis; they may have changed since. They name which " +
  "circunscrição imobiliária (registro de imóveis) and which registro civil serviço cover the point, not the office's " +
  "address, and this does not replace a certidão from the registry itself. Registro civil offices: city_facilities_search " +
  "type \"cartorio de registro civil\".";

const CIVIC_NOTE =
  "Electoral zone (TRE-PR) whose area contains the point, as IPPUC publishes it; counts as of `reference_date`. It is " +
  "not necessarily the zone where a person votes: that is the zone and section on their título de eleitor. A bairro " +
  "can span more than one zone. Voting places: city_facilities_search type \"local de votacao\".";

const approx = (v: unknown): boolean | null => (v === 1 ? true : v === 0 ? false : null);

/**
 * One row per name (the first kept), by name, at most MAX_AREAS. A row with no name is kept only when no row has one
 * (two nameless rows count once when all their fields match); a row with no text field is skipped.
 */
function distinct<T extends object>(rows: T[], nameOf: (r: T) => string | null): T[] {
  const kept = rows.filter((r) => Object.values(r).some((v) => typeof v === "string"));
  const named = kept.some((r) => nameOf(r) !== null);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of kept) {
    if (named && nameOf(r) === null) continue;
    const k = nameOf(r) ?? JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  out.sort((a, b) => (nameOf(a) ?? "").localeCompare(nameOf(b) ?? "", "pt-BR"));
  return out.slice(0, MAX_AREAS);
}

function healthOf(features: PointFeature[]): HealthOut[] {
  const rows = features.map(({ attributes: a }) => ({
    name: cleanPointField(a.nome, 100),
    district: cleanPointField(a.distrito, 100),
    reference_date: cleanPointField(a.data, 50),
    source_agency: cleanPointField(a.fonte, 50),
    approximate: approx(a.geometriaaproximada),
  }));
  return distinct(rows, (r) => r.name);
}

function crasOf(features: PointFeature[]): CrasOut[] {
  const rows = features.map(({ attributes: a }) => ({
    name: cleanPointField(a.nome, 100),
    type: cleanPointField(a.tipo, 100),
    regional: cleanPointField(a.regional, 50),
    reference_date: cleanPointField(a.data, 50),
    source_agency: cleanPointField(a.fonte, 50),
    approximate: approx(a.geometriaaproximada),
  }));
  return distinct(rows, (r) => r.name);
}

/** A composite name: the battalion and the company (company names repeat across battalions). */
const joined = (...parts: (string | null)[]): string | null => (parts.every((p) => p === null) ? null : parts.map((p) => p ?? "").join(" / "));

function pmOf(features: PointFeature[]): PmOut[] {
  const rows = features.map(({ attributes: a }) => ({
    battalion: cleanPointField(a.nm_batalhao, 100),
    battalion_code: cleanPointField(a.sg_batalhao, 20),
    company: cleanPointField(a.nm_companhia, 100),
    company_code: cleanPointField(a.sg_companhia, 20),
    reference_date: cleanPointField(a.data_atualizacao, 50),
    source_agency: cleanPointField(a.fonte, 100),
  }));
  return distinct(rows, (r) => joined(r.battalion, r.company));
}

function civilOf(features: PointFeature[]): CivilOut[] {
  const rows = features.map(({ attributes: a }) => ({
    district: cleanPointField(a.nm_distrito, 100),
    district_code: cleanPointField(a.sg_distrito, 20),
    division: cleanPointField(a.nm_divisao, 100),
    source_agency: cleanPointField(a.fonte, 100),
  }));
  return distinct(rows, (r) => r.district);
}

function fireOf(features: PointFeature[]): FireOut[] {
  const rows = features.map(({ attributes: a }) => ({
    platoon: cleanPointField(a.pelotao, 100),
    platoon_code: cleanPointField(a.sigla, 20),
    company: cleanPointField(a.companhia, 100),
    battalion: cleanPointField(a.batalhao, 100),
    source_agency: cleanPointField(a.fonte, 100),
  }));
  return distinct(rows, (r) => joined(r.battalion, r.company, r.platoon));
}

/** `fonte` keeps its full published length (254): the legal basis lists several laws. */
function propertyOf(features: PointFeature[]): PropertyOut[] {
  const rows = features.map(({ attributes: a }) => ({ circumscription: cleanPointField(a.circunscricao, 100), legal_basis: cleanPointField(a.fonte, 254) }));
  return distinct(rows, (r) => r.circumscription);
}

function civilRegistryOf(features: PointFeature[]): CivilRegOut[] {
  const rows = features.map(({ attributes: a }) => ({ service: cleanPointField(a.servicos, 254), legal_basis: cleanPointField(a.fonte, 254) }));
  return distinct(rows, (r) => r.service);
}

/** A count as published (a double such as 45.0): a non-negative whole number, else null. */
const wholeCount = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

function zonesOf(features: PointFeature[]): ZoneOut[] {
  const rows = features.map(({ attributes: a }) => ({
    zone: cleanPointField(a.zona_eleitoral, 20),
    polling_places: wholeCount(a.num_locais),
    sections: wholeCount(a.num_secoes),
    reference_date: cleanPointField(a.data_alteracao, 50),
  }));
  return distinct(rows, (r) => r.zone);
}

/** Same rule as place_at_point: inside when the bairro layer names a neighbourhood or a regional at the point. */
const insideCuritiba = (features: PointFeature[]): boolean =>
  features.some(({ attributes: a }) => cleanPointField(a.nome, 100) !== null || cleanPointField(a.nm_regional, 100) !== null);

/**
 * Health area first (a Curitiba health unit area means the point is inside the city). Only when it has none is the
 * bairro layer asked, so the common call stays at 2 requests and a gap in the bairro layer never hides an area.
 */
export async function serviceAreasAt(p: Point, reads: PointReads, areas: "care" | "safety" | "registry" | "civic" = "care"): Promise<Output> {
  if (areas === "safety") return safetyAreasAt(p, reads);
  if (areas === "registry") return registryAreasAt(p, reads);
  if (areas === "civic") return civicAreasAt(p, reads);
  const healthRes = await reads.layer("health_area");
  const times = [healthRes.fetchedAt];
  const health = healthOf(healthRes.value);
  let inside = health.length > 0;
  if (!inside) {
    const bairroRes = await reads.layer("bairro");
    times.push(bairroRes.fetchedAt);
    inside = insideCuritiba(bairroRes.value);
  }
  let cras: CrasOut[] | null = null;
  let failure: unknown = null;
  if (inside) {
    try {
      const c = await reads.layer("cras_territory");
      times.push(c.fetchedAt);
      cras = crasOf(c.value);
    } catch (err) {
      failure = err;
    }
  }
  const partial = failure !== null;
  const extra = [
    inside ? "" : "No health unit area and no Curitiba neighbourhood (IPPUC cadastral map) contains this point: it may be in a neighbouring city; the CRAS layer was not asked.",
    inside && health.length === 0 ? "No health unit area found here (not covered by the layer)." : "",
    inside && cras?.length === 0 ? "No CRAS territory found here (not covered by the layer)." : "",
    health.filter((h) => h.name !== null).length > 1 || (cras ?? []).filter((c) => c.name !== null).length > 1 ? "The point is on a boundary: more than one area is listed." : "",
    partial ? `Partial: the CRAS layer could not be read now. ${missingNote([failure])}` : "",
  ].filter(Boolean);
  return {
    data: areasData(p, "care", inside, { health_units: health, cras }, partial),
    source: SERVICE_AREAS_SOURCE,
    source_url: THEMATIC_SERVICE_URL,
    checked_at: times.reduce((a, c) => (c < a ? c : a)),
    license_note: FACILITIES_LICENSE_NOTE,
    note: [NOTE, ...extra].join(" "),
  };
}

/** Why a later layer is missing: a refusal, the call's time budget, or a busy or failing host (worst first). */
export function missingNote(errors: unknown[]): string {
  if (errors.some((e) => e instanceof SourceRefusedError)) return "The source refused this server; it is not asked again for 10 minutes.";
  if (errors.every((e) => e instanceof OutOfTimeError)) {
    return "It was not asked: the call's time budget ran out (requests to the host are 5 s apart); call again, the layers already read are cached.";
  }
  return "The host was busy or failing (after a failure no request is made for 60 s); try again in a minute, the layers already read are cached.";
}

/**
 * Polícia Militar company first (its 13 areas cover Curitiba only); when it has none, the bairro layer decides whether
 * the point is in Curitiba. Then the Polícia Civil district and the fire platoon, each failure only `partial`.
 */
async function safetyAreasAt(p: Point, reads: PointReads): Promise<Output> {
  const pmRes = await reads.layer("pm_company");
  const times = [pmRes.fetchedAt];
  const pm = pmOf(pmRes.value);
  let inside = pm.length > 0;
  if (!inside) {
    const bairroRes = await reads.layer("bairro");
    times.push(bairroRes.fetchedAt);
    inside = insideCuritiba(bairroRes.value);
  }
  const missing: string[] = [];
  const errors: unknown[] = [];
  async function later<T>(layer: "civil_district" | "fire_platoon", label: string, read: (f: PointFeature[]) => T[]): Promise<T[] | null> {
    if (!inside) return null;
    try {
      const r = await reads.layer(layer);
      times.push(r.fetchedAt);
      return read(r.value);
    } catch (err) {
      missing.push(label);
      errors.push(err);
      return null;
    }
  }
  const civil = await later("civil_district", "Polícia Civil", civilOf);
  const fire = await later("fire_platoon", "fire", fireOf);
  const none = (list: unknown[] | null, label: string) =>
    inside && list?.length === 0 ? `No ${label} area found here (not covered by the layer).` : "";
  const extra = [
    inside ? "" : "No Polícia Militar area and no Curitiba neighbourhood (IPPUC cadastral map) contains this point: it may be in a neighbouring city; no other layer was asked.",
    none(pm, "Polícia Militar"),
    none(civil, "Polícia Civil"),
    none(fire, "fire"),
    pm.length > 1 || (civil?.length ?? 0) > 1 || (fire?.length ?? 0) > 1 ? "The point is on a boundary: more than one area is listed." : "",
    missing.length > 0 ? `Partial: the ${missing.join(" and ")} layer could not be read now. ${missingNote(errors)}` : "",
  ].filter(Boolean);
  return {
    data: areasData(p, "safety", inside, { police_military: pm, police_civil: civil, fire }, missing.length > 0),
    source: SAFETY_AREAS_SOURCE,
    source_url: THEMATIC_SERVICE_URL,
    checked_at: times.reduce((a, c) => (c < a ? c : a)),
    license_note: FACILITIES_LICENSE_NOTE,
    note: [SAFETY_NOTE, ...extra].join(" "),
  };
}

/**
 * Circunscrição imobiliária first; when it has none, the bairro layer decides whether the point is in Curitiba. Then
 * the registro civil serviço, whose failure is only `partial`.
 */
async function registryAreasAt(p: Point, reads: PointReads): Promise<Output> {
  const propRes = await reads.layer("property_registry");
  const times = [propRes.fetchedAt];
  const property = propertyOf(propRes.value);
  let inside = property.length > 0;
  if (!inside) {
    const bairroRes = await reads.layer("bairro");
    times.push(bairroRes.fetchedAt);
    inside = insideCuritiba(bairroRes.value);
  }
  let civil: CivilRegOut[] | null = null;
  let failure: unknown = null;
  if (inside) {
    try {
      const c = await reads.layer("civil_registry");
      times.push(c.fetchedAt);
      civil = civilRegistryOf(c.value);
    } catch (err) {
      failure = err;
    }
  }
  const extra = [
    inside ? "" : "No circunscrição imobiliária and no Curitiba neighbourhood (IPPUC cadastral map) contains this point: it may be in a neighbouring city; the registro civil layer was not asked.",
    inside && property.length === 0 ? "No circunscrição imobiliária found here (not covered by the layer)." : "",
    inside && civil?.length === 0 ? "No registro civil area found here (not covered by the layer)." : "",
    property.filter((r) => r.circumscription !== null).length > 1 || (civil ?? []).filter((r) => r.service !== null).length > 1
      ? "The point is on a boundary: more than one area is listed."
      : "",
    failure !== null ? `Partial: the registro civil layer could not be read now. ${missingNote([failure])}` : "",
  ].filter(Boolean);
  return {
    data: areasData(p, "registry", inside, { property_registry: property, civil_registry: civil }, failure !== null),
    source: REGISTRY_AREAS_SOURCE,
    source_url: THEMATIC_SERVICE_URL,
    checked_at: times.reduce((a, c) => (c < a ? c : a)),
    license_note: FACILITIES_LICENSE_NOTE,
    note: [REGISTRY_NOTE, ...extra].join(" "),
  };
}

/** The electoral zone (10 areas, Curitiba only); when it has none, the bairro layer decides whether the point is in Curitiba. */
async function civicAreasAt(p: Point, reads: PointReads): Promise<Output> {
  const zoneRes = await reads.layer("electoral_zone");
  const times = [zoneRes.fetchedAt];
  const zones = zonesOf(zoneRes.value);
  let inside = zones.length > 0;
  if (!inside) {
    const bairroRes = await reads.layer("bairro");
    times.push(bairroRes.fetchedAt);
    inside = insideCuritiba(bairroRes.value);
  }
  const extra = [
    inside ? "" : "No electoral zone and no Curitiba neighbourhood (IPPUC cadastral map) contains this point: it may be in a neighbouring city.",
    inside && zones.length === 0 ? "No electoral zone found here (not covered by the layer)." : "",
    zones.filter((z) => z.zone !== null).length > 1 ? "The point is on a boundary: more than one area is listed." : "",
  ].filter(Boolean);
  return {
    data: areasData(p, "civic", inside, { electoral_zones: zones }, false),
    source: VOTING_CREDIT,
    source_url: THEMATIC_SERVICE_URL,
    checked_at: times.reduce((a, c) => (c < a ? c : a)),
    license_note: FACILITIES_LICENSE_NOTE,
    note: [CIVIC_NOTE, ...extra].join(" "),
  };
}
