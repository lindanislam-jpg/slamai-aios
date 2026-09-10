import "server-only";
import { db } from "@/lib/db";
import { getAIProvider } from "./ai";
import { recordUsage } from "./usage";

/**
 * Knowledge retrieval (the R in RAG).
 *
 * Strategy: embeddings are stored as a plain float array on KnowledgeChunk and
 * cosine similarity is computed in Node over the tenant's own chunks. That is
 * exact, needs no database extension, and is fast at the scale a single
 * business's knowledge base reaches (hundreds to low thousands of chunks).
 *
 * Upgrade path, documented in docs/DATABASE.md: install pgvector, change the
 * column to `vector(1536)`, add an ivfflat index and replace `search` with an
 * ORDER BY on the `<=>` operator. Nothing outside this file changes.
 *
 * When no AI provider is configured the search degrades to keyword matching
 * rather than failing, so a knowledge base still works without embeddings.
 */

export type RetrievedChunk = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  score: number;
};

/** Above this the passage is treated as genuinely relevant. */
const MIN_SIMILARITY = 0.25;
/** Cap on chunks scanned per query, so one tenant cannot stall a call. */
const MAX_SCANNED = 5000;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function search(
  businessId: string,
  query: string,
  limit = 4
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const ai = getAIProvider();
  if (!ai.isConfigured()) return keywordSearch(businessId, trimmed, limit);

  let queryVector: number[];
  try {
    [queryVector] = await ai.embed([trimmed]);
  } catch (err) {
    console.error("[retrieval] embedding failed, falling back to keyword search", err);
    return keywordSearch(businessId, trimmed, limit);
  }

  const chunks = await db.knowledgeChunk.findMany({
    where: { businessId, source: { status: "ready" } },
    select: {
      id: true, sourceId: true, content: true, embedding: true,
      source: { select: { title: true } },
    },
    take: MAX_SCANNED,
  });

  const scored = chunks
    .filter((c) => c.embedding.length > 0)
    .map((c) => ({
      id: c.id,
      sourceId: c.sourceId,
      sourceTitle: c.source.title,
      content: c.content,
      score: cosineSimilarity(queryVector, c.embedding),
    }))
    .filter((c) => c.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  void recordUsage(businessId, "knowledge_searches", 1);
  return scored;
}

/** Used when embeddings are unavailable. Crude, but never returns nonsense. */
async function keywordSearch(
  businessId: string,
  query: string,
  limit: number
): Promise<RetrievedChunk[]> {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3)
    .slice(0, 6);
  if (terms.length === 0) return [];

  const chunks = await db.knowledgeChunk.findMany({
    where: {
      businessId,
      source: { status: "ready" },
      OR: terms.map((term) => ({ content: { contains: term, mode: "insensitive" as const } })),
    },
    select: { id: true, sourceId: true, content: true, source: { select: { title: true } } },
    take: 50,
  });

  return chunks
    .map((c) => {
      const haystack = c.content.toLowerCase();
      const hits = terms.filter((t) => haystack.includes(t)).length;
      return {
        id: c.id,
        sourceId: c.sourceId,
        sourceTitle: c.source.title,
        content: c.content,
        score: hits / terms.length,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Embeds and stores a source's chunks, replacing anything indexed before. */
export async function indexSource(sourceId: string): Promise<{ chunks: number }> {
  const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Knowledge source not found");

  const { chunkText, estimateTokens } = await import("./chunking");
  const pieces = chunkText(source.rawText ?? "");

  await db.knowledgeChunk.deleteMany({ where: { sourceId } });

  if (pieces.length === 0) {
    await db.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "failed", error: "No readable text was found in this source.", chunkCount: 0 },
    });
    return { chunks: 0 };
  }

  const ai = getAIProvider();
  let vectors: number[][] = [];

  if (ai.isConfigured()) {
    try {
      // Batched so a large document does not exceed the provider's request cap.
      for (let i = 0; i < pieces.length; i += 64) {
        vectors.push(...(await ai.embed(pieces.slice(i, i + 64))));
      }
    } catch (err) {
      console.error("[retrieval] embedding failed; storing text for keyword search", err);
      vectors = [];
    }
  }

  await db.knowledgeChunk.createMany({
    data: pieces.map((content, ordinal) => ({
      businessId: source.businessId,
      sourceId,
      ordinal,
      content,
      tokens: estimateTokens(content),
      embedding: vectors[ordinal] ?? [],
    })),
  });

  await db.knowledgeSource.update({
    where: { id: sourceId },
    data: {
      status: "ready",
      error: null,
      chunkCount: pieces.length,
      lastIndexedAt: new Date(),
    },
  });

  return { chunks: pieces.length };
}
