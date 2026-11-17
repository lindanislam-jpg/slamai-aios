import Link from "next/link";
import { FilterBar, FilterSelect } from "@/components/fields";
import { BulkAcceptButton } from "@/components/incoming/BulkAcceptButton";
import { IncomingForm } from "@/components/incoming/IncomingForm";
import { PdfPhotoAttach, type PdfTarget } from "@/components/incoming/PdfPhotoAttach";
import { bulkAcceptIncomingAction } from "./actions";
import { PhotoThumb } from "@/components/inspections/PhotoThumbs";
import { Badge, Card, Empty, fmtDate, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { pdfMatchKey } from "@/lib/pdf-jpegs";

export const metadata = { title: "Incoming Inspections" };

export default async function IncomingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const result = str(sp, "result");
  const pics = str(sp, "pics");
  const msg = str(sp, "msg");
  const base = { type: "INCOMING_MATERIAL" as const, status: { not: "CANCELLED" as const } };
  const where = {
    ...base,
    ...(projectId ? { projectId } : {}),
    ...(result && ["PENDING", "PASS", "FAIL", "HOLD"].includes(result) ? { result: result as "PENDING" } : {}),
    ...(pics === "none" ? { photos: { none: { deletedAt: null } } } : pics === "some" ? { photos: { some: { deletedAt: null } } } : {}),
  };
  const [rows, projects, limits, sourced, totals] = await Promise.all([
    db.inspection.findMany({
      where,
      orderBy: [{ inspectedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 1000,
      select: {
        id: true, code: true, componentRef: true, comments: true, inspectedAt: true, inspectorName: true, result: true, status: true,
        project: { select: { id: true, code: true, name: true } },
        photos: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" }, take: 4, select: { id: true, code: true, caption: true, thumbKey: true } },
        _count: { select: { photos: { where: { deletedAt: null } }, ncrs: true } },
      },
    }),
    projectOptions(),
    getSetting("uploadLimits"),
    db.inspection.findMany({
      where: { ...base, comments: { contains: "Source: SharePoint " } },
      select: { id: true, code: true, projectId: true, comments: true, project: { select: { code: true } }, _count: { select: { photos: { where: { deletedAt: null } } } } },
    }),
    db.inspection.groupBy({ by: ["result", "status"], where: base, _count: { _all: true } }),
  ]);
  const targets: PdfTarget[] = sourced.flatMap((r) => {
    const src = /Source: SharePoint (.+)/.exec(r.comments ?? "")?.[1]?.trim();
    return src && /\.pdf$/i.test(src) ? [{ id: r.id, code: r.code, job: r.project.code, projectId: r.projectId, key: pdfMatchKey(src), photos: r._count.photos }] : [];
  });
  const count = (f: (t: (typeof totals)[number]) => boolean) => totals.filter(f).reduce((n, t) => n + t._count._all, 0);
  const all = count(() => true);
  const back = `/incoming?${new URLSearchParams(Object.entries({ projectId, result, pics }).filter((e): e is [string, string] => !!e[1])).toString()}`;
  const canAdd = actor.permissions.has("inspection.write") && actor.permissions.has("photo.upload");

  return (
    <div>
      <PageHeader title="Incoming Inspections" subtitle="Goods-in checks: record the job number, what arrived and the result, with pictures of the delivery." />

      {canAdd ? (
        <Card title="New incoming inspection" className="mb-5">
          <IncomingForm projects={projects} maxFileMb={limits.maxFileMb} maxFiles={limits.maxFilesPerBatch} direct={storage().driver === "vercel-blob"} defaultProjectId={projectId ?? undefined} />
        </Card>
      ) : (
        <p className="mb-5 rounded-lg border border-ink-600 px-4 py-3 text-sm text-ink-300">Your role can view incoming inspections but not record them.</p>
      )}

      {msg && <p className="mb-4 rounded-lg border border-gold-600/50 bg-gold-500/10 px-4 py-3 text-sm" role="status">{msg}</p>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["All records", all, ""],
          ["Result not decided", count((t) => t.result === "PENDING"), "?result=PENDING"],
          ["Pass", count((t) => t.result === "PASS"), "?result=PASS"],
          ["Fail", count((t) => t.result === "FAIL"), "?result=FAIL"],
          ["Draft (not submitted)", count((t) => t.status === "DRAFT"), ""],
        ].map(([label, n, href]) => (
          <Link key={String(label)} href={`/incoming${href}`} className="rounded-xl border border-ink-600 bg-ink-900/60 px-4 py-3 hover:border-gold-500">
            <div className="text-2xl font-semibold">{n}</div><div className="text-xs text-ink-300">{label}</div>
          </Link>
        ))}
      </div>

      {canAdd && targets.length > 0 && (
        <Card title="Add the pictures from the MIS report PDFs" className="mb-5">
          <PdfPhotoAttach targets={targets} direct={storage().driver === "vercel-blob"} maxFileMb={limits.maxFileMb} />
        </Card>
      )}

      <FilterBar>
        <FilterSelect name="projectId" label="Job number" options={projects} value={projectId} empty="All jobs" />
        <FilterSelect name="result" label="Result" options={[{ value: "PENDING", label: "Not decided (Pending)" }, { value: "PASS", label: "Pass" }, { value: "FAIL", label: "Fail" }, { value: "HOLD", label: "Hold" }]} value={result} empty="All results" />
        <FilterSelect name="pics" label="Pictures" options={[{ value: "none", label: "No pictures" }, { value: "some", label: "Has pictures" }]} value={pics} empty="All" />
      </FilterBar>

      {rows.length === 0 ? (
        <Empty title="No incoming inspections recorded yet">{projectId ? "None for this job. Clear the filter to see all jobs." : "Use the form above when the next delivery arrives."}</Empty>
      ) : (
        <form action={bulkAcceptIncomingAction}>
        <input type="hidden" name="back" value={back} />
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-300">
          <span>Showing {rows.length} record(s){rows.length === 1000 ? " (first 1000 — use the filters)" : ""}. Records are Draft until a result is decided.</span>
          {canAdd && <BulkAcceptButton />}
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>{canAdd && <th className="w-8"><span className="sr-only">Select</span></th>}<th>Date</th><th>Job</th><th>Delivered</th><th>Supplier / delivery note</th><th>Result</th><th>Record</th><th>Pictures</th><th>Inspector</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {canAdd && <td>{r.status === "DRAFT" && <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.code}`} />}</td>}
                  <td className="whitespace-nowrap"><Link className="link" href={`/inspections/${r.id}`}>{r.inspectedAt ? fmtDate(r.inspectedAt) : r.code}</Link><div className="text-[11px] text-ink-400">{r.code}</div></td>
                  <td><Link className="link font-medium" href={`/projects/${r.project.id}`}>{r.project.code}</Link><div className="max-w-40 truncate text-[11px] text-ink-300">{r.project.name}</div></td>
                  <td className="max-w-64">{r.componentRef ?? <span className="text-ink-400">—</span>}</td>
                  <td className="max-w-64 whitespace-pre-line text-xs text-ink-300">{(r.comments ?? "").split("\n").filter((l) => /^(Supplier|Delivery note)/.test(l)).join("\n") || "—"}</td>
                  <td><Badge value={r.result} />{r._count.ncrs > 0 && <div className="mt-1 text-[11px] text-warn-400">NCR raised</div>}</td>
                  <td><Badge value={r.status} /></td>
                  <td>
                    {r.photos.length ? (
                      <div className="flex items-center gap-1">
                        {r.photos.slice(0, 3).map((p) => <div key={p.id} className="w-14"><PhotoThumb p={p} /></div>)}
                        {r._count.photos > 3 && <Link className="link text-xs" href={`/inspections/${r.id}`}>+{r._count.photos - 3}</Link>}
                      </div>
                    ) : <span className="text-xs text-warn-400">No pictures</span>}
                  </td>
                  <td className="text-xs">{r.inspectorName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </form>
      )}
    </div>
  );
}
