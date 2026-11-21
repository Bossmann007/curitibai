// Starts the built server over stdio, calls tools/list and city_services_search on the synthetic catalog fixture.
// No network needed: neither fetches anything.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const expected = ["bus_lines", "city_services_search", "dataset_files", "detran_pr_info", "health_units_search", "local_csv_summary", "open_datasets_search", "places_search", "procurement_search", "weather_alerts", "weather_forecast"];
// Invented services only (test/fixtures/carta_servicos_synthetic); the real catalog is never part of this repo.
const dataDir = fileURLToPath(new URL("../test/fixtures/carta_servicos_synthetic/", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/server.js"],
  env: { PATH: process.env.PATH ?? "", CURITIBAI_DATA_DIR: dataDir },
  stderr: "pipe",
});
const client = new Client({ name: "smoke", version: "0.0.0" });
const timer = setTimeout(() => {
  console.error("smoke: timeout");
  process.exit(1);
}, 15_000);
await client.connect(transport);
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
const cs = await client.callTool({ name: "city_services_search", arguments: { query: "ficticia", limit: 1 } });
await client.close();
clearTimeout(timer);
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  console.error(`smoke: unexpected tools ${JSON.stringify(names)}`);
  process.exit(1);
}
if (cs.isError || !(cs.structuredContent?.data?.total > 0)) {
  console.error("smoke: city_services_search returned no services from the synthetic fixture");
  process.exit(1);
}
console.log(`smoke: city_services_search OK (${cs.structuredContent.data.total} synthetic services match "ficticia")`);
console.log(`smoke: tools/list over stdio OK (${names.length} tools: ${names.join(", ")})`);
