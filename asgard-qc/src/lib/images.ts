import "server-only";
import { createHash } from "node:crypto";
import exifr from "exifr";
import sharp from "sharp";
import { ValidationError } from "./errors";

export type ImageKind = "jpeg" | "png" | "heic";

const MIME: Record<ImageKind, string> = { jpeg: "image/jpeg", png: "image/png", heic: "image/heic" };
const EXT: Record<ImageKind, string> = { jpeg: "jpg", png: "png", heic: "heic" };

/** Identify the file by its bytes, not its name or the browser's claim. */
export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

export interface ProcessedImage {
  kind: ImageKind;
  mimeType: string;
  ext: string;
  sha256: string;
  width: number | null;
  height: number | null;
  /** From EXIF DateTimeOriginal/CreateDate only. Null when absent. */
  takenAt: Date | null;
  /** JPEG thumbnail, or null when the format cannot be decoded on this server. */
  thumbnail: Buffer | null;
}

export async function processImage(buf: Buffer, maxBytes: number): Promise<ProcessedImage> {
  if (buf.length === 0) throw new ValidationError("The file is empty.");
  if (buf.length > maxBytes) {
    throw new ValidationError(`File is larger than the ${Math.round(maxBytes / 1_048_576)} MB limit.`);
  }
  const kind = sniffImage(buf);
  if (!kind) throw new ValidationError("Only JPG, PNG and HEIC photographs are accepted.");

  const sha256 = createHash("sha256").update(buf).digest("hex");

  let takenAt: Date | null = null;
  try {
    const exif = await exifr.parse(buf, { pick: ["DateTimeOriginal", "CreateDate"] });
    const t = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (t instanceof Date && !Number.isNaN(t.getTime())) takenAt = t;
  } catch {
    // No or unreadable EXIF — leave takenAt null rather than guessing.
  }

  let width: number | null = null;
  let height: number | null = null;
  let thumbnail: Buffer | null = null;
  try {
    // HEVC-encoded HEIC is not decodable by the bundled libvips; those files
    // are stored as originals without previews (see docs/LIMITATIONS.md).
    const img = sharp(buf, { failOn: "error" }).rotate();
    const meta = await sharp(buf).metadata();
    const swap = (meta.orientation ?? 1) >= 5;
    width = (swap ? meta.height : meta.width) ?? null;
    height = (swap ? meta.width : meta.height) ?? null;
    thumbnail = await img.clone().resize(480, 480, { fit: "inside" }).jpeg({ quality: 78 }).toBuffer();
  } catch (err) {
    if (kind !== "heic") throw new ValidationError("The image could not be read — it may be corrupt.");
    void err;
  }

  return { kind, mimeType: MIME[kind], ext: EXT[kind], sha256, width, height, takenAt, thumbnail };
}

/** Downscaled, orientation-corrected JPEG for embedding in PDF reports.
 *  Returns null for formats this server cannot decode. */
export async function reportImage(original: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(original).rotate().resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    return null;
  }
}
