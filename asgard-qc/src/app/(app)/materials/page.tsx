import { CertStatus, MaterialStatus } from "@prisma/client";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields, FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { humanize } from "@/lib/domain/constants";
import { projectOptions } from "@/lib/options";
import { enumParam, str, type SP } from "@/lib/params";
import { listMaterials, materialFlags } from "@/lib/services/materials";
import { createMaterialAction } from "./actions";
import { materialFields } from "./fields";

export const metadata = { title: "Material Traceability" };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const filter = { projectId, status: enumParam(sp, "status", Object.values(MaterialStatus)), certStatus: enumParam(sp, "certStatus", Object.values(CertStatus)), q: str(sp, "q"), gapsOnly: str(sp, "gaps") === "1" };
  const [rows, projects] = await Promise.all([listMaterials(actor, filter), projectOptions()]);
  const qs = projectId ? `?projectId=${projectId}` : "";
  const flagged = rows.filter((m) => materialFlags(m).length);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Material Traceability"
        subtitle="Heat numbers, certificates, receiving inspection and disposition. Uploading or entering a certificate never accepts material by itself."
        actions={actor.permissions.has("export.excel") && <a className="btn-secondary" href={`/api/export/materials${qs}`}><FileDown className="h-4 w-4" /> Excel</a>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Materials listed" value={rows.length} />
        <Stat label="Accepted" value={rows.filter((m) => m.status === "ACCEPTED").length} tone="ok" />
        <Stat label="Awaiting inspection" value={rows.filter((m) => m.status === "AWAITING_INSPECTION").length} tone="warn" href="/materials?status=AWAITING_INSPECTION" />
        <Stat label="Quarantined" value={rows.filter((m) => m.status === "QUARANTINED").length} tone="bad" href="/materials?status=QUARANTINED" />
        <Stat label="With traceability flags" value={flagged.length} tone={flagged.length ? "warn" : undefined} href="/materials?gaps=1" />
      </div>
      <FilterBar reset="/materials">
        <FilterInput name="q" label="Search" value={filter.q} placeholder="Heat no., grade, certificate, component, supplier" />
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
        <FilterSelect name="status" label="Status" options={Object.values(MaterialStatus).map((v) => ({ value: v, label: humanize(v) }))} value={filter.status} />
        <FilterSelect name="certStatus" label="Certificate" options={Object.values(CertStatus).map((v) => ({ value: v, label: humanize(v) }))} value={filter.certStatus} />
        <FilterSelect name="gaps" label="Gaps" options={[{ value: "1", label: "Traceability gaps only" }]} value={filter.gapsOnly ? "1" : null} empty="All" />
      </FilterBar>
      {rows.length === 0 ? <Empty title="No materials match" /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Material ID</th><th>Project</th><th>Description</th><th>Grade</th><th>Heat no.</th><th>Certificate</th><th>Supplier / PO</th><th>Receiving</th><th>Status</th><th>Flags</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap"><Link className="link font-medium" href={`/materials/${m.id}`}>{m.code}</Link> <DemoTag show={m.isDemo} /></td>
                  <td>{m.project?.code ?? "Stock"}</td>
                  <td>{m.description}{m.componentRef && <span className="block text-xs text-ink-300">{m.componentRef}</span>}</td>
                  <td>{m.grade ?? "—"}</td>
                  <td className="font-mono text-xs">{m.heatNumber ?? <span className="text-bad-400">missing</span>}</td>
                  <td>{m.certificateRef ?? "—"}<div><Badge value={m.certStatus} /></div></td>
                  <td className="text-ink-300">{[m.supplier, m.poRef].filter(Boolean).join(" · ") || "—"}</td>
                  <td><Badge value={m.receivingResult} /></td>
                  <td><Badge value={m.status} /></td>
                  <td className="text-xs text-warn-400">{materialFlags(m).filter((f) => f !== "Quarantined" && f !== "Awaiting inspection").join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {actor.permissions.has("material.write") && (
        <Card title="Register incoming material">
          <ActionForm action={createMaterialAction} submit="Register material">
            <Fields cols={3} fields={materialFields(projects, { projectId }, actor.name)} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
