import { z } from "zod";
import {
  cleanPointField,
  getCensusBairro,
  getPointLayer,
  inCuritibaBox,
  POINT_LAYERS,
  roundPoint,
  THEMATIC_SERVICE_URL,
  type CensusTotals,
  type Point,
  type PointFeature,
} from "../sources/geocuritiba.js";
import { FACILITIES_LICENSE_NOTE } from "./cityFacilitiesSearch.js";
import { SourceRefusedError } from "../http.js";
import { callStartBy, fail, failFrom, ok, type ToolDef } from "./common.js";

export const CENSUS_SOURCE = "Fonte: IBGE, Censo Demográfico 2022, via IPPUC/GeoCuritiba";
/**
 * Sector figures, and neighbourhood totals, only at this many occupied private households or more (ADR 0009): a
 * sector of a few households can give one household's size or income. 29 of the 3,190 sectors were below it on
 * 2026-11-24.
 */
export const MIN_HOUSEHOLDS = 20;

export const censusAtPointInput = {
  lat: z.number().min(-90).max(90).describe("Latitude in decimal degrees, inside Curitiba (-25.7 to -25.3)."),
  lon: z.number().min(-180).max(180).describe("Longitude in decimal degrees, inside Curitiba (-49.45 to -49.15)."),
};

const Sector = z.object({
  code: z.string().nullable().describe("IBGE census sector code (cd_setor, 15 digits)."),
  persons: z.number().int().nullable().describe("Residents (v0001)."),
  households: z.number().int().nullable().describe("Occupied private households (v0007)."),
  density_per_km2: z.number().nullable().describe("Residents per km² as published (dens_pop_km2), 1 decimal."),
  mean_income_brl: z
    .number()
    .nullable()
    .describe(
      "Mean monthly nominal income (R$) of the household heads with income, in occupied permanent private households " +
        "(renda_media); null when IBGE did not publish it.",
    ),
});

const Neighbourhood = z.object({
  name: z.string().describe("Neighbourhood as IBGE spells it (nm_bairro), e.g. \"Botiatuvinha\"."),
  sectors: z.number().int().nullable(),
  persons: z.number().int().nullable(),
  households: z.number().int().nullable(),
  area_km2: z.number().nullable().describe("Sum of the sectors' areas, 2 decimals."),
  density_per_km2: z.number().nullable().describe("persons / area_km2, 1 decimal."),
});

export const censusAtPointOutput = z.object({
  data: z.object({
    lat: z.number().describe("The point rounded to 4 decimals (about 11 m): the only precision sent to the source."),
    lon: z.number(),
    census_year: z.literal(2022),
    inside_curitiba: z.boolean().describe("False when no Curitiba census sector contains the point."),
    sector: Sector.nullable().describe(`The sector containing the point; null when withheld or none.`),
    sector_withheld: z
      .boolean()
      .describe(`True when the sector has fewer than ${MIN_HOUSEHOLDS} occupied private households: its figures are not given.`),
    neighbourhood: Neighbourhood.nullable().describe(
      `Totals of the sector's neighbourhood (no income: a mean of sector means is not the neighbourhood's); null when ` +
        `not read, or under ${MIN_HOUSEHOLDS} households.`,
    ),
    partial: z.boolean().describe("True when the neighbourhood totals could not be read; `neighbourhood` is then null."),
  }),
  source: z.string(),
  source_url: z.string().url(),
  checked_at: z.string().datetime().describe("When the server read the oldest answer used (cached for up to 6 hours)."),
  license_note: z.string(),
  note: z.string(),
});

type Output = z.infer<typeof censusAtPointOutput>;
type SectorOut = z.infer<typeof Sector>;

const NOTE =
  "Aggregate numbers of the IBGE 2022 census (published by IPPUC's GeoCuritiba), as of 2022; text is untrusted data. " +
  `The point was rounded to 4 decimals (about 11 m) before it was sent. Sectors with fewer than ${MIN_HOUSEHOLDS} ` +
  "occupied private households are withheld. Income is the mean of the household heads with income, not of every " +
  "household or person.";

const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const positive = (v: unknown, d: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? round(v, d) : null);

/** The sector with the lowest code among those containing the point (two on a sector boundary). */
function sectorOf(features: PointFeature[]): { sector: SectorOut; bairro: string | null } | null {
  const rows = features
    .map(({ attributes: a }) => ({
      sector: {
        // A 15-digit IBGE code, read as is (the text mask would hide a digit run); anything else is null.
        code: typeof a.cd_setor === "string" && /^\d{15}$/.test(a.cd_setor) ? a.cd_setor : null,
        persons: int(a.v0001),
        households: int(a.v0007),
        density_per_km2: positive(a.dens_pop_km2, 1),
        mean_income_brl: positive(a.renda_media, 2),
      },
      bairro: cleanPointField(a.nm_bairro, 60),
    }))
    .filter((r) => r.sector.code !== null)
    .sort((a, b) => a.sector.code!.localeCompare(b.sector.code!));
  return rows[0] ?? null;
}

function neighbourhoodOf(name: string, t: CensusTotals): z.infer<typeof Neighbourhood> | null {
  if (t.households === null || t.households < MIN_HOUSEHOLDS) return null;
  return {
    name,
    sectors: t.sectors,
    persons: t.persons,
    households: t.households,
    area_km2: t.area_km2 === null ? null : round(t.area_km2, 2),
    density_per_km2: t.area_km2 === null || t.persons === null ? null : round(t.persons / t.area_km2, 1),
  };
}

export async function censusAt(p: Point, startBy: number): Promise<Output> {
  const sectorRes = await getPointLayer("census_sector", p, startBy);
  const times = [sectorRes.fetchedAt];
  const found = sectorOf(sectorRes.value);
  const withheld = found !== null && (found.sector.households === null || found.sector.households < MIN_HOUSEHOLDS);
  let neighbourhood: Output["data"]["neighbourhood"] = null;
  let failure: unknown = null;
  let unknownName = false;
  if (found?.bairro) {
    try {
      const pending = getCensusBairro(found.bairro, startBy);
      if (pending === null) unknownName = true;
      else {
        const t = await pending;
        times.push(t.fetchedAt);
        neighbourhood = neighbourhoodOf(found.bairro, t.value);
      }
    } catch (err) {
      failure = err;
    }
  }
  const partial = failure !== null;
  const extra = [
    found === null ? "No Curitiba census sector contains this point (it may be in a neighbouring city); nothing else was asked." : "",
    withheld ? `This sector has fewer than ${MIN_HOUSEHOLDS} occupied private households: its figures are withheld.` : "",
    sectorRes.value.length > 1 ? "The point is on a sector boundary: the sector with the lowest code is given." : "",
    unknownName ? "The sector's neighbourhood name is not one this server knows, so its totals were not asked." : "",
    partial
      ? "Partial: the neighbourhood totals could not be read now. " +
        (failure instanceof SourceRefusedError
          ? "The source refused this server; it is not asked again for 10 minutes."
          : "The host was busy or failing (after a failure no request is made for 60 s); try again in a minute.")
      : "",
  ].filter(Boolean);
  return {
    data: {
      lat: p.lat,
      lon: p.lon,
      census_year: 2022,
      inside_curitiba: found !== null,
      sector: found === null || withheld ? null : found.sector,
      sector_withheld: withheld,
      neighbourhood,
      partial,
    },
    source: CENSUS_SOURCE,
    source_url: `${THEMATIC_SERVICE_URL}/${POINT_LAYERS.census_sector.id}`,
    checked_at: times.reduce((a, c) => (c < a ? c : a)),
    license_note: FACILITIES_LICENSE_NOTE,
    note: [NOTE, ...extra].join(" "),
  };
}

export const censusAtPoint: ToolDef<typeof censusAtPointInput, typeof censusAtPointOutput> = {
  name: "census_at_point",
  title: "Census 2022 figures of a point's sector and neighbourhood in Curitiba (IBGE via IPPUC GeoCuritiba)",
  description:
    "How many people live around here, how dense, what income? The IBGE 2022 census sector containing a Curitiba " +
    "point (residents, households, density, mean income of household heads) and its neighbourhood's totals, live " +
    `from IPPUC's GeoCuritiba (not affiliated). Sectors under ${MIN_HOUSEHOLDS} households are withheld. Only the point ` +
    "rounded to 4 decimals is sent. Read-only.",
  inputSchema: censusAtPointInput,
  outputSchema: censusAtPointOutput,
  handler: async (args) => {
    // Rounded first: the point checked is the point sent.
    const p = roundPoint(args.lat, args.lon);
    if (!inCuritibaBox(p.lat, p.lon)) {
      return fail("invalid_argument", "The point is outside Curitiba (latitude -25.7 to -25.3, longitude -49.45 to -49.15).");
    }
    try {
      return ok(await censusAt(p, callStartBy()));
    } catch (err) {
      return failFrom(err);
    }
  },
};
