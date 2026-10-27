"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface Opt {
  value: string;
  label: string;
}

/** Posts a report request and offers the download when it completes. */
export function ReportGenerator({ types, projects, units }: { types: Opt[]; projects: Opt[]; units: (Opt & { projectId: string })[] }) {
  const [type, setType] = useState(types[1]?.value ?? types[0]?.value ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.value ?? "");
  const [unitId, setUnitId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; href?: string } | null>(null);
  const router = useRouter();
  const projectUnits = useMemo(() => units.filter((u) => u.projectId === projectId), [units, projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, projectId, unitId: unitId || null, from: from || null, to: to || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setResult({ ok: false, text: body.error ?? `Report failed (${res.status}).` });
      else {
        setResult({ ok: true, text: `${body.code} rev ${body.revision} generated.`, href: `/api/reports/${body.id}` });
        router.refresh();
      }
    } catch {
      setResult({ ok: false, text: "Network error — report not generated." });
    } finally {
      setBusy(false);
    }
  }

  if (!projects.length) return <p className="text-sm text-ink-300">Create a project first.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rg-type">Report type</label>
          <select id="rg-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rg-project">Project</label>
          <select id="rg-project" className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setUnitId(""); }}>
            {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rg-unit">Module / frame (optional)</label>
          <select id="rg-unit" className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">Whole project</option>
            {projectUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="rg-from">From</label>
            <input id="rg-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rg-to">To</label>
            <input id="rg-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={busy || !projectId}>
          <FileText className="h-4 w-4" />
          {busy ? "Generating… (photos make this take longer)" : "Generate PDF report"}
        </button>
        {result && (
          <span role="status" className={result.ok ? "text-sm text-ok-400" : "text-sm text-bad-400"}>
            {result.text}{" "}
            {result.href && <a className="link" href={result.href}>Download</a>}
          </span>
        )}
      </div>
      <p className="text-xs text-ink-300">Reports are compiled from current records, marked DRAFT — NOT APPROVED, and list missing information instead of filling it in. Each regeneration gets a new revision number.</p>
    </form>
  );
}
