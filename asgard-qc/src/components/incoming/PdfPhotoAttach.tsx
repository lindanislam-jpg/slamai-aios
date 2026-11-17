"use client";

import { upload } from "@vercel/blob/client";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractPdfJpegs, pdfMatchKey } from "@/lib/pdf-jpegs";

export interface PdfTarget { id: string; code: string; job: string; projectId: string; key: string | null; label: string; photos: number }
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
  const byKey = new Map(targets.flatMap((t) => (t.key ? [[t.key, t] as const] : [])));
  // Same name ignoring spaces, dashes, brackets and dots, for small renames between SharePoint and OneDrive.
  const loose = (k: string) => k.replace(/\.pdf$/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const byLoose = new Map(targets.flatMap((t) => (t.key ? [[loose(t.key), t] as const] : [])));
  const match = (name: string) => byKey.get(pdfMatchKey(name)) ?? byLoose.get(loose(pdfMatchKey(name)));
  const sourced = targets.filter((t) => t.key);
  const missing = sourced.filter((t) => t.photos === 0).length;

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

  const [picked, setPicked] = useState<{ file: File; targetId: string; auto: boolean }[]>([]);
  const byId = new Map(targets.map((t) => [t.id, t]));

  function choose(list: FileList | null) {
    setLines([]);
    if (!list?.length) return;
    const pdfs = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) { setLines([{ file: "—", status: "error", text: "No PDF files in what you chose." }]); return; }
    setPicked(pdfs.map((file) => {
      const t = match(file.name);
      return { file, targetId: t?.id ?? "", auto: !!t };
    }));
  }

  async function run() {
    const todo = picked.filter((p) => p.targetId);
    const out: Line[] = [];
    setLines([]);
    try {
      for (const [n, { file: f, targetId }] of todo.entries()) {
        const t = byId.get(targetId)!;
        setBusy(`Reading ${n + 1} of ${todo.length}: ${f.name}`);
        if (t.photos > 0 && !again) { out.push({ file: f.name, status: "skip", text: `${t.code} already has ${t.photos} picture(s) — tick "Also add to records that already have pictures" to add anyway` }); setLines([...out]); continue; }
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
              await sendOne(t.projectId, t.id, file, `Photo ${i + 1} of ${photos.length} from ${f.name}`);
              ok++;
            } catch (e) {
              errors.push(`photo ${i + 1}: ${e instanceof Error ? e.message : "failed"}`);
            }
          }
          const dup = errors.filter((e) => /already uploaded/i.test(e)).length;
          if (dup && dup === errors.length && ok === 0) { out.push({ file: f.name, status: "skip", text: `${t.code}: these ${dup} photo(s) are already in the app — nothing added twice` }); setLines([...out]); continue; }
          out.push({ file: f.name, status: errors.length ? "error" : "ok", text: `${t.code} (${t.job}): ${ok} of ${photos.length} photo(s) attached${errors.length ? ` — ${errors.slice(0, 3).join("; ")}` : ""}` });
        } catch (e) {
          out.push({ file: f.name, status: "error", text: `${t.code}: ${e instanceof Error ? e.message : "could not read the PDF"}` });
        }
        setLines([...out]);
      }
    } catch (e) {
      out.push({ file: "—", status: "error", text: e instanceof Error ? e.message : "Something went wrong — nothing after this point was added." });
      setLines([...out]);
    } finally {
      setBusy("");
      setPicked([]);
      router.refresh();
    }
  }

  const ok = lines.filter((l) => l.status === "ok").length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-300">
        {sourced.length} incoming inspections were transcribed from MIS report PDFs on SharePoint; <b className="text-ink-100">{missing}</b> have no pictures yet.
        Choose the PDFs from your OneDrive copy of the job folders (you can select many at once, or a whole folder). Each PDF is matched to its record by file name and its photos are attached unchanged.
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-600 p-3">
        <span className="text-sm font-semibold text-ink-100">1.</span>
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><FileUp className="h-4 w-4" />Choose MIS PDFs
          <input type="file" multiple accept=".pdf,application/pdf" className="sr-only" disabled={!!busy} onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
        </label>
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><FileUp className="h-4 w-4" />Choose a whole folder
          {/* @ts-expect-error webkitdirectory is supported by Chrome, Edge, Safari and Firefox but not in React's types */}
          <input type="file" webkitdirectory="" multiple className="sr-only" disabled={!!busy} onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
        </label>
        <span className="ml-2 text-sm font-semibold text-ink-100">2.</span>
        <button type="button" className="btn-primary" disabled={!!busy || !picked.some((p) => p.targetId)} onClick={() => void run()}>
          Add photos{picked.length ? ` to ${new Set(picked.filter((p) => p.targetId).map((p) => p.targetId)).size} record(s)` : ""}
        </button>
        <span className="text-xs text-ink-300" role="status">
          {busy ? "" : !picked.length ? "No PDFs chosen yet." : `${picked.length} PDF(s) chosen · ${picked.filter((p) => p.targetId).length} matched${picked.some((p) => !p.targetId) ? " · pick the record for the others below" : ""}`}
        </span>
        <label className="flex basis-full items-center gap-2 text-xs text-ink-300"><input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />Also add to records that already have pictures</label>
      </div>
      {picked.length > 0 && !busy && (
        <div className="rounded-lg border border-ink-600 p-3">
          <p className="mb-2 text-sm">Check the record for each PDF (change it if needed), then click <b>Add photos</b>.</p>
          <div className="max-h-80 overflow-auto">
            <table className="tbl">
              <thead><tr><th>PDF</th><th>Add its photos to</th></tr></thead>
              <tbody>
                {picked.map((p, i) => (
                  <tr key={`${p.file.name}-${i}`}>
                    <td className="max-w-72 truncate text-xs" title={p.file.name}>{p.file.name}</td>
                    <td>
                      <select className="input h-8 py-0 text-xs" value={p.targetId} aria-label={`Record for ${p.file.name}`} onChange={(e) => setPicked((cur) => cur.map((x, j) => (j === i ? { ...x, targetId: e.target.value, auto: false } : x)))}>
                        <option value="">— don&apos;t add (no matching record) —</option>
                        {targets.map((t) => <option key={t.id} value={t.id}>{t.job} · {t.code} · {t.label}{t.photos ? ` (${t.photos} pictures)` : ""}</option>)}
                      </select>
                      {!p.targetId && <div className="mt-0.5 text-[11px] text-warn-400">No record found with this file name — pick one, or leave it out.</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPicked([])}>Clear the chosen PDFs</button>
          </div>
        </div>
      )}
      {busy && <p className="text-sm text-gold-400" role="status">{busy}</p>}
      {lines.length > 0 && !busy && (
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
