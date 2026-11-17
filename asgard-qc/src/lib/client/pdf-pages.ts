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

/** The pictures to keep from an MIS report PDF: its photos unchanged when they
 *  can be taken out, otherwise one picture per page. */
export async function pdfToPictures(pdf: File): Promise<{ file: File; caption: string; asPages: boolean }[]> {
  const { extractPdfJpegs } = await import("../pdf-jpegs");
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  const base = pdf.name.replace(/\.pdf$/i, "");
  const photos = extractPdfJpegs(bytes);
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
