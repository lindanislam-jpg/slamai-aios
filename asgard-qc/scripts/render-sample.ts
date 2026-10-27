// Dev helper: render a report for the first demo project to a local file.
import { writeFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { gatherReportData, type ReportType } from "../src/lib/report/data";
import { renderReportPdf } from "../src/lib/report/pdf";

async function main() {
  const type = (process.argv[2] ?? "DETAILED") as ReportType;
  const out = process.argv[3] ?? "sample-report.pdf";
  const p = await db.project.findFirstOrThrow({ orderBy: { code: "asc" } });
  const data = await gatherReportData({ type, projectId: p.id });
  writeFileSync(out, await renderReportPdf(data, { reportCode: "QR-SAMPLE", revision: 1, generatedBy: "sample script" }));
  console.log("wrote", out);
}

main().finally(() => db.$disconnect());
