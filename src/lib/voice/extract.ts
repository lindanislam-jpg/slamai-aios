import "server-only";
import { htmlToText, normalise } from "./chunking";
import { safeFetch } from "./egress";

/**
 * Turns an uploaded file or a web page into plain text.
 *
 * Deliberately, only the *text* is kept — the original binary is never stored.
 * The agent only ever needs the words, and not holding customer documents
 * removes a whole class of storage, retention and breach problems. If you need
 * the original file later, add object storage and set `sourceUrl`.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = [".pdf", ".docx", ".txt", ".md"];

export type Extracted = { text: string; bytes: number };

export async function extractFromFile(file: File): Promise<Extracted> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That file is larger than 10 MB. Split it or upload a smaller version.");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    // Imported lazily so the PDF engine is only loaded when a PDF is actually
    // uploaded, rather than on every cold start.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { text: normalise(result.text), bytes: file.size };
    } finally {
      await parser.destroy();
    }
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalise(result.value), bytes: file.size };
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return { text: normalise(buffer.toString("utf8")), bytes: file.size };
  }

  throw new Error(`Unsupported file type. Upload one of: ${ACCEPTED_UPLOAD_TYPES.join(", ")}.`);
}

/**
 * Fetches a page and reduces it to readable text.
 *
 * The URL comes from a tenant, so it goes through `safeFetch`, which resolves
 * the hostname, refuses any address that is not routable on the public
 * internet, and pins the connection to the address it approved. Whatever
 * comes back is stored and readable through the API, so this is a full-read
 * SSRF surface and a hostname-string check would not be a control.
 */
export async function extractFromUrl(rawUrl: string): Promise<Extracted> {
  const response = await safeFetch(rawUrl, {
    timeoutMs: 15_000,
    headers: { "User-Agent": "SlamAIVoice/1.0 (+https://slamai.io)" },
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error("That address redirects elsewhere. Use the final address instead.");
  }
  if (!response.ok) {
    throw new Error(`That page returned ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (body.length > MAX_UPLOAD_BYTES) {
    throw new Error("That page is too large to read.");
  }

  const text = contentType.includes("text/html") ? htmlToText(body) : normalise(body);
  if (!text) throw new Error("No readable text was found on that page.");

  return { text, bytes: body.length };
}

/** FAQ pairs read better to a model as labelled prose than as JSON. */
export function faqsToText(faqs: { question: string; answer: string }[]): string {
  return faqs.map((f) => `Question: ${f.question}\nAnswer: ${f.answer}`).join("\n\n");
}
