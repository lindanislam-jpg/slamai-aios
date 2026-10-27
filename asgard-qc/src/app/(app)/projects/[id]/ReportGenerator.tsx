"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportGenerator({ projectId, types, units }: { projectId: string; types: { value: string; label: string }[]; units: { value: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; id?: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type: fd.get("type"), unitId: fd.get("unitId") || null, from: fd.get("from") || null, to: fd.get("to") || null }),
      });
      const body = await res.json();
      if (!res.ok) setMsg({ ok: false, text: body.error ?? "Report failed." });
      else {
        setMsg({ ok: true, text: `${body.code} rev ${body.revision} generated.`, id: body.id });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Network error — report not generated." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div className="lg:col-span-2">
        <label className="label" htmlFor="rg-type">Report type</label>
        <select id="rg-type" name="type" className="input" defaultValue="DETAILED">
          {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="rg-unit">Scope</label>
        <select id="rg-unit" name="unitId" className="input" defaultValue="">
          <option value="">Whole project</option>
          {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="rg-from">From (optional)</label>
        <input id="rg-from" type="date" name="from" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="rg-to">To (optional)</label>
        <input id="rg-to" type="date" name="to" className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
        <button className="btn-primary" disabled={busy}>{busy ? "Generating PDF…" : "Generate PDF report"}</button>
        {msg && (
          <span role="status" className={msg.ok ? "text-sm text-ok-400" : "text-sm text-bad-400"}>
            {msg.text} {msg.id && <a className="link" href={`/api/reports/${msg.id}`}>Download</a>}
          </span>
        )}
      </div>
    </form>
  );
}
