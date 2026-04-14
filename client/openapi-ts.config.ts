import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.json",
  output: {
    path: "src",
  },
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/sdk",
    {
      name: "@hey-api/typescript",
      enums: "javascript",
    },
    "@hey-api/schemas",
  ],
});
