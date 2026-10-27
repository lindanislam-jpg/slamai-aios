import { TEST_DATABASE_URL, TEST_STORAGE_DIR } from "./env";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_DIR = TEST_STORAGE_DIR;
delete process.env.ANTHROPIC_API_KEY;
