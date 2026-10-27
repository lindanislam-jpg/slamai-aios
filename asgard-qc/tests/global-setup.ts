import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { TEST_DATABASE_URL, TEST_STORAGE_DIR } from "./env";

export default function setup() {
  if (!/test/i.test(TEST_DATABASE_URL)) throw new Error("Refusing to run tests: TEST_DATABASE_URL must point at a database whose name contains 'test'.");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: "pipe" });
  rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
}
