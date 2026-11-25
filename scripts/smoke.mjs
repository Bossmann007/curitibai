// Starts the built server over stdio, calls tools/list, city_services_search on the synthetic catalog fixture,
// city_service_guide's open_step fallback (a client with no elicitation capability), and
// bus_departures, bus_stops_near, next_buses_near and city_points_search on the synthetic URBS fixtures, and
// city_facilities_search with "list types", useful_phones on a local copy and events_search with no copy. No network
// needed: none of them fetches anything (CURITIBAI_REMOTE_DATA=0 turns the published copy of events and phones off).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePhonesPage } from "./fetch-events.mjs";

const expected = ["bus_departures", "bus_line_stops", "bus_lines_search", "bus_stops_near", "city_calendar", "city_facilities_search", "city_points_search", "city_service_guide", "city_services_search", "dataset_files", "detran_pr_info", "events_search", "guaira_events", "health_units_search", "local_csv_summary", "next_buses_near", "open_datasets_search", "place_at_point", "places_search", "procurement_search", "river_levels", "tax_reform_curitiba", "useful_phones", "vaccination_sites_search", "weather_alerts", "weather_forecast"];
// Invented services only (test/fixtures/carta_servicos_synthetic); the real catalog is never part of this repo.
// The URBS fixtures have no date in their names (scripts/check-no-catalog blocks dated files), so the data folder is a
// temporary copy: the catalog fixture plus the URBS fixtures under the dated names the server looks for.
const fixtures = fileURLToPath(new URL("../test/fixtures/", import.meta.url));
const dataDir = mkdtempSync(join(tmpdir(), "curitibai-smoke-"));
mkdirSync(join(dataDir, "urbs"));
copyFileSync(join(fixtures, "carta_servicos_synthetic", "carta-servicos.json"), join(dataDir, "carta-servicos.json"));
for (const kind of ["linhas", "pontosLinha", "tabelaLinha", "pois"]) {
  copyFileSync(join(fixtures, "urbs_synthetic", `${kind}.json`), join(dataDir, "urbs", `2026_11_20_${kind}.json`));
}
// The collector's own output for the trimmed phones fixture, as the collector would write it.
const phoneEntries = parsePhonesPage(readFileSync(join(fixtures, "useful_phones", "telefones_uteis_trimmed.html"), "utf8")).entries;
mkdirSync(join(dataDir, "phones"));
writeFileSync(
  join(dataDir, "phones", "phones.json"),
  JSON.stringify({
    format: 1,
    source: "https://turismo.curitiba.pr.gov.br/conteudo/telefones-uteis/92",
    checked_at: new Date().toISOString(),
    count: phoneEntries.length,
    dropped: 0,
    entries: phoneEntries,
  }),
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/server.js"],
  env: { PATH: process.env.PATH ?? "", CURITIBAI_DATA_DIR: dataDir, CURITIBAI_REMOTE_DATA: "0" },
  stderr: "pipe",
});
const client = new Client({ name: "smoke", version: "0.0.0" });
const cleanup = () => rmSync(dataDir, { recursive: true, force: true });
process.on("exit", cleanup); // also on a timeout or a thrown error
const timer = setTimeout(() => {
  console.error("smoke: timeout");
  process.exit(1);
}, 15_000);
await client.connect(transport);
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
const cs = await client.callTool({ name: "city_services_search", arguments: { query: "ficticia", limit: 1 } });
// The smoke client declares no elicitation capability, so open_step falls back to returning the link.
const guide = await client.callTool({ name: "city_service_guide", arguments: { service: "saude_ja", open_step: 2 } });
const bus = await client.callTool({ name: "bus_departures", arguments: { line_code: "901", day: "1" } });
const near = await client.callTool({ name: "bus_stops_near", arguments: { near: { lat: -25.4, lon: -49.2 } } });
const next = await client.callTool({
  name: "next_buses_near",
  arguments: { near: { lat: -25.41, lon: -49.21 }, at: "06:30", day: "1" },
});
const pois = await client.callTool({ name: "city_points_search", arguments: { category: "feira" } });
// "list types" makes no network call.
const facilityTypes = await client.callTool({ name: "city_facilities_search", arguments: { type: "list types" } });
const phones = await client.callTool({ name: "useful_phones", arguments: { query: "samu" } });
const noEvents = await client.callTool({ name: "events_search", arguments: {} });
await client.close();
clearTimeout(timer);
cleanup();
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  console.error(`smoke: unexpected tools ${JSON.stringify(names)}`);
  process.exit(1);
}
// The built server reads its version from package.json (dist/../package.json), the one place it is written.
const pkgVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
if (client.getServerVersion()?.version !== pkgVersion) {
  console.error(`smoke: server version ${client.getServerVersion()?.version} is not package.json ${pkgVersion}`);
  process.exit(1);
}
if (cs.isError || !(cs.structuredContent?.data?.total > 0)) {
  console.error("smoke: city_services_search returned no services from the synthetic fixture");
  process.exit(1);
}
if (bus.isError || !(bus.structuredContent?.data?.total > 0)) {
  console.error("smoke: bus_departures returned no departures from the synthetic URBS fixtures");
  process.exit(1);
}
if (near.isError || !(near.structuredContent?.data?.total > 0) || near.structuredContent.data.source !== "urbs_export") {
  console.error("smoke: bus_stops_near returned no stops from the synthetic URBS fixtures (source urbs_export)");
  process.exit(1);
}
if (next.isError || !(next.structuredContent?.data?.total > 0)) {
  console.error("smoke: next_buses_near returned no departures from the synthetic URBS fixtures");
  process.exit(1);
}
if (pois.isError || !(pois.structuredContent?.data?.total > 0)) {
  console.error("smoke: city_points_search returned no points from the synthetic URBS fixture");
  process.exit(1);
}
if (facilityTypes.isError || !(facilityTypes.structuredContent?.data?.types?.length > 0)) {
  console.error("smoke: city_facilities_search returned no types");
  process.exit(1);
}
if (phones.isError || phones.structuredContent?.data?.items?.[0]?.numbers?.[0] !== "192") {
  console.error("smoke: useful_phones did not read the local copy");
  process.exit(1);
}
if (!noEvents.isError || !/"data_not_available"/.test(noEvents.content?.[0]?.text ?? "")) {
  console.error("smoke: events_search with no local copy and CURITIBAI_REMOTE_DATA=0 is not data_not_available");
  process.exit(1);
}
{
  const open = guide.structuredContent?.data?.open_step;
  if (guide.isError || open?.result !== "not_supported" || open?.url !== "https://saudeja.curitiba.pr.gov.br/") {
    console.error(`smoke: city_service_guide open_step fallback wrong: ${JSON.stringify(guide).slice(0, 300)}`);
    process.exit(1);
  }
}
console.log("smoke: city_service_guide OK (open_step without elicitation support returns the link to ask about)");
console.log("smoke: events_search OK (no local copy, remote reading off: data_not_available, no network)");
console.log(`smoke: useful_phones OK (local copy, ${phones.structuredContent.data.total} match for "samu")`);
console.log(`smoke: city_facilities_search OK (${facilityTypes.structuredContent.data.types.length} types listed, no network)`);
console.log(`smoke: city_points_search OK (${pois.structuredContent.data.total} synthetic feiras)`);
console.log(`smoke: next_buses_near OK (${next.structuredContent.data.total} synthetic departure(s) from 06:30 within 60 min)`);
console.log(`smoke: bus_stops_near OK (${near.structuredContent.data.total} synthetic stop(s) within 400 m)`);
console.log(`smoke: bus_departures OK (${bus.structuredContent.data.total} synthetic weekday departures of line 901)`);
console.log(`smoke: city_services_search OK (${cs.structuredContent.data.total} synthetic services match "ficticia")`);
console.log(`smoke: tools/list over stdio OK (${names.length} tools: ${names.join(", ")})`);
{
  const bad = spawnSync(process.execPath, ["dist/server.js"], {
    env: { PATH: process.env.PATH ?? "", CURITIBAI_REMOTE_DATA: "maybe" },
    input: "",
    encoding: "utf8",
    timeout: 10_000,
  });
  if (bad.status !== 1 || !bad.stderr.includes("configuration error: CURITIBAI_REMOTE_DATA must be")) {
    console.error(`smoke: CURITIBAI_REMOTE_DATA=maybe did not stop the server (status ${bad.status}): ${bad.stderr.slice(0, 300)}`);
    process.exit(1);
  }
  console.log("smoke: CURITIBAI_REMOTE_DATA=maybe stops the server at start with a configuration error");
}
