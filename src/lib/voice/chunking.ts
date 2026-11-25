/**
 * Splits source text into passages small enough to quote on a phone call but
 * large enough to keep their meaning. Pure functions — no I/O — so they are
 * cheap to test.
 */

/** Roughly four characters per token; good enough for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const TARGET_CHARS = 1200;
const OVERLAP_CHARS = 150;

/**
 * Chunks on paragraph boundaries where possible, falling back to sentences,
 * with a small overlap so an answer spanning a boundary is still retrievable.
 */
export function chunkText(raw: string, targetChars = TARGET_CHARS): string[] {
  const text = normalise(raw);
  if (!text) return [];
  if (text.length <= targetChars) return [text];

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > targetChars) {
      flush();
      for (const piece of splitLongParagraph(paragraph, targetChars)) chunks.push(piece);
      continue;
    }
    if (current.length + paragraph.length + 2 > targetChars) {
      const tail = current.slice(-OVERLAP_CHARS);
      flush();
      current = tail ? `${tail.trim()}\n\n` : "";
    }
    current += `${paragraph}\n\n`;
  }
  flush();

  return chunks.filter((c) => c.length > 20);
}

function splitLongParagraph(paragraph: string, targetChars: number): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|\S+$/g) ?? [paragraph];
  const out: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > targetChars && current) {
      out.push(current.trim());
      current = current.slice(-OVERLAP_CHARS);
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function normalise(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Strips a fetched HTML page down to readable text. Deliberately dependency
 * free: script, style and nav furniture go, then tags are removed and entities
 * decoded.
 */
export function htmlToText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalise(decodeEntities(body));
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü",
    hellip: "…", mdash: "—", ndash: "–", rsquo: "'", lsquo: "'",
    ldquo: '"', rdquo: '"', euro: "€", pound: "£", copy: "©",
  };
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}
