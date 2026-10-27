"use client";

import { upload } from "@vercel/blob/client";
import clsx from "clsx";
import { Camera, CheckCircle2, ImagePlus, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Opt = { value: string; label: string };

interface Props {
  projects: Opt[];
  units: (Opt & { projectId: string })[];
  categories: string[];
  stages: string[];
  inspectionTypes: Opt[];
  maxFileMb: number;
  maxFiles: number;
  defaults: Record<string, string | undefined>;
  /** Upload each photo straight from the browser to Vercel Blob, then register it. */
  direct?: boolean;
}

interface Pending {
  key: string;
  file: File;
  preview: string | null;
  error?: string;
}

type Result = { name: string; ok: true; id: string; code: string; takenAt: string | null; previewAvailable: boolean } | { name: string; ok: false; error: string };

const ACCEPT = ".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif";
const BATCH = 5;
const LINK_KEYS = ["inspectionId", "ncrId", "weldId", "materialId", "repairId"] as const;

function isAllowed(f: File) {
  const n = f.name.toLowerCase();
  return /\.(jpe?g|png|heic|heif)$/.test(n) || ["image/jpeg", "image/png", "image/heic", "image/heif"].includes(f.type);
}

export function PhotoUploader({ projects, units, categories, stages, inspectionTypes, maxFileMb, maxFiles, defaults, direct = false }: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(defaults.projectId ?? "");
  const [files, setFiles] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const projectUnits = useMemo(() => units.filter((u) => u.projectId === projectId), [units, projectId]);

  useEffect(() => () => files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), [files]);

  function add(list: FileList | null) {
    if (!list) return;
    const next: Pending[] = [];
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (files.some((f) => f.key === key) || next.some((f) => f.key === key)) continue;
      let err: string | undefined;
      if (!isAllowed(file)) err = "Not a JPG, PNG or HEIC file";
      else if (file.size > maxFileMb * 1_048_576) err = `Larger than ${maxFileMb} MB`;
      else if (file.size === 0) err = "Empty file";
      const previewable = !err && /jpe?g|png/i.test(file.type);
      next.push({ key, file, preview: previewable ? URL.createObjectURL(file) : null, error: err });
    }
    setFiles((cur) => [...cur, ...next].slice(0, maxFiles));
    if (files.length + next.length > maxFiles) setError(`Only the first ${maxFiles} files are kept per upload.`);
  }

  function remove(key: string) {
    setFiles((cur) => {
      const f = cur.find((x) => x.key === key);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return cur.filter((x) => x.key !== key);
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const valid = files.filter((f) => !f.error);
    if (!projectId) return setError("Choose a project.");
    if (!valid.length) return setError("Add at least one valid photo.");
    const meta = new FormData(e.currentTarget);
    meta.delete("files");
    meta.delete("camera");
    setBusy(true);
    const all: Result[] = [];
    try {
      if (direct) {
        const fields: Record<string, string> = {};
        for (const [k, v] of meta.entries()) if (typeof v === "string" && v !== "") fields[k] = v;
        for (const [i, p] of valid.entries()) {
          setProgress(`Uploading ${i + 1} of ${valid.length}…`);
          try {
            const found = /\.([a-z0-9]{1,5})$/i.exec(p.file.name)?.[1].toLowerCase() ?? "";
            const ext = ["jpg", "jpeg", "png", "heic", "heif"].includes(found) ? found : "jpg";
            const key = `photo-uploads/${projectId}/${crypto.randomUUID()}.${ext}`;
            await upload(key, p.file, { access: "private", handleUploadUrl: "/api/photos/blob", multipart: p.file.size > 8 * 1_048_576 });
            const res = await fetch("/api/photos/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, projectId, key, fileName: p.file.name }) });
            const body = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
            all.push(res.ok ? (body.result as Result) : { name: p.file.name, ok: false, error: body.error ?? "Upload failed" });
            if (res.status === 401 || res.status === 403) break;
          } catch (err) {
            all.push({ name: p.file.name, ok: false, error: err instanceof Error ? err.message : "Upload failed" });
          }
          setResults([...all]);
        }
      }
      for (let i = 0; !direct && i < valid.length; i += BATCH) {
        const batch = valid.slice(i, i + BATCH);
        setProgress(`Uploading ${Math.min(i + BATCH, valid.length)} of ${valid.length}…`);
        const fd = new FormData();
        for (const [k, v] of meta.entries()) if (typeof v === "string" && v !== "") fd.append(k, v);
        for (const p of batch) fd.append("files", p.file, p.file.name);
        const res = await fetch("/api/photos/upload", { method: "POST", body: fd });
        const body = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
        if (!res.ok) {
          for (const p of batch) all.push({ name: p.file.name, ok: false, error: body.error ?? "Upload failed" });
          if (res.status === 401 || res.status === 403 || res.status === 422) break;
        } else all.push(...(body.results as Result[]));
        setResults([...all]);
      }
      const okKeys = new Set(all.filter((r) => r.ok).map((r) => r.name));
      setFiles((cur) => cur.filter((f) => !okKeys.has(f.file.name.slice(0, 200))));
      router.refresh();
    } catch {
      setError("Network error — some photos may not have uploaded. Check the results below.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const sel = (name: string, label: string, opts: (string | Opt)[], def?: string, required = false) => (
    <div>
      <label className="label" htmlFor={`up-${name}`}>{label}{required && <span className="text-gold-400"> *</span>}</label>
      <select id={`up-${name}`} name={name} className="input" defaultValue={def ?? ""} required={required}>
        <option value="">{required ? "Select…" : "—"}</option>
        {opts.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
  const txt = (name: string, label: string, hint?: string) => (
    <div>
      <label className="label" htmlFor={`up-${name}`}>{label}</label>
      <input id={`up-${name}`} name={name} className="input" defaultValue={defaults[name] ?? ""} placeholder={hint} />
    </div>
  );

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={clsx("rounded-xl border-2 border-dashed px-4 py-8 text-center transition", drag ? "border-gold-400 bg-gold-600/10" : "border-ink-500 bg-ink-900/60")}
      >
        <ImagePlus className="mx-auto h-8 w-8 text-gold-400" />
        <p className="mt-2 text-sm text-ink-100">Drag factory photos here</p>
        <p className="text-xs text-ink-300">JPG, PNG or HEIC · up to {maxFileMb} MB each · {maxFiles} per upload · originals are stored unchanged</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <label className="btn-secondary cursor-pointer"><Upload className="h-4 w-4" />Choose files
            <input type="file" name="files" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="btn-secondary cursor-pointer"><Camera className="h-4 w-4" />Take photo
            <input type="file" name="camera" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
          {files.map((f) => (
            <li key={f.key} className={clsx("relative overflow-hidden rounded-lg border", f.error ? "border-bad-600" : "border-ink-600")}>
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.preview} alt={f.file.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-ink-700 p-1 text-center text-[10px] text-ink-300">{f.error ? "" : "HEIC — no preview in browser"}</div>
              )}
              <div className="truncate bg-ink-900 px-1.5 py-1 text-[10px] text-ink-200" title={f.file.name}>{f.file.name}</div>
              {f.error && <div className="bg-bad-600/20 px-1.5 py-1 text-[10px] text-bad-400">{f.error}</div>}
              <button type="button" onClick={() => remove(f.key)} className="absolute right-1 top-1 rounded bg-ink-950/80 px-1.5 text-xs text-ink-100" aria-label={`Remove ${f.file.name}`}>×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="up-projectId">Project<span className="text-gold-400"> *</span></label>
          <select id="up-projectId" name="projectId" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">Select…</option>
            {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="up-unitId">Module / frame</label>
          <select id="up-unitId" name="unitId" className="input" defaultValue={defaults.unitId ?? ""} key={projectId}>
            <option value="">—</option>
            {projectUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        {sel("category", "Category", categories, defaults.category, true)}
        {sel("stage", "Production stage", stages, defaults.stage)}
        {sel("inspectionType", "Inspection type", inspectionTypes, defaults.inspectionType)}
        {txt("componentRef", "Component / drawing ref")}
        {txt("responsiblePerson", "Inspector / responsible person")}
        {txt("heatNumber", "Heat number", "Only if read from the steel")}
        {txt("weldRef", "Weld reference")}
        {sel("reworkPhase", "Rework phase", [{ value: "BEFORE", label: "Before repair" }, { value: "AFTER", label: "After repair" }], defaults.reworkPhase)}
        {txt("tags", "Tags", "comma separated")}
        {txt("caption", "Caption")}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="up-description">Description</label>
          <textarea id="up-description" name="description" rows={2} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="up-observedCondition">Observed condition</label>
          <textarea id="up-observedCondition" name="observedCondition" rows={2} className="input" placeholder="What you saw — a finding is recorded as an NCR or inspection result, not here" />
        </div>
        {LINK_KEYS.map((k) => defaults[k] ? <input key={k} type="hidden" name={k} value={defaults[k]} /> : null)}
      </div>
      {LINK_KEYS.some((k) => defaults[k]) && (
        <p className="text-xs text-ink-300">Photos will be linked to: {LINK_KEYS.filter((k) => defaults[k]).map((k) => k.replace("Id", "")).join(", ")}.</p>
      )}
      <p className="text-xs text-ink-300">These details apply to every photo in this upload. Capture time is read from each file; it is never invented when a file has none.</p>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={busy || !files.some((f) => !f.error)}>
          <Upload className="h-4 w-4" />{busy ? progress || "Uploading…" : `Upload ${files.filter((f) => !f.error).length || ""} photo(s)`}
        </button>
        {error && <span role="alert" className="text-sm text-bad-400">{error}</span>}
      </div>

      {results.length > 0 && (
        <div className="rounded-lg border border-ink-600">
          <div className="border-b border-ink-600 px-3 py-2 text-xs font-semibold text-ink-200">
            Results: {results.filter((r) => r.ok).length} stored, {results.filter((r) => !r.ok).length} failed
          </div>
          <ul className="max-h-64 divide-y divide-ink-600/60 overflow-y-auto text-sm">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 px-3 py-1.5">
                {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-ok-400" /> : <XCircle className="mt-0.5 h-4 w-4 text-bad-400" />}
                <span className="min-w-0 flex-1 truncate text-ink-200">{r.name}</span>
                {r.ok ? (
                  <span className="text-xs">
                    <Link className="link" href={`/photos/${r.id}`}>{r.code}</Link>
                    <span className="ml-2 text-ink-300">{r.takenAt ? `taken ${new Date(r.takenAt).toLocaleString("en-GB")}` : "no capture date in file"}{r.previewAvailable ? "" : " · no preview"}</span>
                  </span>
                ) : (
                  <span className="text-xs text-bad-400">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
