// Shape checks of the citizen eval: what a question expects (status, fields, link) against what a tool returned.
// Shape, never exact text: the fixtures are synthetic and the wording of notes may change.
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type Status = "ok" | "not_found" | "outside_curitiba" | "guide" | "error";

export interface Expect {
  status: Status;
  /** Error code, for status "error" (e.g. "invalid_argument", "data_not_available"). */
  error?: string;
  /** Dotted paths in the structured result that must be present and non-empty. */
  fields?: string[];
  /** Dotted path of the source or official link (an https URL). Default "source_url"; null: the tool has none. */
  link?: string | null;
}

export interface Question {
  id: string;
  question: string;
  tool: string | null;
  args?: Record<string, unknown>;
  expect?: Expect;
  /** For tool null: what is missing (the label counted in the summary). */
  gap?: string;
  /** Free labels such as "ambiguous" or "outside_curitiba". */
  tags?: string[];
}

/**
 * Where each tool puts its answer list (or count): empty at every path given means not_found. A tool with no entry
 * always answers something (a calendar, a rule, a guide); its content is checked by `fields`.
 */
export const RESULT_PATH: Record<string, string | string[]> = {
  open_datasets_search: "data.datasets",
  dataset_files: "data.files",
  health_units_search: "data.units",
  procurement_search: "data.items",
  local_csv_summary: "data.row_count",
  weather_forecast: "data.days",
  weather_alerts: "data.alerts",
  city_services_search: "data.items",
  places_search: "data.places",
  bus_lines_search: "data.items",
  bus_line_stops: "data.items",
  bus_departures: "data.items",
  bus_stops_near: "data.items",
  next_buses_near: "data.items",
  city_points_search: "data.items",
  city_facilities_search: ["data.items", "data.types"], // "list types" answers in data.types
  events_search: "data.items",
  vaccination_sites_search: "data.items",
  useful_phones: "data.items",
  river_levels: "data.stations",
  guaira_events: "data.items",
};

export function at(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) && /^\d+$/.test(key) ? cur[Number(key)] : (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Absent, null, "" or an empty list or object. A number, 0 included, is a value. */
export function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

export interface Observed {
  status: Status;
  error?: string;
  structured?: Record<string, unknown>;
}

/** The status a tool's result shows, read the same way for every question of that tool. */
export function observe(tool: string, res: CallToolResult): Observed {
  if (res.isError) {
    const first = res.content?.[0];
    let body: { error: string; message?: string } = { error: "unknown" };
    try {
      if (first?.type === "text") body = JSON.parse(first.text) as typeof body;
    } catch {
      body = { error: "not_json", message: first?.type === "text" ? first.text : "" };
    }
    if (body.error === "invalid_argument" && /outside Curitiba/i.test(body.message ?? "")) return { status: "outside_curitiba", error: body.error };
    return { status: "error", error: body.error };
  }
  const structured = res.structuredContent as Record<string, unknown>;
  if (tool === "city_service_guide") return { status: "guide", structured };
  if (tool === "place_at_point") {
    const place = at(structured, "data.place");
    if (place && at(place, "inside_curitiba") === false) return { status: "outside_curitiba", structured };
  }
  const paths = RESULT_PATH[tool];
  const found = paths === undefined ? [true] : [paths].flat().map((p) => at(structured, p));
  return { status: found.every((v) => isEmpty(v) || v === 0) ? "not_found" : "ok", structured };
}

/** Every mismatch between what a question expects and what its tool returned; empty when the shape holds. */
export function mismatches(q: Question, obs: Observed): string[] {
  const exp = q.expect!;
  const out: string[] = [];
  if (obs.status !== exp.status) out.push(`status ${obs.status}${obs.error ? ` (${obs.error})` : ""}, expected ${exp.status}`);
  if (exp.error !== undefined && obs.error !== exp.error) out.push(`error ${obs.error ?? "none"}, expected ${exp.error}`);
  if (obs.structured === undefined) return out;
  for (const path of exp.fields ?? []) if (isEmpty(at(obs.structured, path))) out.push(`field ${path} missing or empty`);
  const linkPath = exp.link === undefined ? "source_url" : exp.link;
  if (linkPath !== null) {
    const link = at(obs.structured, linkPath);
    if (typeof link !== "string" || !link.startsWith("https://")) out.push(`link ${linkPath} is not an https URL`);
  }
  if (obs.status === "guide") out.push(...guideMismatches(obs.structured));
  return out;
}

/**
 * A guide answer must ask before acting: at least one step needs consent, each such step says what, and a step has the
 * official link. With open_step, the answer is the consent result, and the link only when the user can be asked.
 */
function guideMismatches(structured: Record<string, unknown>): string[] {
  const open = at(structured, "data.open_step");
  if (open !== undefined) {
    const result = at(open, "result");
    if (isEmpty(result)) return ["open_step has no result"];
    const url = at(open, "url");
    const shows = result === "accepted" || result === "not_supported";
    return shows && !(typeof url === "string" && url.startsWith("https://")) ? ["open_step shows no official https link"] : [];
  }
  const steps = at(structured, "data.steps");
  if (!Array.isArray(steps) || steps.length === 0) return ["guide has no steps"];
  const consentSteps = steps.filter((s) => at(s, "needs_consent") === true);
  if (consentSteps.length === 0) return ["guide has no step that needs consent"];
  const out: string[] = [];
  for (const s of consentSteps) {
    if (isEmpty(at(s, "consent"))) out.push(`guide step ${String(at(s, "step"))} needs consent but has no consent text`);
  }
  if (!steps.some((s) => typeof at(s, "url") === "string" && (at(s, "url") as string).startsWith("https://"))) {
    out.push("guide has no official https link in its steps");
  }
  return out;
}
