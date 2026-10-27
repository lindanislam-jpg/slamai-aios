import path from "node:path";
import os from "node:os";

/** Tests never run against the development or production database. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://asgard:asgard_local_dev@localhost:5432/asgard_qc_test";
export const TEST_STORAGE_DIR = path.join(os.tmpdir(), "asgard-qc-test-storage");
