import { Camera, FileDown } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { PhotoGrid } from "@/components/photos/PhotoGrid";
import { Thumb } from "@/components/photos/Thumb";
import { Badge, Card, DemoTag, Empty, fmtDate, fmtDateTime, History, KV, PageHeader, Tabs } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_PRODUCTION_STAGES, humanize, INSPECTION_TYPE_LABELS, PROJECT_FILE_CATEGORIES, PROJECT_FILE_EXTENSIONS, PROJECT_FILE_MAX_MB } from "@/lib/domain/constants";
import { str, type SP } from "@/lib/params";
import { REPORT_TYPES } from "@/lib/report/data";
import { listProjectFiles } from "@/lib/services/files";
import { listPhotos, missingEvidence } from "@/lib/services/photos";
import { getProject, projectTimeline } from "@/lib/services/projects";
import { releaseReadiness } from "@/lib/services/release";
import { materialFlags } from "@/lib/services/materials";
import { getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { FileUploader } from "@/components/projects/FileUploader";
import { removeFileAction } from "./file-actions";
import { createUnitAction, updateProjectAction, updateUnitAction } from "../actions";
import { projectFieldDefs, unitFieldDefs } from "../fields";
import { ItpTab } from "./ItpTab";
import { ReportGenerator } from "./ReportGenerator";

const TABS = ["overview", "timeline", "photos", "materials", "fabrication", "welding", "inspections", "ncrs", "files", "documents", "itp", "release", "reports"] as const;

export default async function ProjectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(str(sp, "tab") ?? "") ? (str(sp, "tab") as (typeof TABS)[number]) : "overview";
  const project = await getProject(actor, id);
  const counts = await db.project.findUnique({
    where: { id },
    select: { _count: { select: { photos: { where: { deletedAt: null } }, materials: true, inspections: true, welds: true, ncrs: true, documents: true, reports: true, files: { where: { removedAt: null } } } } },
  });
  const c = counts!._count;
  const fabCount = await db.inspection.count({ where: { projectId: id, type: { in: ["FABRICATION", "DIMENSIONAL"] } } });
  const base = `/projects/${id}`;
  const canWrite = actor.permissions.has("project.write");

  return (
    <div>
      <PageHeader
        title={`${project.code} — ${project.name}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={project.status} /> <DemoTag show={project.isDemo} />
            <span>Start {fmtDate(project.startDate)} · Target {fmtDate(project.targetDate)} · {project.units.length} module(s)/frame(s)</span>
          </span>
        }
        actions={
          <>
            {actor.permissions.has("photo.upload") && <Link className="btn-secondary" href={`/photos?upload=1&projectId=${id}`}><Camera className="h-4 w-4" />Upload photos</Link>}
            {actor.permissions.has("report.generate") && <Link className="btn-primary" href={`${base}?tab=reports`}><FileDown className="h-4 w-4" />Quality report</Link>}
          </>
        }
      />
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "timeline", label: "Timeline" },
          { key: "photos", label: "Photos", count: c.photos },
          { key: "materials", label: "Materials", count: c.materials },
          { key: "fabrication", label: "Fabrication", count: fabCount },
          { key: "welding", label: "Welding", count: c.welds },
          { key: "inspections", label: "Inspections", count: c.inspections },
          { key: "ncrs", label: "NCRs", count: c.ncrs },
          { key: "files", label: "Files", count: c.files },
          { key: "documents", label: "Documents", count: c.documents },
          { key: "itp", label: "ITP" },
          { key: "release", label: "Final release" },
          { key: "reports", label: "Reports", count: c.reports },
        ]}
      />
      {tab === "overview" && <Overview project={project} canWrite={canWrite} focusUnit={str(sp, "unit")} />}
      {tab === "timeline" && <Timeline actor={actor} projectId={id} />}
      {tab === "photos" && <Photos actor={actor} projectId={id} />}
      {tab === "materials" && <Materials projectId={id} />}
      {tab === "fabrication" && <InspectionList projectId={id} types={["FABRICATION", "DIMENSIONAL"]} empty="No fabrication or dimensional inspections." newHref={`/fabrication?projectId=${id}`} />}
      {tab === "inspections" && <InspectionList projectId={id} empty="No inspections recorded." newHref={`/inspections/new?projectId=${id}`} />}
      {tab === "welding" && <Welding projectId={id} />}
      {tab === "ncrs" && <Ncrs projectId={id} />}
      {tab === "files" && <Files actor={actor} projectId={id} units={project.units} />}
      {tab === "documents" && <Documents projectId={id} />}
      {tab === "itp" && <ItpTab actor={actor} projectId={id} />}
      {tab === "release" && <Release actor={actor} projectId={id} units={project.units} />}
      {tab === "reports" && <Reports actor={actor} projectId={id} units={project.units} />}
    </div>
  );
}

type Actor = Awaited<ReturnType<typeof requirePagePermission>>;
type Project = Awaited<ReturnType<typeof getProject>>;

async function Overview({ project, canWrite, focusUnit }: { project: Project; canWrite: boolean; focusUnit: string | null }) {
  const [vocab, history, missing] = await Promise.all([
    getSetting("vocabulary"),
    db.auditEvent.findMany({ where: { entityType: "Project", entityId: project.id }, orderBy: { at: "desc" }, take: 20 }),
    getSetting("releaseRules").then((r) => missingEvidence(project.id, r.requiredPhotoCategories)),
  ]);
  const stages = project.stages.length ? project.stages : vocab.productionStages ?? [...DEFAULT_PRODUCTION_STAGES];
  const parents = project.units.filter((u) => u.type !== "COMPONENT").map((u) => ({ value: u.id, label: `${u.ref} (${u.type.toLowerCase()})` }));
  const unitRef = new Map(project.units.map((u) => [u.id, u.ref]));
  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <Card title="Project details">
          <KV
            items={[
              ["Project ID", project.code],
              ["Customer reference", project.customerRef],
              ["Project manager", project.projectManager],
              ["Responsible departments", project.departments],
              ["Start date", fmtDate(project.startDate)],
              ["Target completion", fmtDate(project.targetDate)],
              ["Drawings & revisions", project.drawingRefs],
              ["Production stages", project.stages.length ? project.stages.join(" → ") : "Organisation default"],
              ["Description", project.description],
              ["Scope", project.scope],
              ["Inspection & test requirements", project.requirements],
              ["Missing required evidence", missing.length ? missing.join(", ") : "None"],
            ]}
          />
        </Card>
        <Card title={`Modules, frames & components (${project.units.length})`} pad={false}>
          {project.units.length === 0 ? (
            <div className="p-5"><Empty title="No modules or frames yet" /></div>
          ) : (
            <div className="table-wrap border-0">
              <table className="tbl">
                <thead><tr><th>Ref</th><th>Type</th><th>Part of</th><th>Drawing / rev</th><th>Stage</th><th>Released</th><th></th></tr></thead>
                <tbody>
                  {project.units.map((u) => (
                    <tr key={u.id} className={focusUnit === u.id ? "bg-gold-600/10" : undefined}>
                      <td className="font-medium">{u.ref}</td>
                      <td>{humanize(u.type)}</td>
                      <td>{u.parentId ? unitRef.get(u.parentId) : "—"}</td>
                      <td>{[u.drawingRef, u.revision && `rev ${u.revision}`].filter(Boolean).join(" ") || "—"}</td>
                      <td>{u.stage ?? "—"}</td>
                      <td>{u.released ? <Badge value="RELEASED" /> : <span className="text-ink-300">No</span>}</td>
                      <td>
                        {canWrite && (
                          <details>
                            <summary className="cursor-pointer text-xs text-gold-300">Edit</summary>
                            <div className="mt-2 w-[min(80vw,520px)]">
                              <ActionForm action={updateUnitAction.bind(null, project.id, u.id)} submit="Save">
                                <Fields fields={unitFieldDefs(u, parents.filter((x) => x.value !== u.id), stages)} />
                              </ActionForm>
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canWrite && (
            <div className="border-t border-ink-600/70">
              <h3 className="px-5 py-3 text-sm font-semibold text-gold-300">Add module / frame / component</h3>
              <div className="px-5 pb-5">
                <ActionForm action={createUnitAction.bind(null, project.id)} submit="Add" resetOnSuccess>
                  <Fields fields={unitFieldDefs(null, parents, stages)} cols={3} />
                </ActionForm>
              </div>
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-4">
        {canWrite && (
          <Card title="Edit project">
            <ActionForm action={updateProjectAction.bind(null, project.id)} submit="Save changes">
              <Fields fields={projectFieldDefs(project as unknown as Record<string, unknown>, { withStatus: true })} cols={1} />
            </ActionForm>
          </Card>
        )}
        <Card title="Change history"><History events={history} /></Card>
      </div>
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  project: "bg-gold-500", photo: "bg-info-500", inspection: "bg-ok-500", weld: "bg-warn-500", material: "bg-ink-300",
  ndt: "bg-info-400", coating: "bg-ok-400", ncr: "bg-bad-500", repair: "bg-warn-400", release: "bg-gold-300",
};

async function Timeline({ actor, projectId }: { actor: Actor; projectId: string }) {
  const entries = await projectTimeline(actor, projectId);
  if (!entries.length) return <Empty title="No dated records yet">Records appear here as materials, inspections, photos and NCRs are added.</Empty>;
  return (
    <Card title={`Project history (${entries.length} events, oldest first)`}>
      <ol className="relative ml-2 space-y-4 border-l border-ink-600 pl-6">
        {entries.map((e, i) => (
          <li key={i} className="relative">
            <span className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-ink-800 ${KIND_COLOR[e.kind]}`} />
            <div className="flex flex-wrap items-start gap-3">
              {e.thumbId && <Link href={e.href!}><Thumb id={e.thumbId} hasThumb alt={e.title} className="h-14 w-20 rounded" /></Link>}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-ink-300">
                  {fmtDateTime(e.at)} {e.approximate && <span className="text-warn-400" title="Event date not recorded; the record/upload date is shown">· record date</span>} · <span className="uppercase tracking-wide">{e.kind}</span>
                </div>
                <div className="text-sm text-ink-100">
                  {e.href ? <Link href={e.href} className="hover:underline">{e.title}</Link> : e.title} {e.status && <Badge value={e.status} />}
                </div>
                {e.detail && <div className="line-clamp-2 text-xs text-ink-300">{e.detail}</div>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

async function Photos({ actor, projectId }: { actor: Actor; projectId: string }) {
  const [{ rows, total }, rules] = await Promise.all([listPhotos(actor, { projectId, sort: "taken", take: 120 }), getSetting("releaseRules")]);
  const missing = await missingEvidence(projectId, rules.requiredPhotoCategories);
  return (
    <div className="space-y-4">
      {missing.length > 0 && <div className="rounded-lg border border-warn-600/50 bg-warn-600/10 px-4 py-2 text-sm text-warn-400">Required evidence missing: {missing.join(", ")}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-300">
        <span>{total} photo(s), in capture order{total > rows.length ? ` — showing first ${rows.length}` : ""}.</span>
        <span className="flex gap-2">
          <Link className="btn-secondary btn-sm" href={`/photos?projectId=${projectId}`}>Open in gallery</Link>
          {actor.permissions.has("photo.upload") && <Link className="btn-primary btn-sm" href={`/photos?upload=1&projectId=${projectId}`}>Upload photos</Link>}
        </span>
      </div>
      {rows.length ? <PhotoGrid photos={rows} /> : <Empty title="No photos yet" />}
    </div>
  );
}

async function Materials({ projectId }: { projectId: string }) {
  const rows = await db.material.findMany({ where: { projectId }, orderBy: { code: "asc" } });
  if (!rows.length) return <Empty title="No materials linked to this project"><Link className="link" href="/materials">Register material</Link></Empty>;
  return (
    <Card pad={false}>
      <div className="table-wrap border-0">
        <table className="tbl">
          <thead><tr><th>Material</th><th>Description</th><th>Grade</th><th>Heat no.</th><th>Certificate</th><th>Status</th><th>Flags</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td><Link className="link" href={`/materials/${m.id}`}>{m.code}</Link></td>
                <td>{m.description}</td>
                <td>{m.grade ?? "—"}</td>
                <td>{m.heatNumber ?? <span className="text-bad-400">missing</span>}</td>
                <td>{m.certificateRef ?? "—"} <Badge value={m.certStatus} /></td>
                <td><Badge value={m.status} /></td>
                <td className="text-xs text-warn-400">{materialFlags(m).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function InspectionList({ projectId, types, empty, newHref }: { projectId: string; types?: ("FABRICATION" | "DIMENSIONAL")[]; empty: string; newHref: string }) {
  const rows = await db.inspection.findMany({
    where: { projectId, ...(types ? { type: { in: types } } : {}) },
    orderBy: [{ inspectedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    include: { unit: { select: { ref: true } } },
  });
  return (
    <Card pad={false} actions={<Link className="btn-secondary btn-sm" href={newHref}>New</Link>} title={`${rows.length} record(s)`}>
      {!rows.length ? <div className="p-5"><Empty title={empty} /></div> : (
        <div className="table-wrap border-0">
          <table className="tbl">
            <thead><tr><th>Ref</th><th>Type</th><th>Operation / stage</th><th>Frame</th><th>Date</th><th>Inspector</th><th>Result</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td><Link className="link" href={`/inspections/${i.id}`}>{i.code}</Link>{i.reinspectionOfId && <span className="ml-1 text-[11px] text-ink-300">re-insp.</span>}</td>
                  <td>{INSPECTION_TYPE_LABELS[i.type]}</td>
                  <td>{i.operation ?? i.stage ?? "—"}</td>
                  <td>{i.unit?.ref ?? "—"}</td>
                  <td className="whitespace-nowrap">{i.inspectedAt ? fmtDate(i.inspectedAt) : <span className="text-ink-300">planned {fmtDate(i.plannedDate)}</span>}</td>
                  <td>{i.inspectorName ?? "—"}</td>
                  <td><Badge value={i.result} /></td>
                  <td><Badge value={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

async function Welding({ projectId }: { projectId: string }) {
  const rows = await db.weld.findMany({ where: { projectId }, orderBy: { weldRef: "asc" }, include: { unit: { select: { ref: true } }, defects: { select: { category: true, confirmed: true } }, _count: { select: { repairs: true } } } });
  if (!rows.length) return <Empty title="No welds recorded"><Link className="link" href={`/welding?projectId=${projectId}`}>Welding QC</Link></Empty>;
  return (
    <Card pad={false}>
      <div className="table-wrap border-0">
        <table className="tbl">
          <thead><tr><th>Weld</th><th>Frame</th><th>WPS</th><th>Welder</th><th>Visual</th><th>Defects</th><th>Repairs</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id}>
                <td><Link className="link" href={`/welding/${w.id}`}>{w.weldRef}</Link></td>
                <td>{w.unit?.ref ?? "—"}</td>
                <td>{w.wpsRef ?? <span className="text-warn-400">not recorded</span>}</td>
                <td>{w.welderId ?? "—"}</td>
                <td><Badge value={w.visualResult} /></td>
                <td className="text-xs">{w.defects.map((d) => `${d.category}${d.confirmed ? "" : " (unconfirmed)"}`).join(", ") || "—"}</td>
                <td>{w._count.repairs}</td>
                <td><Badge value={w.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function Ncrs({ projectId }: { projectId: string }) {
  const rows = await db.ncr.findMany({ where: { projectId }, orderBy: { raisedAt: "desc" }, include: { unit: { select: { ref: true } } } });
  return (
    <Card pad={false} title={`${rows.length} NCR(s)`} actions={<Link className="btn-secondary btn-sm" href={`/ncr/new?projectId=${projectId}`}>Raise NCR</Link>}>
      {!rows.length ? <div className="p-5"><Empty title="No NCRs raised" /></div> : (
        <div className="table-wrap border-0">
          <table className="tbl">
            <thead><tr><th>NCR</th><th>Raised</th><th>Frame</th><th>Category</th><th>Priority</th><th>Target</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((n) => {
                const overdue = n.targetDate && n.targetDate < new Date() && !["CLOSED", "CANCELLED"].includes(n.status);
                return (
                  <tr key={n.id}>
                    <td><Link className="link" href={`/ncr/${n.id}`}>{n.code}</Link></td>
                    <td>{fmtDate(n.raisedAt)}</td>
                    <td>{n.unit?.ref ?? "—"}</td>
                    <td>{n.defectCategory}</td>
                    <td><Badge value={n.priority} /></td>
                    <td className={overdue ? "text-bad-400" : ""}>{fmtDate(n.targetDate)}{overdue ? " · overdue" : ""}</td>
                    <td><Badge value={n.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const fileSize = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function Files({ actor, projectId, units }: { actor: Actor; projectId: string; units: Project["units"] }) {
  const rows = await listProjectFiles(actor, projectId);
  const canUpload = actor.permissions.has("file.upload");
  const canRemove = actor.permissions.has("file.remove");
  return (
    <div className="space-y-4">
      {canUpload && (
        <Card title="Add files">
          <FileUploader
            projectId={projectId}
            units={units.map((u) => ({ value: u.id, label: u.ref }))}
            categories={PROJECT_FILE_CATEGORIES}
            extensions={PROJECT_FILE_EXTENSIONS}
            maxFileMb={PROJECT_FILE_MAX_MB}
            direct={storage().driver === "vercel-blob"}
          />
        </Card>
      )}
      {!rows.length ? (
        <Empty title="No files attached to this project">Drawings, purchase orders, certificates, reports and correspondence can be kept here. Controlled documents that need approval belong in <Link className="link" href="/documents">Documents</Link>.</Empty>
      ) : (
        <Card pad={false}>
          <div className="table-wrap border-0">
            <table className="tbl">
              <thead><tr><th>File</th><th>Category</th><th>Module / frame</th><th>Size</th><th>Uploaded</th><th>Notes</th>{canRemove && <th />}</tr></thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link prefetch={false} className="link" href={`/api/files/project-file/${f.id}`}>{f.fileName}</Link>
                      <div className="text-[11px] text-ink-400">{f.code}</div>
                    </td>
                    <td>{f.category}</td>
                    <td>{f.unit?.ref ?? "—"}</td>
                    <td className="whitespace-nowrap">{fileSize(f.sizeBytes)}</td>
                    <td className="whitespace-nowrap">{fmtDateTime(f.uploadedAt)}<div className="text-[11px] text-ink-400">{f.uploadedByName}</div></td>
                    <td className="max-w-xs text-xs text-ink-300">{f.notes}</td>
                    {canRemove && (
                      <td>
                        <details>
                          <summary className="cursor-pointer text-xs text-bad-400">Remove…</summary>
                          <div className="mt-2 w-56">
                            <ActionForm action={removeFileAction.bind(null, projectId, f.id)} submit="Remove file" submitClass="btn-danger" confirm={`Remove ${f.fileName} from this project? The record is kept in the audit trail.`}>
                              <input name="reason" required className="input" placeholder="Reason, e.g. superseded by Rev D" aria-label="Reason for removal" />
                            </ActionForm>
                          </div>
                        </details>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

async function Documents({ projectId }: { projectId: string }) {
  const rows = await db.document.findMany({ where: { projectId }, orderBy: { docNo: "asc" }, include: { revisions: { orderBy: { uploadedAt: "desc" } } } });
  if (!rows.length) return <Empty title="No controlled documents linked to this project"><Link className="link" href="/documents">Documents & Calibration</Link></Empty>;
  return (
    <Card pad={false}>
      <div className="table-wrap border-0">
        <table className="tbl">
          <thead><tr><th>Document no.</th><th>Title</th><th>Type</th><th>Latest rev</th><th>Approved rev</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td><Link className="link" href={`/documents?q=${encodeURIComponent(d.docNo)}`}>{d.docNo}</Link></td>
                <td>{d.title}</td>
                <td>{d.docType}</td>
                <td>{d.revisions[0]?.revision ?? "—"}</td>
                <td>{d.revisions.find((r) => r.status === "APPROVED")?.revision ?? <span className="text-warn-400">none</span>}</td>
                <td><Badge value={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function Release({ actor, projectId, units }: { actor: Actor; projectId: string; units: Project["units"] }) {
  const r = await releaseReadiness(actor, projectId);
  const unitStates = await Promise.all(units.filter((u) => u.type !== "COMPONENT").map(async (u) => ({ u, r: await releaseReadiness(actor, projectId, u.id) })));
  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Card title="Whole-project release gate" actions={<Link className="btn-primary btn-sm" href={`/release?projectId=${projectId}`}>Open release workflow</Link>}>
        <div className="mb-3 text-sm">
          {r.current ? <span className="text-ok-400">Released — {r.current.code} by {r.current.releasedByName} on {fmtDate(r.current.releasedAt)} ({humanize(r.current.status)})</span> : r.ready ? <span className="text-ok-400">All enabled checks pass — ready for authorised release.</span> : <span className="text-warn-400">Not ready: {r.checks.filter((c) => c.state === "FAIL").length} check(s) failing.</span>}
        </div>
        <ul className="space-y-2">
          {r.checks.map((c) => (
            <li key={c.key} className="rounded-lg border border-ink-600 p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-sm text-ink-100">{c.label}</span><Badge value={c.state === "NOT_REQUIRED" ? "NA" : c.state} label={c.state === "NOT_REQUIRED" ? "Not required" : undefined} /></div>
              <div className="mt-1 text-xs text-ink-300">{c.detail}</div>
              {c.items && <ul className="mt-1 list-inside list-disc text-xs text-warn-400">{c.items.slice(0, 8).map((i) => <li key={i}>{i}</li>)}{c.items.length > 8 && <li>… {c.items.length - 8} more</li>}</ul>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Modules / frames" pad={false}>
        {!unitStates.length ? <div className="p-5"><Empty title="No modules or frames" /></div> : (
          <table className="tbl">
            <thead><tr><th>Ref</th><th>Failing checks</th><th>Release</th></tr></thead>
            <tbody>
              {unitStates.map(({ u, r: ur }) => (
                <tr key={u.id}>
                  <td>{u.ref}</td>
                  <td>{ur.checks.filter((c) => c.state === "FAIL").length}</td>
                  <td>{ur.current ? <Badge value={ur.current.status} /> : ur.ready ? <Badge tone="ok" label="Ready" /> : <Badge tone="warn" label="Not ready" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

async function Reports({ actor, projectId, units }: { actor: Actor; projectId: string; units: Project["units"] }) {
  const jobs = await db.reportJob.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 100 });
  const unitRef = new Map(units.map((u) => [u.id, u.ref]));
  const canGenerate = actor.permissions.has("report.generate");
  return (
    <div className="space-y-4">
      {canGenerate ? (
        <Card title="Generate a quality report">
          <p className="mb-4 text-sm text-ink-300">Compiled from the current records at the moment you click. Reports are always marked DRAFT — NOT APPROVED until signed outside the system, and missing information is listed rather than filled in.</p>
          <ReportGenerator projectId={projectId} types={Object.entries(REPORT_TYPES).map(([value, label]) => ({ value, label }))} units={units.map((u) => ({ value: u.id, label: `${u.ref} (${u.type.toLowerCase()})` }))} />
        </Card>
      ) : (
        <Empty title="Your role cannot generate reports" />
      )}
      <Card title="Previous reports" pad={false}>
        {!jobs.length ? <div className="p-5"><Empty title="No reports generated yet" /></div> : (
          <div className="table-wrap border-0">
            <table className="tbl">
              <thead><tr><th>Report</th><th>Type</th><th>Scope</th><th>Rev</th><th>Status</th><th>Generated</th><th>By</th><th>Size</th><th></th></tr></thead>
              <tbody>
                {jobs.map((j) => {
                  const p = j.params as { unitId?: string | null; from?: string | null; to?: string | null };
                  return (
                    <tr key={j.id}>
                      <td className="font-medium">{j.code}</td>
                      <td>{REPORT_TYPES[j.reportType as keyof typeof REPORT_TYPES] ?? j.reportType}</td>
                      <td>{p.unitId ? unitRef.get(p.unitId) ?? "Unit" : "Whole project"}{(p.from || p.to) && <div className="text-[11px] text-ink-300">{p.from?.slice(0, 10) ?? "…"} → {p.to?.slice(0, 10) ?? "…"}</div>}</td>
                      <td>{j.revision}</td>
                      <td><Badge value={j.status === "COMPLETED" ? "COMPLETED" : j.status === "FAILED" ? "FAIL" : "PENDING"} label={humanize(j.status)} />{j.error && <div className="text-[11px] text-bad-400">{j.error}</div>}</td>
                      <td className="whitespace-nowrap">{fmtDateTime(j.createdAt)}</td>
                      <td>{j.createdByName ?? "—"}</td>
                      <td>{j.sizeBytes ? `${Math.round(j.sizeBytes / 1024)} KB` : "—"}</td>
                      <td>{j.status === "COMPLETED" && canGenerate && <a className="link" href={`/api/reports/${j.id}`}>Download PDF</a>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
