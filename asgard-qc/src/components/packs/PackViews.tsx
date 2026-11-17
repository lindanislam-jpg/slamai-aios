import Link from "next/link";
import { Badge, fmtDate } from "@/components/ui";
import { markReturnedAction, recordPackAction } from "@/app/(app)/quality-packs/actions";
import { DISCIPLINES, type listPacks, type packCounts } from "@/lib/services/quality-packs";

type Pack = Awaited<ReturnType<typeof listPacks>>[number];
type Count = Awaited<ReturnType<typeof packCounts>>[number];

/** Issued vs returned per project and discipline. */
export function PackSummary({ counts, hrefFor }: { counts: Count[]; hrefFor: (projectId: string, stage?: string) => string }) {
  const disciplines = [...new Set(counts.flatMap((c) => Object.keys(c.byDiscipline)))].sort((a, b) => (DISCIPLINES.indexOf(a as never) + 99) % 99 - (DISCIPLINES.indexOf(b as never) + 99) % 99 || a.localeCompare(b));
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th>Project</th><th className="text-right">Returned</th><th className="text-right">Issued (not back)</th>{disciplines.map((d) => <th key={d} className="text-right">{d}<div className="text-[10px] font-normal text-ink-400">returned / issued</div></th>)}</tr></thead>
        <tbody>
          {counts.map((c) => (
            <tr key={c.project.id}>
              <td><Link className="link font-medium" href={hrefFor(c.project.id)}>{c.project.code}</Link><div className="max-w-48 truncate text-[11px] text-ink-300">{c.project.name}</div></td>
              <td className="text-right"><Link className="link font-semibold text-ok-400" href={hrefFor(c.project.id, "RETURNED")}>{c.returned}</Link></td>
              <td className="text-right"><Link className="link" href={hrefFor(c.project.id, "ISSUED")}>{c.issued}</Link></td>
              {disciplines.map((d) => <td key={d} className="text-right text-xs">{c.byDiscipline[d] ? `${c.byDiscipline[d].returned} / ${c.byDiscipline[d].issued}` : "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PackTable({ rows, canWrite, back, showProject = true }: { rows: Pack[]; canWrite: boolean; back: string; showProject?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th>Pack</th>{showProject && <th>Project</th>}<th>Discipline</th><th>Status</th><th>Contents</th><th>Returned</th><th>Source</th>{canWrite && <th />}</tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="max-w-72"><div className="font-medium">{p.name}</div><div className="text-[11px] text-ink-400">{p.code}</div>{p.notes && <div className="mt-1 whitespace-pre-line text-[11px] text-ink-300">{p.notes}</div>}</td>
              {showProject && <td><Link className="link" href={`/projects/${p.project.id}?tab=packs`}>{p.project.code}</Link></td>}
              <td className="text-xs">{p.discipline}</td>
              <td><Badge value={p.stage} tone={p.stage === "RETURNED" ? "ok" : "warn"} label={p.stage === "RETURNED" ? "Returned" : "Issued"} /></td>
              <td className="max-w-80 text-xs text-ink-300">
                {p.kind === "folder" && p.fileCount == null && p.files.length === 0 ? "Folder — contents in SharePoint" : p.kind === "folder" ? (
                  <details><summary className="cursor-pointer">{p.fileCount ?? p.files.length} file(s)</summary><ul className="mt-1 max-h-48 overflow-auto">{p.files.map((f) => <li key={f} className="truncate">{f}</li>)}</ul></details>
                ) : p.kind === "upload" ? "PDF uploaded" : p.kind === "file" ? "1 file" : "Recorded in the app"}
              </td>
              <td className="whitespace-nowrap text-xs">{p.returnedAt ? fmtDate(p.returnedAt) : p.stage === "RETURNED" ? <span className="text-ink-400" title="The SharePoint folder listing carries no return date">date not recorded</span> : "—"}{p.returnedByName && <div className="text-ink-400">{p.returnedByName}</div>}</td>
              <td className="text-xs">{p.projectFile && !p.projectFile.removedAt ? <a className="link" href={`/api/files/project-file/${p.projectFile.id}`}>Download PDF</a> : p.sourceUrl ? <a className="link" href={p.sourceUrl} target="_blank" rel="noreferrer">Open in SharePoint</a> : p.sourcePath ? <span className="text-ink-400" title={p.sourcePath}>SharePoint</span> : p.createdByName ? `By ${p.createdByName}` : "—"}</td>
              {canWrite && (
                <td>
                  {p.stage === "ISSUED" && (
                    <form action={markReturnedAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} />
                      <input type="date" name="date" className="input h-8 w-36 py-0 text-xs" aria-label={`Date ${p.code} came back`} />
                      <button className="btn-secondary btn-sm" type="submit">Mark returned</button>
                    </form>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecordPackForm({ projects, back, projectId }: { projects: { value: string; label: string }[]; back: string; projectId?: string | null }) {
  return (
    <form action={recordPackAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <input type="hidden" name="back" value={back} />
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : (
        <div><label className="label" htmlFor="qp-project">Project *</label>
          <select id="qp-project" name="projectId" className="input" required defaultValue=""><option value="">Select…</option>{projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
      )}
      <div><label className="label" htmlFor="qp-disc">Discipline *</label>
        <select id="qp-disc" name="discipline" className="input" required defaultValue="Structural">{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</select></div>
      <div className="lg:col-span-2"><label className="label" htmlFor="qp-name">Pack *</label><input id="qp-name" name="name" className="input" required maxLength={200} placeholder="e.g. Skid No 4 paint QC pack" /></div>
      <div><label className="label" htmlFor="qp-stage">Status *</label>
        <select id="qp-stage" name="stage" className="input" defaultValue="ISSUED"><option value="ISSUED">Issued to the floor</option><option value="RETURNED">Returned completed</option></select></div>
      <div><label className="label" htmlFor="qp-date">Date</label><input id="qp-date" type="date" name="date" className="input" /></div>
      <div className="sm:col-span-2 lg:col-span-5"><label className="label" htmlFor="qp-notes">Notes</label><input id="qp-notes" name="notes" className="input" maxLength={2000} /></div>
      <div className="flex items-end"><button className="btn-primary w-full" type="submit">Record pack</button></div>
    </form>
  );
}
