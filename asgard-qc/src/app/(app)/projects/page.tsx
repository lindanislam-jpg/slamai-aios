import Link from "next/link";
import { FileDown } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { Fields, FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, fmtDate, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { enumParam, str, type SP } from "@/lib/params";
import { listProjects } from "@/lib/services/projects";
import { createProjectAction } from "./actions";
import { PROJECT_STATUSES, projectFieldDefs } from "./fields";

export const metadata = { title: "Project Register" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const status = enumParam(sp, "status", [...PROJECT_STATUSES, "RELEASED"] as const);
  const q = str(sp, "q");
  const projects = await listProjects(actor, { q, status: status as never });

  return (
    <div>
      <PageHeader
        title="Project Register"
        subtitle="Every project from commencement to handover, with its linked quality records."
        actions={actor.permissions.has("export.excel") && <Link className="btn-secondary" href="/api/export/projects" prefetch={false}><FileDown className="h-4 w-4" />Excel</Link>}
      />
      {actor.permissions.has("project.write") && (
        <details className="card mb-4" open={sp.new === "1"}>
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gold-300">+ New project</summary>
          <div className="border-t border-ink-600/70 p-5">
            <ActionForm action={createProjectAction} submit="Create project">
              <Fields fields={projectFieldDefs(null, { withStatus: false })} />
            </ActionForm>
          </div>
        </details>
      )}
      <FilterBar reset="/projects">
        <FilterInput name="q" label="Search" value={q} placeholder="ID, name, customer ref, PM" />
        <FilterSelect name="status" label="Status" value={status} options={[...PROJECT_STATUSES, "RELEASED"].map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() }))} />
      </FilterBar>
      <Card pad={false}>
        {projects.length === 0 ? (
          <div className="p-5"><Empty title="No projects match">Create the first project to start recording quality evidence.</Empty></div>
        ) : (
          <div className="table-wrap border-0">
            <table className="tbl">
              <thead>
                <tr><th>Project ID</th><th>Name</th><th>Status</th><th>Start</th><th>Target</th><th>PM</th><th className="text-right">Frames</th><th className="text-right">Photos</th><th className="text-right">Inspections</th><th className="text-right">Open NCRs</th></tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap"><Link className="link font-medium" href={`/projects/${p.id}`}>{p.code}</Link> <DemoTag show={p.isDemo} /></td>
                    <td>{p.name}{p.customerRef && <div className="text-xs text-ink-300">{p.customerRef}</div>}</td>
                    <td><Badge value={p.status} /></td>
                    <td className="whitespace-nowrap">{fmtDate(p.startDate)}</td>
                    <td className="whitespace-nowrap">{fmtDate(p.targetDate)}</td>
                    <td>{p.projectManager ?? "—"}</td>
                    <td className="text-right tabular-nums">{p._count.units}</td>
                    <td className="text-right tabular-nums">{p._count.photos}</td>
                    <td className="text-right tabular-nums">{p._count.inspections}</td>
                    <td className={`text-right tabular-nums ${p.ncrs.length ? "text-warn-400" : ""}`}>{p.ncrs.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
