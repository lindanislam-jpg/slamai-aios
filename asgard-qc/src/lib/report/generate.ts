import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { Actor } from "../permissions";
import { nextCode } from "../sequence";
import { storage } from "../storage";
import { assertCan, found } from "../services/base";
import { gatherReportData, REPORT_TYPES, type ReportParams } from "./data";
import { renderReportPdf } from "./pdf";

/** Generate, store and register a PDF report. Each regeneration of the same
 *  type for the same project/scope gets the next revision number. */
export async function generateReport(actor: Actor, params: ReportParams) {
  assertCan(actor, "report.generate");
  if (!(params.type in REPORT_TYPES)) throw new Error("Unknown report type");
  found(await db.project.findUnique({ where: { id: params.projectId } }), "Project");

  const earlier = await db.reportJob.findMany({ where: { projectId: params.projectId, reportType: params.type }, select: { params: true } });
  const previous = earlier.filter((j) => ((j.params as { unitId?: string | null }).unitId ?? null) === (params.unitId ?? null)).length;
  const job = await db.$transaction(async (tx) => {
    const code = await nextCode(tx, "QR", 5);
    return tx.reportJob.create({
      data: {
        code,
        reportType: params.type,
        projectId: params.projectId,
        params: { unitId: params.unitId ?? null, from: params.from?.toISOString() ?? null, to: params.to?.toISOString() ?? null } as Prisma.InputJsonValue,
        revision: previous + 1,
        status: "RUNNING",
        createdById: actor.id,
        createdByName: actor.name,
      },
    });
  });
  try {
    const data = await gatherReportData(params);
    const pdf = await renderReportPdf(data, { reportCode: job.code, revision: job.revision, generatedBy: actor.name });
    const key = `reports/${job.code}.pdf`;
    await storage().put(key, pdf, "application/pdf");
    const done = await db.reportJob.update({ where: { id: job.id }, data: { status: "COMPLETED", storageKey: key, sizeBytes: pdf.length, completedAt: new Date() } });
    await db.auditEvent.create({ data: { actorId: actor.id, actorName: actor.name, action: "report.generate", entityType: "ReportJob", entityId: job.id, summary: `${job.code} ${REPORT_TYPES[params.type]} rev ${job.revision}` } });
    return done;
  } catch (err) {
    await db.reportJob.update({ where: { id: job.id }, data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : "error" } });
    throw err;
  }
}
