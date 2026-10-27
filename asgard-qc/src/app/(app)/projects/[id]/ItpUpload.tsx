"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DISCIPLINES = ["Structural", "Architectural", "Electrical", "Mechanical", "Process Pipe"];

export function ItpUpload({ projectId, applied }: { projectId: string; applied: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/itp`, { method: "POST", body: new FormData(e.currentTarget) });
      const body = await res.json();
      if (!body.ok) setMsg({ ok: false, text: body.error });
      else {
        const r = body.result as { discipline: string; points: number; holds: number; warnings: string[] }[];
        setMsg({ ok: true, text: r.map((x) => `${x.discipline}: ${x.points} control points (${x.holds} hold)${x.warnings.length ? `, ${x.warnings.length} warning(s)` : ""}`).join(" · ") });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Upload failed — check your connection." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="itp-file">ITP workbook (QF 6.14 format, .xlsx)</label>
        <input id="itp-file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="input" />
      </div>
      <fieldset>
        <legend className="label">Disciplines that apply to this project</legend>
        <div className="flex flex-wrap gap-3">
          {DISCIPLINES.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-ink-100">
              <input type="checkbox" name="discipline" value={d} disabled={applied.includes(d)} defaultChecked={d === "Structural" && !applied.includes(d)} className="h-4 w-4 accent-[#c39a45]" />
              {d}
              {applied.includes(d) && <span className="text-xs text-ink-400">(applied)</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={busy}>
          <Upload className="h-4 w-4" />
          {busy ? "Importing…" : "Apply ITP"}
        </button>
        {msg && <span role="status" className={msg.ok ? "text-sm text-ok-400" : "text-sm text-bad-400"}>{msg.text}</span>}
      </div>
    </form>
  );
}
