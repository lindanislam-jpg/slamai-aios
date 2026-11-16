import Link from "next/link";
import { FilterBar, FilterSelect } from "@/components/fields";
import { IncomingForm } from "@/components/incoming/IncomingForm";
import { PhotoThumb } from "@/components/inspections/PhotoThumbs";
import { Badge, Card, Empty, fmtDate, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";

export const metadata = { title: "Incoming Inspections" };

export default async function IncomingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const [rows, projects, limits] = await Promise.all([
    db.inspection.findMany({
      where: { type: "INCOMING_MATERIAL", status: { not: "CANCELLED" }, ...(projectId ? { projectId } : {}) },
      orderBy: [{ inspectedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true, code: true, componentRef: true, comments: true, inspectedAt: true, inspectorName: true, result: true, status: true,
        project: { select: { id: true, code: true, name: true } },
        photos: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" }, take: 4, select: { id: true, code: true, caption: true, thumbKey: true } },
        _count: { select: { photos: { where: { deletedAt: null } }, ncrs: true } },
      },
    }),
    projectOptions(),
    getSetting("uploadLimits"),
  ]);
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

      <FilterBar>
        <FilterSelect name="projectId" label="Job number" options={projects} value={projectId} empty="All jobs" />
      </FilterBar>

      {rows.length === 0 ? (
        <Empty title="No incoming inspections recorded yet">{projectId ? "None for this job. Clear the filter to see all jobs." : "Use the form above when the next delivery arrives."}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Job</th><th>Delivered</th><th>Supplier / delivery note</th><th>Result</th><th>Record</th><th>Pictures</th><th>Inspector</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
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
      )}
    </div>
  );
}
