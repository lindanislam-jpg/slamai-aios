import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { recordEvent } from "../audit";
import { AppError, ValidationError } from "../errors";
import { reportImage } from "../images";
import type { Actor } from "../permissions";
import { getSetting } from "../settings";
import { storage } from "../storage";
import { assertCan, found } from "../services/base";
import { WELD_DEFECT_CATEGORIES } from "../domain/constants";

/**
 * Optional AI-assisted photo review. Produces DRAFT captions, a suggested
 * category and *possible* observations for an inspector to accept or ignore.
 * It never confirms defects, never measures, and never accepts or releases
 * anything — those fields do not exist in its output schema.
 */
export function aiStatus() {
  const configured = !!process.env.ANTHROPIC_API_KEY && process.env.AI_VISION_ENABLED !== "false";
  return {
    configured,
    model: process.env.AI_VISION_MODEL || "claude-opus-5-5",
    reason: configured ? null : "Set ANTHROPIC_API_KEY (and leave AI_VISION_ENABLED unset or true) to enable AI-assisted photo review.",
  };
}

const SuggestionSchema = z.object({
  caption: z.string().describe("Neutral one-line caption of what is visible, under 120 characters."),
  description: z.string().describe("Two to four sentences describing what is visible. No compliance judgements."),
  category: z.string().describe("The single best-fitting category from the provided list, copied exactly."),
  possibleObservations: z
    .array(z.string())
    .describe("Visible conditions that may warrant an inspector's attention, each phrased as 'Possible …'. Empty if none."),
  possibleDefectCategories: z.array(z.string()).describe("Weld defect categories from the provided list that an inspector may want to check. Empty if none or not a weld photo."),
  visibleText: z.string().describe("Any legible markings (e.g. stamped or painted IDs) transcribed exactly, or empty string. Do not guess partial characters."),
  imageQualityNotes: z.string().describe("Issues limiting review (blur, glare, distance), or empty string."),
});

export type AiSuggestion = z.infer<typeof SuggestionSchema> & { model: string; generatedAt: string; disclaimer: string };

const SYSTEM = `You help a steel fabrication quality department organise factory photographs.
You produce DRAFT metadata that a qualified inspector will review. You are not an inspector.
Rules:
- Describe only what is visible. Phrase any concern as a possibility ("Possible undercut along the toe"), never as a finding.
- Never state or imply that anything is compliant, acceptable, certified, safe, or approved, and never suggest release.
- Never estimate measurements, sizes, thicknesses, tolerances, grades, heat numbers, WPS references or test results. Transcribe markings only if fully legible.
- If the image does not show enough to say something, say so.`;

export async function suggestForPhoto(actor: Actor, photoId: string): Promise<AiSuggestion> {
  assertCan(actor, "photo.edit");
  const status = aiStatus();
  if (!status.configured) throw new AppError(status.reason!, 503);
  const photo = found(await db.photo.findUnique({ where: { id: photoId } }), "Photo");
  const jpeg = await reportImage(await storage().get(photo.storageKey));
  if (!jpeg) throw new ValidationError("This image format cannot be processed on the server (HEIC). Convert to JPEG to use AI review.");
  const vocab = await getSetting("vocabulary");

  const client = new Anthropic();
  let parsed: z.infer<typeof SuggestionSchema> | null = null;
  try {
    const response = await client.beta.messages.parse({
      model: status.model,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(SuggestionSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
            {
              type: "text",
              text: [
                `Photo categories (choose exactly one): ${vocab.photoCategories.join(" | ")}`,
                `Weld defect categories (for possibleDefectCategories only): ${WELD_DEFECT_CATEGORIES.join(" | ")}`,
                photo.stage ? `Recorded production stage: ${photo.stage}` : "",
                photo.caption ? `Existing caption from the uploader: ${photo.caption}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new AppError("The AI service declined to describe this image.", 502);
    parsed = response.parsed_output;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new AppError("AI service rejected the API key. Check ANTHROPIC_API_KEY.", 502);
    if (err instanceof Anthropic.RateLimitError) throw new AppError("AI service is rate limited. Try again shortly.", 503);
    if (err instanceof Anthropic.APIError) throw new AppError(`AI service error (${err.status ?? "network"}). The photo is unaffected.`, 502);
    throw err;
  }
  if (!parsed) throw new AppError("AI service returned an unreadable response.", 502);

  // Keep the model inside our vocabularies.
  const category = vocab.photoCategories.includes(parsed.category) ? parsed.category : "General quality evidence";
  const defects = parsed.possibleDefectCategories.filter((d) => (WELD_DEFECT_CATEGORIES as readonly string[]).includes(d));
  const suggestion: AiSuggestion = {
    ...parsed,
    category,
    possibleDefectCategories: defects,
    model: status.model,
    generatedAt: new Date().toISOString(),
    disclaimer: "AI draft — possible observations only. Not an inspection result. Requires review by an authorised inspector.",
  };
  await db.$transaction(async (tx) => {
    await tx.photo.update({ where: { id: photoId }, data: { aiSuggestion: suggestion as unknown as Prisma.InputJsonValue } });
    await recordEvent(tx, actor, "photo.ai_suggest", "Photo", photoId, { summary: `${photo.code}: AI draft generated (${status.model}) — not applied` });
  });
  return suggestion;
}
