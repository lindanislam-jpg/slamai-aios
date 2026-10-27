import { FileDown, Upload } from "lucide-react";
import Link from "next/link";
import { FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { PhotoGrid } from "@/components/photos/PhotoGrid";
import { PhotoUploader } from "@/components/photos/PhotoUploader";
import { storage } from "@/lib/storage";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { INSPECTION_TYPE_LABELS } from "@/lib/domain/constants";
import { projectOptions } from "@/lib/options";
import { dateParam, enumParam, str, type SP } from "@/lib/params";
import { listPhotos } from "@/lib/services/photos";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Project Photo Evidence" };

const PAGE = 48;
const REVIEW = ["PENDING_REVIEW", "REVIEWED", "APPROVED", "REJECTED"] as const;

export default async function PhotosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const f = {
    projectId: str(sp, "projectId"),
    unitId: str(sp, "unitId"),
    category: str(sp, "category"),
    stage: str(sp, "stage"),
    reviewStatus: enumParam(sp, "reviewStatus", REVIEW),
    q: str(sp, "q"),
    from: dateParam(sp, "from"),
    to: dateParam(sp, "to", true),
    sort: (str(sp, "sort") === "taken" ? "taken" : "uploaded") as "taken" | "uploaded",
  };
  const page = Math.max(1, Number(str(sp, "page") ?? 1) || 1);
  const showUpload = str(sp, "upload") === "1" && actor.permissions.has("photo.upload");
  const [{ rows, total }, projects, vocab, limits, units] = await Promise.all([
    listPhotos(actor, { ...f, take: PAGE, skip: (page - 1) * PAGE }),
    projectOptions(),
    getSetting("vocabulary"),
    getSetting("uploadLimits"),
    db.unit.findMany({ orderBy: { ref: "asc" }, select: { id: true, ref: true, type: true, projectId: true } }),
  ]);
  const unitOpts = units.filter((u) => !f.projectId || u.projectId === f.projectId).map((u) => ({ value: u.id, label: u.ref }));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page" && k !== "upload") p.set(k, v);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/photos?${p.toString()}`;
  };
  const defaults: Record<string, string | undefined> = {};
  for (const k of ["projectId", "unitId", "inspectionId", "ncrId", "weldId", "materialId", "repairId", "reworkPhase", "category", "stage"]) defaults[k] = str(sp, k) ?? undefined;
  if (defaults.reworkPhase && !defaults.category) defaults.category = defaults.reworkPhase === "BEFORE" ? "Repair & rework — before" : "Repair & rework — after";

  return (
    <div>
      <PageHeader
        title="Project Photo Evidence"
        subtitle="Factory photographs linked to projects, frames, inspections, welds, materials and NCRs. Originals are stored unchanged with a SHA-256 fingerprint."
        actions={
          <>
            {actor.permissions.has("export.excel") && <a className="btn-secondary" href={`/api/export/photos${f.projectId ? `?projectId=${f.projectId}` : ""}`}><FileDown className="h-4 w-4" />Evidence index</a>}
            {actor.permissions.has("photo.upload") && !showUpload && <Link className="btn-primary" href={qs({ upload: "1" })}><Upload className="h-4 w-4" />Upload photos</Link>}
          </>
        }
      />
      {showUpload && (
        <Card title="Upload factory photos" className="mb-4" actions={<Link href={qs({})} className="btn-ghost btn-sm">Close</Link>}>
          <PhotoUploader
            projects={projects}
            units={units.map((u) => ({ value: u.id, label: `${u.ref} (${u.type.toLowerCase()})`, projectId: u.projectId }))}
            categories={vocab.photoCategories}
            stages={vocab.productionStages}
            inspectionTypes={Object.values(INSPECTION_TYPE_LABELS).map((label) => ({ value: label, label }))}
            maxFileMb={limits.maxFileMb}
            maxFiles={limits.maxFilesPerBatch}
            defaults={defaults}
            direct={storage().driver === "vercel-blob"}
          />
        </Card>
      )}
      <FilterBar reset="/photos">
        <FilterInput name="q" label="Search" value={f.q} placeholder="EV code, caption, heat no., weld, tag" />
        <FilterSelect name="projectId" label="Project" options={projects} value={f.projectId} />
        <FilterSelect name="unitId" label="Module / frame" options={unitOpts} value={f.unitId} />
        <FilterSelect name="category" label="Category" options={vocab.photoCategories} value={f.category} />
        <FilterSelect name="stage" label="Stage" options={vocab.productionStages} value={f.stage} />
        <FilterSelect name="reviewStatus" label="Review" options={REVIEW.map((r) => ({ value: r, label: r.replace(/_/g, " ").toLowerCase() }))} value={f.reviewStatus} />
        <FilterInput name="from" label="From" type="date" value={str(sp, "from")} />
        <FilterInput name="to" label="To" type="date" value={str(sp, "to")} />
        <FilterSelect name="sort" label="Sort" options={[{ value: "taken", label: "Capture time" }]} value={f.sort === "taken" ? "taken" : null} empty="Upload time" />
      </FilterBar>
      <div className="mb-3 text-sm text-ink-300">{total} photo(s){total > PAGE ? ` · page ${page} of ${pages}` : ""}. Date filters use capture time, or upload time when the file has none.</div>
      {rows.length ? <PhotoGrid photos={rows} /> : <Empty title="No photos match">{actor.permissions.has("photo.upload") && <Link className="link" href={qs({ upload: "1" })}>Upload the first photos</Link>}</Empty>}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link className="btn-secondary btn-sm" href={qs({ page: String(page - 1) })}>Previous</Link>}
          <span className="text-sm text-ink-300">Page {page} of {pages}</span>
          {page < pages && <Link className="btn-secondary btn-sm" href={qs({ page: String(page + 1) })}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
