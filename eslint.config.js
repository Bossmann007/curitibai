import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    // stdout belongs to the MCP JSON-RPC stream; the server never logs.
    files: ["src/**/*.ts"],
    rules: { "no-console": "error" },
  },
);
