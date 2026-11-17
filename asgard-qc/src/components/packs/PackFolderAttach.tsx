"use client";

import { upload } from "@vercel/blob/client";
import { FolderUp, FileUp, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { attachPackFilesAction } from "@/app/(app)/quality-packs/actions";
import { buildPackIndex, matchPackFile } from "@/lib/pack-match";

export interface PackTarget { id: string; code: string; name: string; kind: string; stage: string; job: string; projectId: string; sourcePath: string | null; files: number }
type Picked = { file: File; path: string; pack: PackTarget };
type Line = { text: string; status: "ok" | "skip" | "error" };

const CATEGORY = "Handover / QC pack";
const extOf = (n: string) => /\.([a-z0-9]{1,5})$/i.exec(n)?.[1].toLowerCase() ?? "";

/**
 * Attach the files of the quality packs from a OneDrive copy of the
 * SharePoint folders: pick or drag a folder (a project, or the whole Large
 * Projects folder); each file is matched to its pack by path and stored as a
 * project file linked to that pack. Nothing is matched by guesswork.
 */
export function PackFolderAttach({ packs, extensions, maxFileMb, direct }: { packs: PackTarget[]; extensions: readonly string[]; maxFileMb: number; direct: boolean }) {
  const router = useRouter();
  const index = useMemo(() => buildPackIndex(packs), [packs]);
  const byId = useMemo(() => new Map(packs.map((p) => [p.id, p])), [packs]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [again, setAgain] = useState(false);
  const [drag, setDrag] = useState(false);
  const imported = packs.filter((p) => p.sourcePath);
  const empty = imported.filter((p) => p.files === 0).length;

  function choose(files: { file: File; path: string }[]) {
    setLines([]);
    if (!files.length) {
      setPicked([]);
      setNote("The browser gave the app no files. With OneDrive this happens when files are online-only (right-click the folder → Always keep on this device) or the \"Upload files?\" prompt was cancelled. Dragging the folder onto this box also works.");
      return;
    }
    const keep: Picked[] = [];
    let ambiguous = 0, unmatched = 0, wrongType = 0, hasFiles = 0;
    for (const f of files) {
      if (!extensions.includes(extOf(f.file.name)) || f.file.size === 0) { wrongType++; continue; }
      const m = matchPackFile(index, f.path || f.file.name);
      if (!m) { unmatched++; continue; }
      if ("ambiguous" in m) { ambiguous++; continue; }
      const pack = byId.get(m.pack.id)!;
      if (pack.files > 0 && !again) { hasFiles++; continue; }
      keep.push({ file: f.file, path: f.path, pack });
    }
    const packCount = new Set(keep.map((k) => k.pack.id)).size;
    setPicked(keep);
    setNote(`Read ${files.length} file(s): ${keep.length} belong to ${packCount} pack(s)` +
      (hasFiles ? ` · ${hasFiles} skipped (pack already has files)` : "") +
      (ambiguous ? ` · ${ambiguous} could fit more than one pack — choose a project folder (or Large Projects) rather than an Issued/Returned folder` : "") +
      (unmatched ? ` · ${unmatched} not in any pack folder` : "") + (wrongType ? ` · ${wrongType} other file type(s) ignored` : "") + ".");
  }

  async function readDropped(items: DataTransferItemList) {
    type Entry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string; file?: (ok: (f: File) => void, err: (e: unknown) => void) => void; createReader?: () => { readEntries: (ok: (e: Entry[]) => void, err: (e: unknown) => void) => void } };
    const out: { file: File; path: string }[] = [];
    const walk = async (e: Entry): Promise<void> => {
      if (e.isFile && e.file) out.push({ file: await new Promise<File>((ok, err) => e.file!(ok, err)), path: e.fullPath.replace(/^\//, "") });
      else if (e.isDirectory && e.createReader) {
        const reader = e.createReader();
        for (;;) {
          const batch = await new Promise<Entry[]>((ok, err) => reader.readEntries(ok, err));
          if (!batch.length) break;
          for (const c of batch) await walk(c);
          setNote(`Reading the folder… ${out.length} file(s) so far`);
        }
      }
    };
    const roots = Array.from(items).map((i) => (i as unknown as { webkitGetAsEntry: () => Entry | null }).webkitGetAsEntry()).filter((x): x is Entry => !!x);
    setNote("Reading the folder…");
    for (const r of roots) await walk(r);
    choose(out);
  }

  async function uploadOne(projectId: string, f: File, packCode: string): Promise<string> {
    const meta = { category: CATEGORY, unitId: "", notes: `Quality pack ${packCode}` };
    if (direct) {
      const key = `project-files/${projectId}/${crypto.randomUUID()}.${extOf(f.name)}`;
      await upload(key, f, { access: "private", handleUploadUrl: `/api/projects/${projectId}/files/blob`, multipart: f.size > 8 * 1_048_576 });
      const res = await fetch(`/api/projects/${projectId}/files/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, fileName: f.name, ...meta }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok && body.code) return body.code;
      throw new Error(body.error ?? "upload failed");
    }
    const fd = new FormData();
    fd.append("files", f, f.name);
    for (const [k, v] of Object.entries(meta)) fd.append(k, v);
    const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    const r = body.results?.[0];
    if (res.ok && r?.ok && r.code) return r.code;
    throw new Error(r?.error ?? body.error ?? (res.status === 413 ? "file too large for the server" : "upload failed"));
  }

  async function run() {
    const out: Line[] = [];
    const links: { packId: string; fileCode: string }[] = [];
    const perPack = new Map<string, { ok: number; failed: string[] }>();
    try {
      for (const [i, p] of picked.entries()) {
        setBusy(`Uploading ${i + 1} of ${picked.length}: ${p.file.name}`);
        const tally = perPack.get(p.pack.id) ?? { ok: 0, failed: [] };
        perPack.set(p.pack.id, tally);
        if (p.file.size > maxFileMb * 1_048_576) { tally.failed.push(`${p.file.name} larger than ${maxFileMb} MB`); continue; }
        try {
          links.push({ packId: p.pack.id, fileCode: await uploadOne(p.pack.projectId, p.file, p.pack.code) });
          tally.ok++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "failed";
          // The same file is already on the project: link that copy instead.
          const existing = /as (FL-\d+)/.exec(msg)?.[1];
          if (existing) { links.push({ packId: p.pack.id, fileCode: existing }); tally.ok++; }
          else tally.failed.push(`${p.file.name}: ${msg}`);
        }
      }
      setBusy("Linking the files to their packs…");
      for (let i = 0; i < links.length; i += 200) {
        const r = await attachPackFilesAction([...new Set(picked.map((p) => p.pack.projectId))], links.slice(i, i + 200));
        if (!r.ok) out.push({ text: r.error, status: "error" });
        else for (const pr of r.problems) out.push({ text: pr, status: "error" });
      }
      for (const [id, t] of perPack) {
        const pk = byId.get(id)!;
        out.unshift({ text: `${pk.job} · ${pk.code} ${pk.name} (${pk.stage === "RETURNED" ? "returned" : "issued"}): ${t.ok} file(s) attached${t.failed.length ? ` — ${t.failed.slice(0, 3).join("; ")}` : ""}`, status: t.failed.length ? "error" : "ok" });
      }
    } catch (e) {
      out.push({ text: e instanceof Error ? e.message : "Something went wrong — nothing after this point was attached.", status: "error" });
    } finally {
      setLines(out);
      setBusy("");
      setPicked([]);
      setNote("");
      router.refresh();
    }
  }

  const packsReady = new Set(picked.map((p) => p.pack.id)).size;
  return (
    <div
      className={`space-y-3 rounded-lg ${drag ? "outline-dashed outline-2 outline-gold-500" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) void readDropped(e.dataTransfer.items); }}
    >
      <p className="text-sm text-ink-300">
        {imported.length} packs were listed from SharePoint; <b className="text-ink-100">{empty}</b> have no files in the app yet.
        Quickest: <b>drag your OneDrive project folder</b> (or the whole <b>0.2 - Large Projects</b> folder) onto this box, or click <b>Choose a folder</b>. Every file is matched to its pack by its folder path and attached; then click <b>Attach files</b>.
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-600 p-3">
        <span className="text-sm font-semibold text-ink-100">1.</span>
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><FolderUp className="h-4 w-4" />Choose a folder
          {/* @ts-expect-error webkitdirectory is supported by Chrome, Edge, Safari and Firefox but not in React's types */}
          <input type="file" webkitdirectory="" multiple className="sr-only" disabled={!!busy} onChange={(e) => { choose(Array.from(e.target.files ?? []).map((f) => ({ file: f, path: f.webkitRelativePath || f.name }))); e.target.value = ""; }} />
        </label>
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}><FileUp className="h-4 w-4" />Choose files
          <input type="file" multiple className="sr-only" disabled={!!busy} onChange={(e) => { choose(Array.from(e.target.files ?? []).map((f) => ({ file: f, path: f.name }))); e.target.value = ""; }} />
        </label>
        <span className="ml-2 text-sm font-semibold text-ink-100">2.</span>
        <button type="button" className="btn-primary" disabled={!!busy || !picked.length} onClick={() => void run()}><Paperclip className="h-4 w-4" />Attach files{picked.length ? ` (${picked.length} to ${packsReady} pack${packsReady === 1 ? "" : "s"})` : ""}</button>
        <label className="flex items-center gap-2 text-xs text-ink-300"><input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />Also add to packs that already have files</label>
        <p className="basis-full text-xs text-ink-300">Or <b className="text-ink-100">drag a folder from File Explorer onto this box.</b>{note && <span className="mt-1 block text-gold-300">{note}</span>}</p>
      </div>
      {busy && <p className="text-sm text-gold-400" role="status">{busy}</p>}
      {lines.length > 0 && !busy && (
        <ul className="max-h-72 space-y-0.5 overflow-auto rounded-lg border border-ink-600 p-2 text-xs">
          {lines.map((l, i) => <li key={i} className={l.status === "ok" ? "text-ok-400" : l.status === "error" ? "text-bad-400" : "text-ink-300"}>{l.text}</li>)}
        </ul>
      )}
    </div>
  );
}
