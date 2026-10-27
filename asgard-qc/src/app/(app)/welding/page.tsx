import { WeldStatus } from "@prisma/client";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Bars, Pareto } from "@/components/charts";
import { Fields, FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, PageHeader, Stat, Tabs } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import type { Actor } from "@/lib/permissions";
import { humanize } from "@/lib/domain/constants";
import { projectOptions, unitOptions } from "@/lib/options";
import { enumParam, str, type SP } from "@/lib/params";
import { listWelds, weldAnalytics } from "@/lib/services/welding";
import { getSetting } from "@/lib/settings";
import { createWeldAction } from "./actions";

export const metadata = { title: "Welding QC" };

export default async function WeldingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const tab = str(sp, "tab") === "analytics" ? "analytics" : "register";
  const projectId = str(sp, "projectId");
  const [projects, units] = await Promise.all([projectOptions(), unitOptions(projectId)]);
  const base = `/welding${projectId ? `?projectId=${projectId}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Welding QC"
        subtitle="Weld register, visual inspection, defects, repairs and re-inspection. Defect counts use inspector-confirmed defects only."
        actions={actor.permissions.has("export.excel") && (
          <a className="btn-secondary" href={`/api/export/weld-defects${projectId ? `?projectId=${projectId}` : ""}`}>
            <FileDown className="h-4 w-4" /> Excel
          </a>
        )}
      />
      <Tabs base={base} active={tab} tabs={[{ key: "register", label: "Weld register" }, { key: "analytics", label: "Defect analytics" }]} />
      {tab === "analytics" ? <Analytics projectId={projectId} projects={projects} /> : <Register sp={sp} projectId={projectId} projects={projects} units={units} actor={actor} />}
    </div>
  );
}

async function Register({ sp, projectId, projects, units, actor }: { sp: SP; projectId: string | null; projects: { value: string; label: string }[]; units: { value: string; label: string }[]; actor: Actor }) {
  const canWrite = actor.permissions.has("weld.write");
  const [rows, vocab] = await Promise.all([
    listWelds(actor, { projectId, unitId: str(sp, "unitId"), status: enumParam(sp, "status", Object.values(WeldStatus)), q: str(sp, "q") }),
    getSetting("vocabulary"),
  ]);
  const count = (s: WeldStatus) => rows.filter((r) => r.status === s).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Welds listed" value={rows.length} />
        <Stat label="Accepted" value={count("ACCEPTED")} tone="ok" />
        <Stat label="Awaiting inspection / NDT" value={count("AWAITING_INSPECTION")} tone={count("AWAITING_INSPECTION") ? "warn" : undefined} />
        <Stat label="Repair required" value={count("REPAIR_REQUIRED")} tone={count("REPAIR_REQUIRED") ? "bad" : undefined} />
        <Stat label="Awaiting re-inspection" value={count("AWAITING_REINSPECTION")} tone={count("AWAITING_REINSPECTION") ? "warn" : undefined} />
      </div>
      <FilterBar reset="/welding">
        <FilterInput name="q" label="Search" value={str(sp, "q")} placeholder="Weld ID, WPS, welder, component" />
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
        <FilterSelect name="unitId" label="Frame" options={units} value={str(sp, "unitId")} />
        <FilterSelect name="status" label="Status" options={Object.values(WeldStatus).map((v) => ({ value: v, label: humanize(v) }))} value={str(sp, "status")} />
      </FilterBar>
      {rows.length === 0 ? (
        <Empty title="No welds match" />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Weld ID</th><th>Project</th><th>Frame</th><th>WPS</th><th>Welder</th><th>Visual</th><th>Defects</th><th>Repairs</th><th>NDT</th><th>Photos</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((w) => {
                const confirmed = w.defects.filter((d) => d.confirmed);
                const unconfirmed = w.defects.length - confirmed.length;
                return (
                  <tr key={w.id}>
                    <td className="whitespace-nowrap"><Link className="link font-medium" href={`/welding/${w.id}`}>{w.weldRef}</Link> <DemoTag show={w.isDemo} /></td>
                    <td>{w.project.code}</td>
                    <td>{w.unit?.ref ?? "—"}</td>
                    <td>{w.wpsRef ?? <span className="text-warn-400">not recorded</span>}</td>
                    <td>{w.welderId ?? "—"}</td>
                    <td><Badge value={w.visualResult} /></td>
                    <td className="text-xs">
                      {confirmed.length ? confirmed.map((d) => d.category).join(", ") : "—"}
                      {unconfirmed > 0 && <span className="block text-warn-400">{unconfirmed} unconfirmed</span>}
                    </td>
                    <td>{w._count.repairs}</td>
                    <td>{w.ndtRequired ? `${w._count.ndt} rec.` : "Not req."}</td>
                    <td>{w._count.photos}</td>
                    <td><Badge value={w.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canWrite && (
        <Card title="Register a weld">
          <ActionForm action={createWeldAction} submit="Register weld">
            <Fields
              cols={3}
              fields={[
                { name: "projectId", label: "Project", type: "select", options: projects, required: true, defaultValue: projectId },
                { name: "unitId", label: "Frame / module", type: "select", options: units },
                { name: "weldRef", label: "Weld ID / joint ref", required: true, hint: "Unique within the project." },
                { name: "componentRef", label: "Component" },
                { name: "drawingRef", label: "Drawing & revision" },
                { name: "wpsRef", label: "Approved WPS reference" },
                { name: "welderId", label: "Welder ID" },
                { name: "welderQualRef", label: "Welder qualification ref" },
                { name: "process", label: "Process" },
                { name: "materialDetails", label: "Material details" },
                { name: "stage", label: "Stage", type: "select", options: vocab.productionStages, defaultValue: "Welding" },
                { name: "criteriaRef", label: "Acceptance criteria reference", hint: "Selected and approved by quality personnel — not built in." },
                { name: "ndtRequired", label: "NDT required for this weld", type: "checkbox" },
              ]}
            />
          </ActionForm>
        </Card>
      )}
    </>
  );
}

async function Analytics({ projectId, projects }: { projectId: string | null; projects: { value: string; label: string }[] }) {
  const a = await weldAnalytics(projectId);
  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="analytics" />
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} empty="All projects" />
        <button className="btn-secondary">Apply</button>
      </form>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Confirmed defects" value={a.total} tone={a.total ? "bad" : undefined} />
        <Stat label="Defect categories" value={a.pareto.length} />
        <Stat label="Repeat-defect patterns" value={a.repeats.length} tone={a.repeats.length ? "warn" : undefined} />
        <Stat label="Weld repairs logged" value={a.repairTrend.reduce((s, r) => s + r.count, 0)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Defect Pareto (confirmed)"><Pareto data={a.pareto} /></Card>
        <Card title="Repeat defects (same category ≥ 2 for a welder or frame)" pad={false}>
          {a.repeats.length ? (
            <table className="tbl"><thead><tr><th>Pattern</th><th>Count</th></tr></thead>
              <tbody>{a.repeats.map((r) => <tr key={r.key}><td>{r.key}</td><td className="text-warn-400">{r.count}</td></tr>)}</tbody>
            </table>
          ) : <div className="p-4"><Empty title="No repeat patterns" /></div>}
        </Card>
        <Card title="Defects by project"><Bars data={a.byProject} color="#f0a531" /></Card>
        <Card title="Defects by frame"><Bars data={a.byUnit} color="#e5484d" /></Card>
        <Card title="Confirmed defects per month"><Bars data={a.byMonth} color="#3b82f6" /></Card>
        <Card title="Weld repairs per month"><Bars data={a.repairTrend} color="#c39a45" /></Card>
      </div>
    </>
  );
}
