import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";

/**
 * Loads .env for the test run. Integration tests talk to a real Postgres —
 * mocking the database would not prove the transaction boundaries and unique
 * constraints that stop duplicate transfers, which is exactly what needs proving.
 */
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a build-time guard for the Next bundler; under Vitest
      // it has nothing to guard, so it resolves to a no-op.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one database; running files in parallel would
    // make the analytics assertions race each other.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
