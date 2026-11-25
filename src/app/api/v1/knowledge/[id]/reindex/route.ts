import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, badRequest, serverError } from "@/lib/voice/http";
import { indexSource } from "@/lib/voice/retrieval";
import { extractFromUrl } from "@/lib/voice/extract";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Re-reads a web source and rebuilds the index for any source. */
export async function POST(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "knowledge.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const source = await db.knowledgeSource.findFirst({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (!source) return notFound("That source no longer exists.");

    await db.knowledgeSource.update({ where: { id }, data: { status: "processing", error: null } });

    if (source.type === "url" && source.sourceUrl) {
      const extracted = await extractFromUrl(source.sourceUrl);
      await db.knowledgeSource.update({
        where: { id },
        data: { rawText: extracted.text, bytes: extracted.bytes },
      });
    }

    const result = await indexSource(id);

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "knowledge.reindexed",
      entityType: "knowledge_source",
      entityId: id,
      req,
    });

    const saved = await db.knowledgeSource.findUnique({ where: { id } });
    return ok({ source: saved, chunks: result.chunks });
  } catch (err) {
    await db.knowledgeSource
      .update({
        where: { id },
        data: {
          status: "failed",
          error: err instanceof Error ? err.message.slice(0, 200) : "Could not refresh this source.",
        },
      })
      .catch(() => undefined);

    if (err instanceof Error && err.message.length < 200) return badRequest(err.message);
    return serverError("knowledge.reindex", err);
  }
}
