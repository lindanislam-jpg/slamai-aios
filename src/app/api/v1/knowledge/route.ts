import { db } from "@/lib/db";
import { requireTenant } from "@/lib/voice/tenant";
import { ok, badRequest, forbidden, serverError } from "@/lib/voice/http";
import { knowledgeSchema } from "@/lib/voice/validation";
import { getVoicePlan, isWithinLimit } from "@/lib/voice/plans";
import { extractFromFile, extractFromUrl, faqsToText, MAX_UPLOAD_BYTES } from "@/lib/voice/extract";
import { indexSource } from "@/lib/voice/retrieval";
import { recordAudit } from "@/lib/voice/audit";

export const runtime = "nodejs";
// Fetching a page and embedding a long document takes longer than the default.
export const maxDuration = 60;

export async function GET() {
  const gate = await requireTenant({ permission: "knowledge.read" });
  if (!gate.ok) return gate.response;

  try {
    const sources = await db.knowledgeSource.findMany({
      where: { businessId: gate.ctx.businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, type: true, sourceUrl: true, status: true,
        error: true, chunkCount: true, bytes: true, lastIndexedAt: true, createdAt: true,
      },
    });
    return ok({ sources });
  } catch (err) {
    return serverError("knowledge.get", err);
  }
}

/**
 * Accepts either JSON (url / text / FAQ) or multipart form data (an upload).
 * The source is extracted, stored as text and indexed before responding, so
 * the owner sees "ready" and can trust the agent already knows it.
 */
export async function POST(req: Request) {
  const gate = await requireTenant({ permission: "knowledge.write", write: true });
  if (!gate.ok) return gate.response;

  try {
    const plan = getVoicePlan(gate.ctx.planId);
    const count = await db.knowledgeSource.count({ where: { businessId: gate.ctx.businessId } });
    if (!isWithinLimit(plan.limits.knowledgeSources, count)) {
      return forbidden(
        `Your ${plan.name} plan includes ${plan.limits.knowledgeSources} knowledge sources. Upgrade to add more.`
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    let title: string;
    let type: string;
    let sourceUrl: string | null = null;
    let text: string;
    let bytes = 0;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return badRequest("Attach a file to upload.");
      if (file.size === 0) return badRequest("That file is empty.");
      if (file.size > MAX_UPLOAD_BYTES) return badRequest("That file is larger than 10 MB.");

      const extracted = await extractFromFile(file);
      title = (form.get("title") as string) || file.name;
      type = file.name.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : file.name.toLowerCase().endsWith(".docx")
          ? "docx"
          : "txt";
      text = extracted.text;
      bytes = extracted.bytes;
    } else {
      const raw = await req.json().catch(() => null);
      const parsed = knowledgeSchema.safeParse(raw);
      if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input.");
      const input = parsed.data;

      title = input.title;
      type = input.type;

      if (input.type === "url") {
        if (!input.sourceUrl) return badRequest("Enter the web address to read.");
        const extracted = await extractFromUrl(input.sourceUrl);
        sourceUrl = input.sourceUrl;
        text = extracted.text;
        bytes = extracted.bytes;
      } else if (input.type === "faq") {
        if (!input.faqs?.length) return badRequest("Add at least one question and answer.");
        text = faqsToText(input.faqs);
        bytes = text.length;
      } else {
        if (!input.content?.trim()) return badRequest("Enter the text the AI should know.");
        text = input.content;
        bytes = text.length;
      }
    }

    if (!text.trim()) return badRequest("No readable text was found in that source.");

    const source = await db.knowledgeSource.create({
      data: {
        businessId: gate.ctx.businessId,
        title: title.slice(0, 200),
        type,
        sourceUrl,
        rawText: text,
        bytes,
        status: "processing",
      },
    });

    try {
      await indexSource(source.id);
    } catch (err) {
      console.error("[knowledge] indexing failed", err);
      await db.knowledgeSource.update({
        where: { id: source.id },
        data: { status: "failed", error: "Could not index this source. Try refreshing it." },
      });
    }

    await recordAudit({
      businessId: gate.ctx.businessId,
      userId: gate.ctx.userId,
      action: "knowledge.uploaded",
      entityType: "knowledge_source",
      entityId: source.id,
      metadata: { type, title },
      req,
    });

    const saved = await db.knowledgeSource.findUnique({
      where: { id: source.id },
      select: {
        id: true, title: true, type: true, status: true, error: true,
        chunkCount: true, bytes: true, lastIndexedAt: true, createdAt: true, sourceUrl: true,
      },
    });

    return ok({ source: saved }, 201);
  } catch (err) {
    // Extraction failures are the user's to fix (bad URL, unreadable PDF), so
    // the message is shown to them rather than swallowed as a 500.
    if (err instanceof Error && err.message.length < 200) {
      return badRequest(err.message);
    }
    return serverError("knowledge.post", err);
  }
}
