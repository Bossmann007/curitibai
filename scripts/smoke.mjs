// Starts the built server over stdio, calls tools/list, city_services_search on the synthetic catalog fixture, and
// bus_departures, bus_stops_near, next_buses_near and city_points_search on the synthetic URBS fixtures, and
// city_facilities_search with "list types". No network needed: none of them fetches anything.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const expected = ["bus_departures", "bus_line_stops", "bus_lines_search", "bus_stops_near", "city_facilities_search", "city_points_search", "city_services_search", "dataset_files", "detran_pr_info", "events_search", "health_units_search", "local_csv_summary", "next_buses_near", "open_datasets_search", "places_search", "procurement_search", "vaccination_sites_search", "weather_alerts", "weather_forecast"];
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
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/server.js"],
  env: { PATH: process.env.PATH ?? "", CURITIBAI_DATA_DIR: dataDir },
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
const bus = await client.callTool({ name: "bus_departures", arguments: { line_code: "901", day: "1" } });
const near = await client.callTool({ name: "bus_stops_near", arguments: { near: { lat: -25.4, lon: -49.2 } } });
const next = await client.callTool({
  name: "next_buses_near",
  arguments: { near: { lat: -25.41, lon: -49.21 }, at: "06:30", day: "1" },
});
const pois = await client.callTool({ name: "city_points_search", arguments: { category: "feira" } });
// "list types" makes no network call.
const facilityTypes = await client.callTool({ name: "city_facilities_search", arguments: { type: "list types" } });
await client.close();
clearTimeout(timer);
cleanup();
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  console.error(`smoke: unexpected tools ${JSON.stringify(names)}`);
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
if (near.isError || !(near.structuredContent?.data?.total > 0)) {
  console.error("smoke: bus_stops_near returned no stops from the synthetic URBS fixtures");
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
console.log(`smoke: city_facilities_search OK (${facilityTypes.structuredContent.data.types.length} types listed, no network)`);
console.log(`smoke: city_points_search OK (${pois.structuredContent.data.total} synthetic feiras)`);
console.log(`smoke: next_buses_near OK (${next.structuredContent.data.total} synthetic departure(s) from 06:30 within 60 min)`);
console.log(`smoke: bus_stops_near OK (${near.structuredContent.data.total} synthetic stop(s) within 400 m)`);
console.log(`smoke: bus_departures OK (${bus.structuredContent.data.total} synthetic weekday departures of line 901)`);
console.log(`smoke: city_services_search OK (${cs.structuredContent.data.total} synthetic services match "ficticia")`);
console.log(`smoke: tools/list over stdio OK (${names.length} tools: ${names.join(", ")})`);
