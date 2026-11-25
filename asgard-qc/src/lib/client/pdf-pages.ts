"use client";

/**
 * Turns the pages of a PDF into JPEG images in the browser, for MIS reports
 * whose photos are not stored as plain JPEGs (or scans). Each page becomes one
 * picture, so the record always gets visual evidence from its report.
 * pdf.js is loaded only when needed; its worker is served from /public.
 */
export async function renderPdfPages(data: Uint8Array, opts: { maxPages?: number; maxWidth?: number } = {}): Promise<{ blob: Blob; page: number; pages: number }[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  // getDocument takes ownership of the buffer, so give it a copy.
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  const pages = doc.numPages;
  const out: { blob: Blob; page: number; pages: number }[] = [];
  const last = Math.min(pages, opts.maxPages ?? 40);
  for (let n = 1; n <= last; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, (opts.maxWidth ?? 1600) / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (blob) out.push({ blob, page: n, pages });
    page.cleanup();
  }
  await doc.destroy();
  return out;
}

/**
 * True for an image that is almost entirely white: the signature box of an MIS
 * sheet (about 88% white in Asgard's reports). Photos and scanned delivery
 * notes are well below this. If the browser cannot decode the image it is kept.
 */
export async function isMostlyBlank(bytes: Uint8Array, threshold = 0.8): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/jpeg" }), { resizeWidth: 64, resizeHeight: 64 });
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(bmp, 0, 0, 64, 64);
    bmp.close();
    const px = ctx.getImageData(0, 0, 64, 64).data;
    let white = 0;
    for (let i = 0; i < px.length; i += 4) if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] > 235) white++;
    return white / (px.length / 4) > threshold;
  } catch {
    return false;
  }
}

/** The pictures to keep from an MIS report PDF: its photos unchanged when they
 *  can be taken out (leaving out the logo banner and the blank signature box),
 *  otherwise one picture per page. */
export async function pdfToPictures(pdf: File): Promise<{ file: File; caption: string; asPages: boolean }[]> {
  const { extractPdfJpegs } = await import("../pdf-jpegs");
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  const base = pdf.name.replace(/\.pdf$/i, "");
  const found = extractPdfJpegs(bytes);
  const blank = await Promise.all(found.map((p) => isMostlyBlank(p.bytes)));
  const photos = found.filter((_, i) => !blank[i]);
  if (photos.length) {
    return photos.map((p, i) => ({
      file: new File([p.bytes as BlobPart], `${base}-photo-${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" }),
      caption: `Photo ${i + 1} of ${photos.length} from ${pdf.name}`,
      asPages: false,
    }));
  }
  return (await renderPdfPages(bytes)).map((pg) => ({
    file: new File([pg.blob], `${base}-page-${String(pg.page).padStart(2, "0")}.jpg`, { type: "image/jpeg" }),
    caption: `Page ${pg.page} of ${pg.pages} of MIS report ${pdf.name}`,
    asPages: true,
  }));
}
