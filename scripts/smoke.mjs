// Starts the built server over stdio and calls tools/list. No network needed: tools/list fetches nothing.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expected = ["dataset_files", "detran_pr_info", "health_units_search", "local_csv_summary", "open_datasets_search", "procurement_search", "weather_alerts", "weather_forecast"];
const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/server.js"], stderr: "pipe" });
const client = new Client({ name: "smoke", version: "0.0.0" });
const timer = setTimeout(() => {
  console.error("smoke: timeout");
  process.exit(1);
}, 15_000);
await client.connect(transport);
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
await client.close();
clearTimeout(timer);
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  console.error(`smoke: unexpected tools ${JSON.stringify(names)}`);
  process.exit(1);
}
console.log(`smoke: tools/list over stdio OK (${names.length} tools: ${names.join(", ")})`);
