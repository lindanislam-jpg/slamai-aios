"use client";

import { FileDown, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface Preview {
  projects: { row: number; code: string; name: string; action: "create" | "skip"; reason?: string }[];
  units: { row: number; projectCode: string; ref: string; action: "create" | "skip"; reason?: string }[];
  errors: string[];
}

/** Two-step import: preview what the file would create, then confirm. */
export function ProjectImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(mode: "preview" | "apply") {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMsg({ ok: false, text: "Choose a file first." });
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    try {
      const res = await fetch("/api/projects/import", { method: "POST", body: fd });
      const body = await res.json();
      if (!body.ok) setMsg({ ok: false, text: body.error });
      else if (mode === "preview") setPreview(body.result);
      else {
        const r = body.result as Preview;
        setMsg({ ok: true, text: `Imported ${r.projects.filter((p) => p.action === "create").length} project(s) and ${r.units.filter((u) => u.action === "create").length} unit(s).` });
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Import failed — check your connection." });
    } finally {
      setBusy(false);
    }
  }

  const creates = preview ? preview.projects.filter((p) => p.action === "create").length + preview.units.filter((u) => u.action === "create").length : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-300">
        Import projects and their modules / frames from Excel. Existing projects and units are skipped, never changed. Status can be set, but release is only ever recorded in the app.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <label className="label" htmlFor="import-file">Excel file (.xlsx)</label>
          <input id="import-file" ref={fileRef} type="file" accept=".xlsx" className="input" onChange={() => setPreview(null)} />
        </div>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => send("preview")}>
          {busy && !preview ? "Checking…" : "Preview"}
        </button>
        <a className="btn-ghost" href="/api/projects/import"><FileDown className="h-4 w-4" />Template</a>
      </div>
      {msg && <p role="status" className={msg.ok ? "text-sm text-ok-400" : "text-sm text-bad-400"}>{msg.text}</p>}
      {preview && (
        <div className="space-y-3">
          {preview.errors.length > 0 && (
            <ul className="rounded-lg border border-bad-600/50 bg-bad-600/10 p-3 text-sm text-bad-400">
              {preview.errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Row</th><th>Project</th><th>Name / unit</th><th>Result</th></tr></thead>
              <tbody>
                {preview.projects.map((p) => (
                  <tr key={`p${p.row}`}><td>{p.row}</td><td className="font-medium">{p.code}</td><td>{p.name}</td><td className={p.action === "create" ? "text-ok-400" : "text-ink-300"}>{p.action === "create" ? "Create project" : `Skip — ${p.reason}`}</td></tr>
                ))}
                {preview.units.map((u) => (
                  <tr key={`u${u.row}`}><td>{u.row}</td><td>{u.projectCode}</td><td>↳ {u.ref}</td><td className={u.action === "create" ? "text-ok-400" : "text-ink-300"}>{u.action === "create" ? "Create unit" : `Skip — ${u.reason}`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-primary" disabled={busy || preview.errors.length > 0 || creates === 0} onClick={() => send("apply")}>
            <Upload className="h-4 w-4" />
            {busy ? "Importing…" : `Import ${creates} record(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
