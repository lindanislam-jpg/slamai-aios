import { Camera, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { PhotoThumbs } from "@/components/inspections/PhotoThumbs";
import { Badge, Card, DemoTag, fmtDateTime, History, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { projectOptions } from "@/lib/options";
import { acceptanceGaps, getMaterial, materialFlags } from "@/lib/services/materials";
import { dispositionAction, updateMaterialAction, verifyCertAction } from "../actions";
import { materialFields } from "../fields";

export const metadata = { title: "Material" };

export default async function MaterialDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const [{ material: m, history }, projects] = await Promise.all([getMaterial(actor, id), projectOptions()]);
  const p = actor.permissions;
  const gaps = acceptanceGaps(m);
  const flags = materialFlags(m);
  const q = (o: Record<string, string | null | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${m.code} · ${m.description}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {m.project ? <Link className="link" href={`/projects/${m.project.id}`}>{m.project.code} {m.project.name}</Link> : <span>General stock</span>}
            <Badge value={m.status} />
            <Badge value={m.certStatus} label={`Certificate: ${m.certStatus.toLowerCase().replace(/_/g, " ")}`} />
            <DemoTag show={m.isDemo} />
          </span>
        }
        actions={
          <>
            {p.has("ncr.raise") && m.projectId && <Link className="btn-secondary" href={`/ncr/new?${q({ projectId: m.projectId, materialId: m.id })}`}><TriangleAlert className="h-4 w-4" /> Raise NCR</Link>}
            {p.has("photo.upload") && m.projectId && <Link className="btn-secondary" href={`/photos?${q({ upload: "1", projectId: m.projectId, materialId: m.id })}`}><Camera className="h-4 w-4" /> Add photos</Link>}
          </>
        }
      />
      {flags.length > 0 && (
        <div className="rounded-lg border border-warn-600/50 bg-warn-600/10 px-4 py-2 text-sm text-warn-400">Traceability flags: {flags.join(" · ")}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card title="Traceability record">
            <KV cols={3} items={[
              ["Grade", m.grade ?? "Not recorded"], ["Heat / batch no.", m.heatNumber ?? "MISSING"], ["Certificate", m.certificateRef ?? "Not recorded"],
              ["Supplier", m.supplier], ["Purchase order", m.poRef], ["Delivery", m.deliveryRef],
              ["Component", m.componentRef], ["Quantity", m.quantity != null ? `${m.quantity} ${m.unit ?? ""}` : null], ["Location", m.location],
              ["Receiving inspection", m.receivingResult], ["Inspector", m.inspectorName], ["Inspected", fmtDateTime(m.inspectedAt)],
              ["ID matches documents", m.identificationMismatch ? "NO — mismatch recorded" : "Yes / not flagged"],
              ["Disposition", m.dispositionAt ? `${m.status.toLowerCase().replace(/_/g, " ")} · ${fmtDateTime(m.dispositionAt)}` : "None"],
              ["Disposition notes", m.dispositionNotes],
            ]} />
          </Card>

          {p.has("material.write") && (
            <Card title="Edit record">
              <p className="mb-3 rounded-md border border-warn-600/40 bg-warn-600/5 px-3 py-2 text-xs text-warn-400">
                Changing the heat number, certificate reference or grade resets certificate verification and returns an accepted material to Awaiting inspection.
              </p>
              <ActionForm action={updateMaterialAction.bind(null, m.id)} submit="Save changes">
                <Fields cols={3} fields={materialFields(projects, m)} />
              </ActionForm>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {p.has("material.disposition") && (
            <Card title="Certificate verification">
              <p className="mb-3 text-sm text-ink-300">Verify only after checking the certificate against the physical marking, grade and order. Status now: <Badge value={m.certStatus} /></p>
              {!m.certificateRef && !m.certificateDocId ? (
                <p className="text-sm text-warn-400">Record the certificate reference first.</p>
              ) : (
                <div className="space-y-3">
                  {m.certStatus !== "VERIFIED" && <ActionForm action={verifyCertAction.bind(null, m.id, true)} submit="Mark certificate verified" submitClass="btn-ok" confirm="Confirm you have checked this certificate against the material." />}
                  <ActionForm action={verifyCertAction.bind(null, m.id, false)} submit="Reject certificate" submitClass="btn-danger">
                    <Fields cols={1} fields={[{ name: "certNotes", label: "Reason for rejecting the certificate", type: "textarea" }]} />
                  </ActionForm>
                </div>
              )}
            </Card>
          )}

          {p.has("material.disposition") && (
            <Card title="Disposition">
              <div className="space-y-4">
                <div>
                  <div className="label">Accept</div>
                  {gaps.length ? (
                    <>
                      <ul className="mb-2 list-disc pl-5 text-sm text-warn-400">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
                      <button className="btn-ok" disabled title="Clear the gaps above first">Accept material</button>
                    </>
                  ) : m.status === "ACCEPTED" ? (
                    <p className="text-sm text-ok-400">Accepted.</p>
                  ) : (
                    <ActionForm action={dispositionAction.bind(null, m.id, "ACCEPTED")} submit="Accept material" submitClass="btn-ok" />
                  )}
                </div>
                <ActionForm action={dispositionAction.bind(null, m.id, "QUARANTINED")} submit="Quarantine" submitClass="btn-secondary">
                  <Fields cols={1} fields={[{ name: "quarantineNotes", label: "Reason for quarantine", type: "textarea", required: true }]} />
                </ActionForm>
                <ActionForm action={dispositionAction.bind(null, m.id, "REJECTED")} submit="Reject material" submitClass="btn-danger" confirm="Reject this material?">
                  <Fields cols={1} fields={[{ name: "rejectNotes", label: "Reason for rejection", type: "textarea", required: true }]} />
                </ActionForm>
                {m.status !== "AWAITING_INSPECTION" && <ActionForm action={dispositionAction.bind(null, m.id, "AWAITING_INSPECTION")} submit="Return to awaiting inspection" submitClass="btn-ghost" />}
              </div>
            </Card>
          )}

          <Card title="NCRs">
            {m.ncrs.length ? m.ncrs.map((n) => <div key={n.id} className="flex items-center gap-2 py-1 text-sm"><Link className="link" href={`/ncr/${n.id}`}>{n.code}</Link><Badge value={n.status} /></div>) : <p className="text-sm text-ink-300">None</p>}
          </Card>
          <Card title={`Photos (${m.photos.length})`}><PhotoThumbs photos={m.photos} /></Card>
          <Card title="History"><History events={history} /></Card>
        </div>
      </div>
    </div>
  );
}
