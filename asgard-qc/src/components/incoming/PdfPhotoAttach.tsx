"use client";

import { upload } from "@vercel/blob/client";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractPdfJpegs, pdfMatchKey } from "@/lib/pdf-jpegs";

export interface PdfTarget { id: string; code: string; job: string; projectId: string; key: string; photos: number }
type Line = { file: string; status: "ok" | "skip" | "error"; text: string };

const CATEGORY = "Incoming materials";

/**
 * Attach the photos inside MIS report PDFs to the incoming inspections that
 * were transcribed from them. The person picks the PDFs (one, many, or a whole
 * folder); each is matched to its record by file name, its photos are taken
 * out in the browser without re-encoding, and uploaded like any other photo.
 * Nothing is matched by guesswork: a PDF with no record of the same file name
 * is listed and left alone.
 */
export function PdfPhotoAttach({ targets, direct, maxFileMb }: { targets: PdfTarget[]; direct: boolean; maxFileMb: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [again, setAgain] = useState(false);
  const byKey = new Map(targets.map((t) => [t.key, t]));
  const missing = targets.filter((t) => t.photos === 0).length;

  async function sendOne(projectHint: string, inspectionId: string, file: File, caption: string) {
    const meta = { inspectionId, category: CATEGORY, inspectionType: "INCOMING_MATERIAL", caption };
    let res: Response;
    if (direct) {
      const key = `photo-uploads/${projectHint}/${crypto.randomUUID()}.jpg`;
      await upload(key, file, { access: "private", handleUploadUrl: "/api/photos/blob", multipart: file.size > 8 * 1_048_576 });
      res = await fetch("/api/photos/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...meta, projectId: projectHint, key, fileName: file.name }) });
    } else {
      const fd = new FormData();
      fd.append("projectId", projectHint);
      for (const [k, v] of Object.entries(meta)) fd.append(k, v);
      fd.append("files", file, file.name);
      res = await fetch("/api/photos/upload", { method: "POST", body: fd });
    }
    const body = await res.json().catch(() => ({}));
    const r = body.result ?? body.results?.[0];
    if (!(res.ok && r?.ok)) throw new Error(r?.error ?? body.error ?? `upload failed (${res.status})`);
  }

  async function run(list: FileList | null) {
    if (!list?.length) return;
    const pdfs = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    const out: Line[] = [];
    setLines([]);
    const matched = pdfs.map((f) => ({ f, t: byKey.get(pdfMatchKey(f.name)) }));
    for (const [n, { f, t }] of matched.entries()) {
      setBusy(`Reading ${n + 1} of ${matched.length}: ${f.name}`);
      if (!t) { out.push({ file: f.name, status: "skip", text: "no incoming inspection was transcribed from a file with this name" }); setLines([...out]); continue; }
      if (t.photos > 0 && !again) { out.push({ file: f.name, status: "skip", text: `${t.code} already has ${t.photos} picture(s)` }); setLines([...out]); continue; }
      const projectId = t.projectId;
      try {
        const photos = extractPdfJpegs(new Uint8Array(await f.arrayBuffer()));
        if (!photos.length) { out.push({ file: f.name, status: "skip", text: `${t.code}: no photos could be taken out of this PDF (it may be a scan) — add pictures on the record by hand` }); setLines([...out]); continue; }
        const base = f.name.replace(/\.pdf$/i, "");
        let ok = 0;
        const errors: string[] = [];
        for (const [i, p] of photos.entries()) {
          setBusy(`${f.name}: photo ${i + 1} of ${photos.length}`);
          if (p.bytes.length > maxFileMb * 1_048_576) { errors.push(`photo ${i + 1} larger than ${maxFileMb} MB`); continue; }
          const file = new File([p.bytes as BlobPart], `${base}-photo-${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" });
          try {
            await sendOne(projectId, t.id, file, `Photo ${i + 1} of ${photos.length} from ${f.name}`);
            ok++;
          } catch (e) {
            errors.push(`photo ${i + 1}: ${e instanceof Error ? e.message : "failed"}`);
          }
        }
        out.push({ file: f.name, status: errors.length ? "error" : "ok", text: `${t.code} (${t.job}): ${ok} of ${photos.length} photo(s) attached${errors.length ? ` — ${errors.slice(0, 3).join("; ")}` : ""}` });
      } catch (e) {
        out.push({ file: f.name, status: "error", text: `${t.code}: ${e instanceof Error ? e.message : "could not read the PDF"}` });
      }
      setLines([...out]);
    }
    setBusy("");
    router.refresh();
  }

  const ok = lines.filter((l) => l.status === "ok").length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-300">
        {targets.length} incoming inspections were transcribed from MIS report PDFs on SharePoint; <b className="text-ink-100">{missing}</b> have no pictures yet.
        Choose the PDFs from your OneDrive copy of the job folders (you can select many at once, or a whole folder). Each PDF is matched to its record by file name and its photos are attached unchanged.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn-primary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><FileUp className="h-4 w-4" />Choose MIS PDFs
          <input type="file" multiple accept=".pdf,application/pdf" className="sr-only" disabled={!!busy} onChange={(e) => { void run(e.target.files); e.target.value = ""; }} />
        </label>
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><FileUp className="h-4 w-4" />Choose a whole folder
          {/* @ts-expect-error webkitdirectory is supported by Chrome, Edge, Safari and Firefox but not in React's types */}
          <input type="file" webkitdirectory="" multiple className="sr-only" disabled={!!busy} onChange={(e) => { void run(e.target.files); e.target.value = ""; }} />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-300"><input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />Also add to records that already have pictures</label>
      </div>
      {busy && <p className="text-sm text-gold-400" role="status">{busy}</p>}
      {lines.length > 0 && (
        <div>
          <p className="mb-1 text-sm">{ok} PDF(s) attached · {lines.length - ok} not attached</p>
          <ul className="max-h-72 space-y-0.5 overflow-auto rounded-lg border border-ink-600 p-2 text-xs">
            {lines.map((l, i) => (
              <li key={i} className={l.status === "ok" ? "text-ok-400" : l.status === "error" ? "text-bad-400" : "text-ink-300"}><b>{l.file}</b> — {l.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
