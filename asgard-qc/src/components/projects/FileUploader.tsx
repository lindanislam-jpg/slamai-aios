"use client";

import { upload } from "@vercel/blob/client";
import clsx from "clsx";
import { CheckCircle2, FilePlus2, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Opt = { value: string; label: string };
type Result = { name: string; ok: true; code: string } | { name: string; ok: false; error: string };

interface Props {
  projectId: string;
  units: Opt[];
  categories: readonly string[];
  extensions: readonly string[];
  maxFileMb: number;
  /** Upload straight from the browser to Vercel Blob instead of through the server. */
  direct: boolean;
}

const extOf = (name: string) => /\.([a-z0-9]{1,5})$/i.exec(name)?.[1].toLowerCase() ?? "";

export function FileUploader({ projectId, units, categories, extensions, maxFileMb, direct }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function problem(f: File) {
    if (!extensions.includes(extOf(f.name))) return "File type not allowed";
    if (f.size === 0) return "File is empty";
    if (f.size > maxFileMb * 1_048_576) return `Larger than ${maxFileMb} MB`;
    return null;
  }

  function add(list: FileList | null) {
    if (!list) return;
    const key = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
    setFiles((cur) => [...cur, ...Array.from(list).filter((f) => !cur.some((c) => key(c) === key(f)))]);
    setResults([]);
  }

  async function uploadOne(f: File, meta: { category: string; unitId: string; notes: string }): Promise<Result> {
    if (direct) {
      const key = `project-files/${projectId}/${crypto.randomUUID()}.${extOf(f.name)}`;
      await upload(key, f, { access: "private", handleUploadUrl: `/api/projects/${projectId}/files/blob`, multipart: f.size > 8 * 1_048_576 });
      const res = await fetch(`/api/projects/${projectId}/files/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, fileName: f.name, ...meta }),
      });
      const body = await res.json().catch(() => ({}));
      return res.ok && body.ok ? { name: f.name, ok: true, code: body.code } : { name: f.name, ok: false, error: body.error ?? "Upload failed" };
    }
    const fd = new FormData();
    fd.append("files", f, f.name);
    for (const [k, v] of Object.entries(meta)) fd.append(k, v);
    const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { name: f.name, ok: false, error: body.error ?? (res.status === 413 ? "File too large for the server" : "Upload failed") };
    const r = body.results?.[0];
    return r?.ok ? { name: f.name, ok: true, code: r.code } : { name: f.name, ok: false, error: r?.error ?? "Upload failed" };
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const meta = { category: String(fd.get("category") ?? ""), unitId: String(fd.get("unitId") ?? ""), notes: String(fd.get("notes") ?? "") };
    if (!meta.category) return setError("Choose a category.");
    const valid = files.filter((f) => !problem(f));
    if (!valid.length) return setError("Add at least one allowed file.");
    setBusy(true);
    const done: Result[] = [];
    try {
      // One file at a time keeps memory low and gives clear per-file results.
      for (const [i, f] of valid.entries()) {
        setProgress(`Uploading ${i + 1} of ${valid.length}: ${f.name}`);
        try {
          done.push(await uploadOne(f, meta));
        } catch (err) {
          done.push({ name: f.name, ok: false, error: err instanceof Error ? err.message : "Upload failed" });
        }
        setResults([...done]);
      }
      const ok = new Set(done.filter((r) => r.ok).map((r) => r.name));
      setFiles((cur) => cur.filter((f) => !ok.has(f.name)));
      if (ok.size && ok.size === valid.length) formRef.current?.reset();
      router.refresh();
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const fmt = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={clsx("rounded-xl border-2 border-dashed px-4 py-6 text-center transition", drag ? "border-gold-400 bg-gold-600/10" : "border-ink-500 bg-ink-900/60")}
      >
        <FilePlus2 className="mx-auto h-7 w-7 text-gold-400" />
        <p className="mt-2 text-sm text-ink-100">Drag files here — drawings, POs, certificates, reports, emails</p>
        <p className="text-xs text-ink-300">Up to {maxFileMb} MB each · {extensions.join(", ")}</p>
        <label className="btn-secondary mt-3 cursor-pointer"><Upload className="h-4 w-4" />Choose files
          <input type="file" multiple accept={extensions.map((x) => `.${x}`).join(",")} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-ink-700 rounded-lg border border-ink-600 text-sm">
          {files.map((f) => {
            const p = problem(f);
            return (
              <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-ink-100" title={f.name}>{f.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs">
                  {p ? <span className="text-bad-400">{p}</span> : <span className="text-ink-300">{fmt(f.size)}</span>}
                  <button type="button" className="text-ink-300 hover:text-ink-100" onClick={() => setFiles((cur) => cur.filter((c) => c !== f))} aria-label={`Remove ${f.name}`}>×</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="fu-category">Category<span className="text-gold-400"> *</span></label>
          <select id="fu-category" name="category" className="input" defaultValue="" required>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fu-unit">Module / frame</label>
          <select id="fu-unit" name="unitId" className="input" defaultValue="">
            <option value="">— Whole project</option>
            {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fu-notes">Notes</label>
          <textarea id="fu-notes" name="notes" rows={1} className="input" placeholder="Optional — e.g. Rev C issued for construction" />
        </div>
      </div>

      {error && <p className="text-sm text-bad-400" role="alert">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy || files.length === 0}><Upload className="h-4 w-4" />{busy ? "Uploading…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}</button>
        {progress && <span className="text-xs text-ink-300" aria-live="polite">{progress}</span>}
      </div>

      {results.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              {r.ok ? <CheckCircle2 className="h-4 w-4 text-ok-400" /> : <XCircle className="h-4 w-4 text-bad-400" />}
              <span className="text-ink-100">{r.name}</span>
              <span className={r.ok ? "text-ink-300" : "text-bad-400"}>{r.ok ? r.code : r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
