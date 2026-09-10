import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, notFound, serverError } from "@/lib/voice/http";
import { recordAudit } from "@/lib/voice/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "knowledge.read" });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const source = await db.knowledgeSource.findFirst({
      where: { id, businessId: gate.ctx.businessId },
      include: {
        chunks: { orderBy: { ordinal: "asc" }, select: { id: true, ordinal: true, content: true, tokens: true } },
      },
    });
    if (!source) return notFound("That source no longer exists.");
    return ok({ source });
  } catch (err) {
    return serverError("knowledge.get.one", err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = await requireTenant({ permission: "knowledge.write", write: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await db.knowledgeSource.deleteMany({
      where: { id, businessId: gate.ctx.businessId },
    });
    if (result.count === 0) return notFound("That source no longer exists.");

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "knowledge.deleted",
      entityType: "knowledge_source",
      entityId: id,
      req,
    });

    return ok({ deleted: true });
  } catch (err) {
    return serverError("knowledge.delete", err);
  }
}
