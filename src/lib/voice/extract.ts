import "server-only";
import { htmlToText, normalise } from "./chunking";

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
 * SSRF guard: only public http(s) URLs are followed, redirects are not
 * followed automatically, and private address ranges are refused — a tenant
 * must not be able to make the server read its own internal network.
 */
export async function extractFromUrl(rawUrl: string): Promise<Extracted> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https addresses can be read.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error("That address is not reachable from the public internet.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

/** Blocks loopback, link-local and RFC1918 ranges, plus bare hostnames. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (!host.includes(".")) return true;
  if (host.startsWith("[") || host.includes(":")) return true;

  // Anything made only of digits and dots is an address, not a name. It is
  // matched loosely on purpose: the resolver reads a zero-padded octet as
  // octal (0177.0.0.1 is 127.0.0.1), so a strict dotted-quad match would let
  // non-canonical spellings of loopback straight through.
  if (/^[\d.]+$/.test(host)) {
    const octets = host.split(".");
    if (octets.length !== 4 || octets.some((o) => o === "" || o.length > 3)) return true;
    // A leading zero means the resolver will read the octet as octal, so the
    // decimal value below would not be the address actually dialled.
    if (octets.some((o) => o.length > 1 && o.startsWith("0"))) return true;

    const [a, b] = octets.map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    // Carrier-grade NAT, which cloud metadata and internal load balancers use.
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  return false;
}

/** FAQ pairs read better to a model as labelled prose than as JSON. */
export function faqsToText(faqs: { question: string; answer: string }[]): string {
  return faqs.map((f) => `Question: ${f.question}\nAnswer: ${f.answer}`).join("\n\n");
}
