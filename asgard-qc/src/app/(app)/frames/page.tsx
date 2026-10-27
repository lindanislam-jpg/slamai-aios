import Link from "next/link";
import { FilterBar, FilterSelect } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { humanize } from "@/lib/domain/constants";
import { projectOptions } from "@/lib/options";
import { enumParam, str, type SP } from "@/lib/params";
import { listUnits } from "@/lib/services/projects";

export const metadata = { title: "Frame & Module Tracking" };

export default async function FramesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const type = enumParam(sp, "type", ["MODULE", "FRAME", "COMPONENT"] as const);
  const released = enumParam(sp, "released", ["yes", "no"] as const);
  const stage = str(sp, "stage");
  const [all, projects] = await Promise.all([listUnits(actor, projectId), projectOptions()]);
  const stages = [...new Set(all.map((u) => u.stage).filter((s): s is string => !!s))].sort();
  const units = all.filter((u) => (!type || u.type === type) && (!stage || u.stage === stage) && (!released || (released === "yes") === u.released));

  return (
    <div>
      <PageHeader title="Frame & Module Tracking" subtitle="Every module, frame and component with its stage, evidence and open issues. Add units from the project page." />
      <FilterBar reset="/frames">
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
        <FilterSelect name="type" label="Type" options={[{ value: "MODULE", label: "Module" }, { value: "FRAME", label: "Frame" }, { value: "COMPONENT", label: "Component" }]} value={type} />
        <FilterSelect name="stage" label="Stage" options={stages} value={stage} />
        <FilterSelect name="released" label="Released" options={[{ value: "yes", label: "Released" }, { value: "no", label: "Not released" }]} value={released} />
      </FilterBar>
      <Card pad={false} title={`${units.length} unit(s)`}>
        {!units.length ? <div className="p-5"><Empty title="No modules or frames match">Open a project and add its modules/frames.</Empty></div> : (
          <div className="table-wrap border-0">
            <table className="tbl">
              <thead><tr><th>Ref</th><th>Project</th><th>Type</th><th>Drawing / rev</th><th>Stage</th><th className="text-right">Inspections</th><th className="text-right">Welds</th><th className="text-right">Photos</th><th className="text-right">Open NCRs</th><th>Released</th></tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium"><Link className="link" href={`/projects/${u.projectId}?tab=overview&unit=${u.id}`}>{u.ref}</Link> <DemoTag show={u.isDemo} /></td>
                    <td><Link className="hover:underline" href={`/projects/${u.projectId}`}>{u.project.code}</Link><div className="text-xs text-ink-300">{u.project.name}</div></td>
                    <td>{humanize(u.type)}</td>
                    <td>{[u.drawingRef, u.revision && `rev ${u.revision}`].filter(Boolean).join(" ") || "—"}</td>
                    <td>{u.stage ?? "—"}</td>
                    <td className="text-right tabular-nums">{u._count.inspections}</td>
                    <td className="text-right tabular-nums">{u._count.welds}</td>
                    <td className="text-right tabular-nums"><Link className="hover:underline" href={`/photos?projectId=${u.projectId}&unitId=${u.id}`}>{u._count.photos}</Link></td>
                    <td className={`text-right tabular-nums ${u.ncrs.length ? "text-warn-400" : ""}`}>{u.ncrs.length}</td>
                    <td>{u.released ? <Badge value="RELEASED" /> : <span className="text-ink-300">No</span>}</td>
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
