"use client";

import { upload } from "@vercel/blob/client";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { packsFromFilesAction } from "@/app/(app)/quality-packs/actions";

const DISCIPLINES = ["Structural", "Architectural", "Mechanical", "Electrical", "Other"];
const CATEGORY = "Handover / QC pack";

/** Add quality packs by uploading their PDFs: each PDF becomes one pack, named after the file. */
export function PackPdfUpload({ projects, projectId: fixedProject, direct, maxFileMb }: { projects: { value: string; label: string }[]; projectId?: string; direct: boolean; maxFileMb: number }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function uploadOne(projectId: string, f: File, discipline: string, stage: string) {
    const meta = { category: CATEGORY, unitId: "", notes: `Quality pack — ${discipline}, ${stage === "RETURNED" ? "returned" : "issued"}` };
    let res: Response;
    let body: { ok?: boolean; code?: string; error?: string; results?: { ok: boolean; code?: string; error?: string }[] };
    if (direct) {
      const key = `project-files/${projectId}/${crypto.randomUUID()}.pdf`;
      await upload(key, f, { access: "private", handleUploadUrl: `/api/projects/${projectId}/files/blob`, multipart: f.size > 8 * 1_048_576 });
      res = await fetch(`/api/projects/${projectId}/files/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, fileName: f.name, ...meta }) });
      body = await res.json().catch(() => ({}));
      if (res.ok && body.ok && body.code) return body.code;
      throw new Error(body.error ?? "upload failed");
    }
    const fd = new FormData();
    fd.append("files", f, f.name);
    for (const [k, v] of Object.entries(meta)) fd.append(k, v);
    res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: fd });
    body = await res.json().catch(() => ({}));
    const r = body.results?.[0];
    if (res.ok && r?.ok && r.code) return r.code;
    throw new Error(r?.error ?? body.error ?? (res.status === 413 ? "file too large for the server" : "upload failed"));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const projectId = fixedProject ?? String(fd.get("projectId") ?? "");
    const discipline = String(fd.get("discipline") ?? "");
    const stage = String(fd.get("stage") ?? "RETURNED") as "RETURNED" | "ISSUED";
    const date = String(fd.get("date") ?? "") || null;
    if (!projectId) return setMsg({ ok: false, text: "Choose the project." });
    if (!files.length) return setMsg({ ok: false, text: "Choose at least one PDF." });
    const codes: string[] = [];
    const failed: string[] = [];
    for (const [i, f] of files.entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      try {
        if (f.size > maxFileMb * 1_048_576) throw new Error(`larger than ${maxFileMb} MB`);
        codes.push(await uploadOne(projectId, f, discipline, stage));
      } catch (err) {
        failed.push(`${f.name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    if (codes.length) {
      setBusy("Creating packs…");
      const r = await packsFromFilesAction({ projectId, discipline, stage, date, fileCodes: codes });
      if (!r.ok) failed.push(r.error);
      else {
        failed.push(...r.skipped);
        setMsg({ ok: failed.length === 0, text: `${r.created.length} pack(s) added${failed.length ? `. Not added: ${failed.join("; ")}` : "."}` });
      }
    }
    if (!codes.length) setMsg({ ok: false, text: `Nothing added. ${failed.join("; ")}` });
    setBusy("");
    setFiles([]);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {!fixedProject && (
        <div><label className="label" htmlFor="pp-project">Project *</label>
          <select id="pp-project" name="projectId" className="input" required defaultValue=""><option value="">Select…</option>{projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
      )}
      <div><label className="label" htmlFor="pp-disc">Discipline *</label>
        <select id="pp-disc" name="discipline" className="input" defaultValue="Structural">{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</select></div>
      <div><label className="label" htmlFor="pp-stage">Status *</label>
        <select id="pp-stage" name="stage" className="input" defaultValue="RETURNED"><option value="RETURNED">Returned completed</option><option value="ISSUED">Issued to the floor</option></select></div>
      <div><label className="label" htmlFor="pp-date">Date</label><input id="pp-date" type="date" name="date" className="input" /></div>
      <div className="sm:col-span-2 lg:col-span-2">
        <span className="label">PDFs *</span>
        <label className={`btn-secondary w-full cursor-pointer justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}><FileUp className="h-4 w-4" />{files.length ? `${files.length} PDF(s) chosen` : "Choose PDFs"}
          <input type="file" multiple accept=".pdf,application/pdf" className="sr-only" onChange={(e) => { setFiles(Array.from(e.target.files ?? []).filter((f) => /\.pdf$/i.test(f.name))); e.target.value = ""; }} />
        </label>
      </div>
      {files.length > 0 && <ul className="text-xs text-ink-300 sm:col-span-2 lg:col-span-6">{files.map((f) => <li key={f.name} className="truncate">{f.name} → pack &quot;{f.name.replace(/\.pdf$/i, "")}&quot;</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-6">
        <button className="btn-primary" type="submit" disabled={!!busy || !files.length}>Add {files.length || ""} pack(s)</button>
        {busy && <span className="text-sm text-gold-400" role="status">{busy}</span>}
        {msg && <span className={`text-sm ${msg.ok ? "text-ok-400" : "text-warn-400"}`} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}
