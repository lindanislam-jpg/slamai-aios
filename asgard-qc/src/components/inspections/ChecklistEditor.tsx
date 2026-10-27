"use client";

import { Plus, Trash2, ArrowUp } from "lucide-react";
import { useState } from "react";

export interface ChecklistRow {
  description: string;
  requirement?: string | null;
  tolerance?: string | null;
  actual?: string | null;
  unit?: string | null;
  result?: string;
  notes?: string | null;
  required?: boolean;
}

const RESULTS = ["PENDING", "PASS", "FAIL", "HOLD", "NA"];
const blank = (): ChecklistRow => ({ description: "", requirement: "", tolerance: "", actual: "", unit: "", result: "PENDING", notes: "", required: true });

/** Editable checklist. Rows are serialised as JSON into a hidden input named `name`. */
export function ChecklistEditor({ name = "items", initial = [], showResults = true }: { name?: string; initial?: ChecklistRow[]; showResults?: boolean }) {
  const [rows, setRows] = useState<ChecklistRow[]>(initial.length ? initial : []);
  const set = (i: number, patch: Partial<ChecklistRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const clean = rows
    .filter((r) => r.description.trim())
    .map((r) => ({ ...r, result: r.result ?? "PENDING", required: r.required ?? true }));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(clean)} />
      {rows.length === 0 && <p className="text-sm text-ink-300">No checklist items yet.</p>}
      {rows.map((r, i) => {
        const unconfigured = r.description.trim() && !r.requirement?.trim();
        return (
          <div key={i} className="rounded-lg border border-ink-600 bg-ink-900/60 p-3">
            <div className="grid gap-2 sm:grid-cols-12">
              <input aria-label={`Item ${i + 1} description`} className="input sm:col-span-4" placeholder="Check / characteristic" value={r.description} onChange={(e) => set(i, { description: e.target.value })} />
              <input aria-label={`Item ${i + 1} requirement`} className="input sm:col-span-4" placeholder="Requirement / approved document clause" value={r.requirement ?? ""} onChange={(e) => set(i, { requirement: e.target.value })} />
              <input aria-label={`Item ${i + 1} tolerance`} className="input sm:col-span-2" placeholder="Tolerance" value={r.tolerance ?? ""} onChange={(e) => set(i, { tolerance: e.target.value })} />
              <label className="flex items-center gap-2 text-xs text-ink-300 sm:col-span-2">
                <input type="checkbox" checked={r.required ?? true} onChange={(e) => set(i, { required: e.target.checked })} className="accent-[#c39a45]" /> Required
              </label>
              {showResults && (
                <>
                  <input aria-label={`Item ${i + 1} actual`} className="input sm:col-span-3" placeholder="Actual / measured" value={r.actual ?? ""} onChange={(e) => set(i, { actual: e.target.value })} />
                  <input aria-label={`Item ${i + 1} unit`} className="input sm:col-span-1" placeholder="Unit" value={r.unit ?? ""} onChange={(e) => set(i, { unit: e.target.value })} />
                  <select aria-label={`Item ${i + 1} result`} className="input sm:col-span-2" value={r.result ?? "PENDING"} onChange={(e) => set(i, { result: e.target.value })}>
                    {RESULTS.map((x) => (
                      <option key={x} value={x}>{x === "NA" ? "N/A" : x.charAt(0) + x.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                  <input aria-label={`Item ${i + 1} notes`} className="input sm:col-span-4" placeholder="Notes" value={r.notes ?? ""} onChange={(e) => set(i, { notes: e.target.value })} />
                </>
              )}
              <div className="flex items-center justify-end gap-1 sm:col-span-2">
                {i > 0 && (
                  <button type="button" className="btn-ghost btn-sm" aria-label="Move up" onClick={() => setRows((rs) => { const c = [...rs]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" className="btn-ghost btn-sm text-bad-400" aria-label="Remove item" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {unconfigured && <p className="mt-1.5 text-xs text-warn-400">Requires configuration — no requirement recorded. It will be flagged, not assumed.</p>}
          </div>
        );
      })}
      <button type="button" className="btn-secondary btn-sm" onClick={() => setRows((r) => [...r, blank()])}>
        <Plus className="h-3.5 w-3.5" /> Add checklist item
      </button>
    </div>
  );
}
