import PDFDocument from "pdfkit";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractPdfJpegs, jpegSize, pdfMatchKey } from "@/lib/pdf-jpegs";

async function jpeg(width: number, height: number, r: number) {
  return sharp({ create: { width, height, channels: 3, background: { r, g: 90, b: 40 } } }).jpeg({ quality: 80 }).toBuffer();
}

function pdfWith(images: Buffer[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (const img of images) {
      doc.addPage();
      doc.text("Inspection 1 (photo check)");
      doc.image(img, 50, 80, { width: 300 });
    }
    doc.end();
  });
}

describe("extractPdfJpegs", () => {
  it("returns the original JPEG bytes of every photo in a report, in order", async () => {
    const a = await jpeg(800, 600, 200);
    const b = await jpeg(640, 480, 20);
    const pdf = await pdfWith([a, b]);
    const found = extractPdfJpegs(new Uint8Array(pdf));
    expect(found).toHaveLength(2);
    expect(Buffer.from(found[0].bytes).equals(a)).toBe(true);
    expect(Buffer.from(found[1].bytes).equals(b)).toBe(true);
    expect(found[0]).toMatchObject({ width: 800, height: 600 });
  });

  it("skips small images such as logos, and the same photo placed twice", async () => {
    const photo = await jpeg(1000, 750, 120);
    const logo = await jpeg(120, 60, 250);
    const pdf = await pdfWith([logo, photo, photo]);
    const found = extractPdfJpegs(new Uint8Array(pdf));
    expect(found).toHaveLength(1);
    expect(found[0].width).toBe(1000);
  });

  it("skips the wide company-logo banner across the top of an MIS sheet but keeps photos and scanned pages", async () => {
    const banner = await jpeg(2251, 597, 30); // the size of the logo in Asgard MIS reports
    const photo = await jpeg(750, 1000, 140);
    const scan = await jpeg(1530, 1980, 230);
    const found = extractPdfJpegs(new Uint8Array(await pdfWith([banner, photo, scan])));
    expect(found.map((f) => `${f.width}x${f.height}`)).toEqual(["750x1000", "1530x1980"]);
  });

  it("returns nothing for a PDF without JPEG photos", async () => {
    const pdf = await pdfWith([]);
    expect(extractPdfJpegs(new Uint8Array(pdf))).toEqual([]);
  });

  it("reads JPEG dimensions and rejects non-JPEG data", async () => {
    expect(jpegSize(new Uint8Array(await jpeg(321, 123, 0)))).toEqual({ width: 321, height: 123 });
    expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });

  it("matches a SharePoint path and an uploaded file name by file name", () => {
    expect(pdfMatchKey("4.0 - Contract Docs/x/6. Incoming Inspections/2026.01.14-GWS-MIS-(PO-015625).pdf")).toBe("2026.01.14-gws-mis-(po-015625).pdf");
    expect(pdfMatchKey("C:\\Users\\me\\2026.01.14-GWS-MIS-(PO-015625).PDF")).toBe("2026.01.14-gws-mis-(po-015625).pdf");
  });
});
