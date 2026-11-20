// Starts the built server over stdio, calls tools/list and city_services_search. No network needed: neither fetches anything.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expected = ["city_services_search", "dataset_files", "detran_pr_info", "health_units_search", "local_csv_summary", "open_datasets_search", "procurement_search", "weather_alerts", "weather_forecast"];
const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/server.js"], stderr: "pipe" });
const client = new Client({ name: "smoke", version: "0.0.0" });
const timer = setTimeout(() => {
  console.error("smoke: timeout");
  process.exit(1);
}, 15_000);
await client.connect(transport);
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
// The bundled-data tool answers without network: check it really returns the catalog.
const cs = await client.callTool({ name: "city_services_search", arguments: { query: "saude", limit: 1 } });
await client.close();
clearTimeout(timer);
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  console.error(`smoke: unexpected tools ${JSON.stringify(names)}`);
  process.exit(1);
}
if (cs.isError || !(cs.structuredContent?.data?.total > 0)) {
  console.error("smoke: city_services_search returned no services");
  process.exit(1);
}
console.log(`smoke: city_services_search OK (${cs.structuredContent.data.total} services match "saude")`);
console.log(`smoke: tools/list over stdio OK (${names.length} tools: ${names.join(", ")})`);
