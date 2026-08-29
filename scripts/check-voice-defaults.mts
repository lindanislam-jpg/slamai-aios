/**
 * The setup checklist compares a user's greeting and instructions against the
 * stock text to decide whether they've written their own. That comparison is
 * only correct while src/lib/voice-defaults.ts matches the @default values in
 * prisma/schema.prisma — this guards the two from drifting apart.
 */
import { readFileSync } from "node:fs";
import { DEFAULT_GREETING, DEFAULT_SYSTEM_PROMPT } from "../src/lib/voice-defaults";

const schema = readFileSync("prisma/schema.prisma", "utf8");

function schemaDefault(field: string): string | null {
  const match = schema.match(new RegExp(`${field}\\s+String\\s+@default\\("((?:[^"\\\\]|\\\\.)*)"\\)`));
  return match ? match[1].replace(/\\"/g, '"') : null;
}

const checks: [string, string | null, string][] = [
  ["greeting",     schemaDefault("greeting"),     DEFAULT_GREETING],
  ["systemPrompt", schemaDefault("systemPrompt"), DEFAULT_SYSTEM_PROMPT],
];

let failed = false;
for (const [field, fromSchema, fromLib] of checks) {
  if (fromSchema !== fromLib) {
    failed = true;
    console.error(`✗ ${field} has drifted between schema and lib/voice-defaults.ts`);
    console.error(`   schema: ${JSON.stringify(fromSchema)}`);
    console.error(`   lib:    ${JSON.stringify(fromLib)}`);
  } else {
    console.log(`✓ ${field} matches`);
  }
}

if (failed) {
  console.error("\nUpdate src/lib/voice-defaults.ts to match prisma/schema.prisma.");
  process.exit(1);
}
