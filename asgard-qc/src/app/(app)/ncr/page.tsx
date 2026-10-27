import { FileDown, Plus } from "lucide-react";
import Link from "next/link";
import type { NcrStatus, Priority } from "@prisma/client";
import { FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { Badge, DemoTag, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { NCR_DEFECT_CATEGORIES } from "@/lib/domain/constants";
import { projectOptions } from "@/lib/options";
import { enumParam, str, type SP } from "@/lib/params";
import { listNcrs } from "@/lib/services/ncrs";

export const metadata = { title: "NCR & CAPA" };

const STATUSES = ["OPEN", "CONTAINED", "INVESTIGATING", "ACTION_IN_PROGRESS", "AWAITING_VERIFICATION", "CLOSED", "CANCELLED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default async function NcrRegister({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const status: NcrStatus | "OPEN_ALL" | null = str(sp, "status") === "OPEN_ALL" ? "OPEN_ALL" : enumParam<NcrStatus>(sp, "status", STATUSES);
  const filter = {
    projectId: str(sp, "projectId"),
    status,
    priority: enumParam<Priority>(sp, "priority", PRIORITIES),
    category: str(sp, "category"),
    q: str(sp, "q"),
    overdue: str(sp, "overdue") === "1",
  };
  const [rows, projects] = await Promise.all([listNcrs(actor, filter), projectOptions()]);
  const now = Date.now();
  const open = rows.filter((n) => !["CLOSED", "CANCELLED"].includes(n.status));
  const overdue = open.filter((n) => n.targetDate && n.targetDate.getTime() < now);
  const exportQ = new URLSearchParams({ ...(filter.projectId ? { projectId: filter.projectId } : {}) }).toString();

  return (
    <div>
      <PageHeader
        title="NCR & CAPA Management"
        subtitle="Non-conformances, root cause, corrective/preventive actions and verified closure."
        actions={
          <>
            {actor.permissions.has("export.excel") && (
              <a className="btn-secondary" href={`/api/export/ncrs?${exportQ}`}>
                <FileDown className="h-4 w-4" /> Excel
              </a>
            )}
            {actor.permissions.has("ncr.raise") && (
              <Link className="btn-primary" href="/ncr/new">
                <Plus className="h-4 w-4" /> Raise NCR
              </Link>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Shown" value={rows.length} />
        <Stat label="Open" value={open.length} tone={open.length ? "warn" : undefined} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : undefined} href="/ncr?overdue=1" />
        <Stat label="High / critical open" value={open.filter((n) => n.priority === "HIGH" || n.priority === "CRITICAL").length} />
      </div>
      <FilterBar reset="/ncr">
        <FilterInput name="q" label="Search" value={filter.q} placeholder="NCR, frame, text" />
        <FilterSelect name="projectId" label="Project" options={projects} value={filter.projectId} />
        <FilterSelect name="status" label="Status" options={[{ value: "OPEN_ALL", label: "All open" }, ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() }))]} value={str(sp, "status")} />
        <FilterSelect name="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: p.toLowerCase() }))} value={filter.priority} />
        <FilterSelect name="category" label="Category" options={[...NCR_DEFECT_CATEGORIES]} value={filter.category} />
        <FilterSelect name="overdue" label="Overdue" options={[{ value: "1", label: "Overdue only" }]} value={filter.overdue ? "1" : null} empty="Any" />
      </FilterBar>
      {rows.length === 0 ? (
        <Empty title="No NCRs match these filters." />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>NCR</th><th>Project / frame</th><th>Raised</th><th>Category</th><th>Description</th><th>Priority</th><th>Owner / target</th><th>Days open</th><th>Actions</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const closedOrNow = n.status === "CLOSED" || n.status === "CANCELLED" ? (n.closedAt ?? n.updatedAt).getTime() : now;
                const days = Math.floor((closedOrNow - n.raisedAt.getTime()) / 86_400_000);
                const isOverdue = !["CLOSED", "CANCELLED"].includes(n.status) && n.targetDate && n.targetDate.getTime() < now;
                const done = n.actions.filter((a) => a.status === "VERIFIED").length;
                const live = n.actions.filter((a) => a.status !== "CANCELLED").length;
                return (
                  <tr key={n.id} className={isOverdue ? "bg-bad-600/5" : undefined}>
                    <td className="whitespace-nowrap"><Link className="link font-medium" href={`/ncr/${n.id}`}>{n.code}</Link> <DemoTag show={n.isDemo} /></td>
                    <td className="whitespace-nowrap">{n.project.code}{n.unit ? ` / ${n.unit.ref}` : ""}</td>
                    <td className="whitespace-nowrap">{fmtDate(n.raisedAt)}</td>
                    <td>{n.defectCategory}</td>
                    <td className="max-w-xs"><span className="line-clamp-2">{n.description}</span></td>
                    <td><Badge value={n.priority} /></td>
                    <td className="whitespace-nowrap">{n.ownerName ?? "—"}<div className={isOverdue ? "text-xs text-bad-400" : "text-xs text-ink-300"}>{fmtDate(n.targetDate)}{isOverdue ? " · overdue" : ""}</div></td>
                    <td className="tabular-nums">{days}</td>
                    <td className="whitespace-nowrap text-xs">{live ? `${done}/${live} verified` : "—"}</td>
                    <td><Badge value={n.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
