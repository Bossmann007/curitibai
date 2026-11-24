// server.json (MCP Registry entry) against the registry's schema, vendored in test/fixtures/mcp-registry/ from the URL
// in its $schema, plus the fields that must agree with package.json (https://modelcontextprotocol.io/registry/quickstart).
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const server = read("server.json");
const pkg = read("package.json");
const schema = read("test/fixtures/mcp-registry/server.schema.json");

describe("server.json", () => {
  it("is valid against the vendored registry schema it names", () => {
    expect(schema.$id).toBe(server.$schema);
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats.default(ajv);
    const validate = ajv.compile(schema);
    expect(validate(server), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("agrees with package.json", () => {
    expect(server.version).toBe(pkg.version);
    expect(server.name).toBe(pkg.mcpName);
    // GitHub OIDC grants io.github.<repository owner>/*, compared case-sensitively.
    expect(server.name).toBe("io.github.Bossmann007/curitibai");
    expect(server.packages).toHaveLength(1);
    expect(server.packages[0]).toMatchObject({ registryType: "npm", identifier: pkg.name, version: pkg.version, transport: { type: "stdio" } });
    expect(pkg.repository.url).toBe(`git+${server.repository.url}.git`);
  });

  it("documents only non-secret environment variables", () => {
    for (const v of server.packages[0].environmentVariables) {
      expect(v.isSecret).toBe(false);
      expect(v.name).toMatch(/^CURITIBAI_/);
    }
  });
});
