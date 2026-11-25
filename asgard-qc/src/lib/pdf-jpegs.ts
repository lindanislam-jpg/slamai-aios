/**
 * Takes the photos out of a PDF report (e.g. a photo-app material inspection
 * sheet) without re-encoding them. Photos in such PDFs are stored as JPEG
 * image streams (/DCTDecode), so each one is a complete JPEG file sitting
 * between "stream" and "endstream". This finds those streams, checks each is
 * a well-formed JPEG and returns the original bytes, so the photo kept in the
 * app is exactly the one in the report.
 *
 * Images stored any other way (compressed PNG-style data, vector drawings) are
 * not returned; the caller reports how many photos were found.
 * Runs in the browser and in Node: plain Uint8Array, no dependencies.
 */

export interface PdfJpeg {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const STREAM = [0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // "stream"
const END = [0x65, 0x6e, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]; // "endstream"

function indexOf(hay: Uint8Array, needle: number[], from: number): number {
  const last = hay.length - needle.length;
  outer: for (let i = from; i <= last; i++) {
    if (hay[i] !== needle[0]) continue;
    for (let j = 1; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** Width and height from the JPEG's start-of-frame marker, or null if it is not a readable JPEG. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (b[i + 5] << 8) | b[i + 6];
      const width = (b[i + 7] << 8) | b[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (marker === 0xda) return null; // start of scan before any frame header
    i += 2 + len;
  }
  return null;
}

/**
 * All JPEG photos in the PDF, in file order, skipping exact duplicates,
 * images smaller than `minSide` pixels on their short side (icons) and
 * banner-shaped images wider than `maxAspect` : 1 (the company logo across the
 * top of an MIS sheet is about 3.8 : 1; photos and scanned pages are near 4 : 3).
 */
export function extractPdfJpegs(pdf: Uint8Array, minSide = 300, maxAspect = 2.5): PdfJpeg[] {
  const out: PdfJpeg[] = [];
  const seen = new Set<string>();
  let pos = 0;
  while (pos < pdf.length) {
    const s = indexOf(pdf, STREAM, pos);
    if (s < 0) break;
    let start = s + STREAM.length;
    if (pdf[start] === 0x0d) start++;
    if (pdf[start] === 0x0a) start++;
    // "endstream" also contains "stream": skip it, it is not a stream start.
    const isEnd = s >= 3 && pdf[s - 3] === 0x65 && pdf[s - 2] === 0x6e && pdf[s - 1] === 0x64;
    if (isEnd || !(pdf[start] === 0xff && pdf[start + 1] === 0xd8 && pdf[start + 2] === 0xff)) {
      pos = s + STREAM.length;
      continue;
    }
    const e = indexOf(pdf, END, start);
    if (e < 0) break;
    // The JPEG ends at its last end-of-image marker before "endstream".
    let stop = e;
    while (stop > start + 1 && !(pdf[stop - 2] === 0xff && pdf[stop - 1] === 0xd9)) {
      if (e - stop > 16) break; // only line endings may sit between the image and "endstream"
      stop--;
    }
    pos = e + END.length;
    if (!(pdf[stop - 2] === 0xff && pdf[stop - 1] === 0xd9)) continue;
    const bytes = pdf.slice(start, stop);
    const size = jpegSize(bytes);
    if (!size || Math.min(size.width, size.height) < minSide) continue;
    if (Math.max(size.width, size.height) / Math.min(size.width, size.height) > maxAspect) continue;
    const key = `${bytes.length}:${bytes[bytes.length >> 1]}:${bytes[bytes.length >> 2]}:${bytes[(bytes.length * 3) >> 2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bytes, ...size });
  }
  return out;
}

/** "…/6. Incoming Inspections/2026.01.14-GWS-MIS-(PO-015625).pdf" -> "2026.01.14-gws-mis-(po-015625).pdf" */
export function pdfMatchKey(pathOrName: string): string {
  return (pathOrName.split(/[\\/]/).pop() ?? "").trim().toLowerCase();
}
