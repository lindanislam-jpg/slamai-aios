/**
 * Import checklist templates from an ASGARD inspection workbook (QF 6.42 style).
 *
 *   npm run import:forms -- <path/to/QF_6_42.xlsx>            # dry run: show what would be created
 *   npm run import:forms -- <path> --apply                   # create unapproved templates
 *   npm run import:forms -- <path> --apply --register-document --stages
 *
 * --register-document  add the workbook to the document register (new revision, under review)
 * --stages             set production stages to the workbook's section titles
 *
 * Existing templates with the same name are left untouched. The workbook is
 * read from disk; nothing about it is stored in the repository.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { parseInspectionWorkbook } from "../src/lib/import/qf-form";
import { actorFromUser } from "../src/lib/session";
import { saveTemplate } from "../src/lib/services/inspections";
import { addRevision, createDocument } from "../src/lib/services/documents";
import { updateSetting } from "../src/lib/services/settings";
import { getSetting } from "../src/lib/settings";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Usage: npm run import:forms -- <workbook.xlsx> [--apply] [--register-document] [--stages]");
  const apply = args.includes("--apply");
  const buf = readFileSync(file);
  const sections = await parseInspectionWorkbook(buf);

  let items = 0;
  for (const s of sections) {
    items += s.items.length;
    console.log(`\n${s.formCode ?? "?"} ${s.revision ?? ""} — ${s.title}  [${s.inspectionType}] ${s.items.length} checks`);
    for (const w of s.warnings) console.log(`   ⚠ ${w}`);
  }
  console.log(`\n${sections.length} sections, ${items} checks.`);
  if (!apply) {
    console.log("Dry run — nothing written. Add --apply to create the templates.");
    return;
  }

  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active administrator — run npm run db:seed first.");
  const actor = await actorFromUser(admin);

  let created = 0;
  for (const s of sections) {
    const name = `${s.formCode ?? "QF 6.42"} — ${s.title}`.slice(0, 200);
    if (await db.checklistTemplate.findFirst({ where: { name } })) {
      console.log(`skip (exists): ${name}`);
      continue;
    }
    await saveTemplate(actor, null, {
      name,
      inspectionType: s.inspectionType,
      documentRef: `${s.formCode ?? "QF 6.42"} ${s.revision ?? ""}`.trim(),
      items: s.items.map((i) => ({
        description: i.description.slice(0, 500),
        requirement: [i.requirement, i.group ? `Group: ${i.group}.` : "", i.role ? `Completed by: ${i.role}.` : ""].filter(Boolean).join(" ").slice(0, 1000),
        unit: i.unit,
        required: i.required,
      })),
    });
    created++;
  }
  console.log(`Created ${created} unapproved template(s). Approve them in Settings → Templates.`);

  if (args.includes("--register-document")) {
    const docNo = sections[0]?.formCode?.replace(/[a-z]$/i, "") ?? "QF 6.42";
    const revision = (sections.find((s) => s.revision)?.revision ?? "Rev.?").replace(/^Rev\.?/i, "");
    let doc = await db.document.findUnique({ where: { docNo } });
    if (!doc) doc = await createDocument(actor, { docNo, title: "Structural / Steel QC Inspection Report", docType: "Checklist" });
    if (await db.documentRevision.findUnique({ where: { documentId_revision: { documentId: doc.id, revision } } })) console.log(`Document ${docNo} rev ${revision} already registered.`);
    else {
      await addRevision(actor, doc.id, { revision, notes: `Imported from ${path.basename(file)}` }, { name: path.basename(file), data: buf });
      console.log(`Registered ${docNo} rev ${revision} (under review).`);
    }
  }

  if (args.includes("--stages")) {
    const vocab = await getSetting("vocabulary");
    const stages = [...new Set(sections.map((s) => s.title.replace(/^Section\s*[\d–-]*\s*[–-]?\s*/i, "").replace(/(\s*(QC|Checks?|Inspections?))+\s*$/i, "").trim()).filter(Boolean))];
    await updateSetting(actor, "vocabulary", { ...vocab, productionStages: stages });
    console.log(`Production stages set: ${stages.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
