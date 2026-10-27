import "server-only";
import PDFDocument from "pdfkit";
import { reportImage } from "../images";
import { storage } from "../storage";
import { REPORT_TYPES, SECTIONS, type ReportData } from "./data";

const C = {
  navy: "#0b1118",
  navy2: "#16212d",
  gold: "#c39a45",
  text: "#1d2733",
  muted: "#5b6b7c",
  line: "#d5dce4",
  zebra: "#f3f6f9",
  ok: "#14937a",
  warn: "#c98515",
  bad: "#b9353a",
};

/** The standard PDF fonts only cover WinAnsi; map anything else to ASCII. */
function t(v: unknown): string {
  if (v == null || v === "") return "—";
  const s = v instanceof Date ? fmtDate(v) : String(v);
  return s
    .replace(/→/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff—–…•÷×]/g, "?");
}
const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");
const fmtDateTime = (d: Date | null | undefined) => (d ? `${d.toISOString().slice(0, 16).replace("T", " ")} UTC` : "—");
const human = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—");


interface Col {
  header: string;
  width: number;
}

export interface RenderMeta {
  reportCode: string;
  revision: number;
  generatedBy: string;
}

export async function renderReportPdf(data: ReportData, meta: RenderMeta): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 64, bottom: 60, left: 48, right: 48 },
    bufferPages: true,
    info: {
      Title: `${REPORT_TYPES[data.params.type]} — ${data.project.code}`,
      Author: data.branding.companyName,
      Subject: "Quality report",
      Creator: "ASGARD Quality Command Centre",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const L = doc.page.margins.left;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };

  let sectionNo = 0;
  const heading = (title: string) => {
    ensure(60);
    sectionNo++;
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(L, y, 4, 18).fill(C.gold);
    doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(13).text(`${sectionNo}. ${t(title)}`, L + 12, y + 2, { width: W - 12 });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9).fillColor(C.text);
  };
  const para = (s: string, opts: { color?: string; bold?: boolean; size?: number } = {}) => {
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size ?? 9).fillColor(opts.color ?? C.text).text(t(s), L, doc.y, { width: W });
    doc.font("Helvetica").fillColor(C.text);
  };
  const empty = (s: string) => {
    para(s, { color: C.muted });
    doc.moveDown(0.3);
  };

  const table = (cols: Col[], rows: string[][], opts: { stateCol?: number } = {}) => {
    const total = cols.reduce((s, c) => s + c.width, 0);
    const widths = cols.map((c) => (c.width / total) * W);
    const pad = 4;
    const drawHeader = () => {
      doc.font("Helvetica-Bold").fontSize(7.5);
      const h = Math.max(...cols.map((c, i) => doc.heightOfString(t(c.header).toUpperCase(), { width: widths[i] - pad * 2 }))) + 10;
      ensure(h + 16);
      const y = doc.y;
      doc.rect(L, y, W, h).fill(C.navy2);
      let x = L;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
      cols.forEach((c, i) => {
        doc.text(t(c.header).toUpperCase(), x + pad, y + 5, { width: widths[i] - pad * 2 });
        x += widths[i];
      });
      doc.y = y + h;
    };
    drawHeader();
    doc.font("Helvetica").fontSize(8);
    rows.forEach((row, r) => {
      const heights = row.map((cell, i) => doc.heightOfString(t(cell), { width: widths[i] - pad * 2 }));
      const h = Math.max(...heights, 8) + pad * 2;
      if (doc.y + h > bottom()) {
        doc.addPage();
        drawHeader();
        doc.font("Helvetica").fontSize(8);
      }
      const y = doc.y;
      if (r % 2 === 1) doc.rect(L, y, W, h).fill(C.zebra);
      let x = L;
      row.forEach((cell, i) => {
        let color = C.text;
        if (opts.stateCol === i) {
          const v = cell.toUpperCase();
          color = /FAIL|REJECT|OVERDUE|CRITICAL|HIGH|QUARANTIN|MISSING|BLOCK/.test(v) ? C.bad : /PASS|ACCEPT|VERIFIED|CLOSED|RELEASED|APPROVED/.test(v) ? C.ok : /PENDING|HOLD|OPEN|AWAIT|UNVERIFIED|PROGRESS|MEDIUM/.test(v) ? C.warn : C.text;
        }
        doc.fillColor(color).text(t(cell), x + pad, y + pad, { width: widths[i] - pad * 2 });
        x += widths[i];
      });
      doc.moveTo(L, y + h).lineTo(L + W, y + h).lineWidth(0.4).strokeColor(C.line).stroke();
      doc.y = y + h;
    });
    doc.fillColor(C.text);
    doc.moveDown(0.6);
  };

  const keyValues = (pairs: [string, unknown][]) => {
    const colW = W / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      ensure(28);
      const y = doc.y;
      let maxH = 0;
      for (let j = 0; j < 2 && i + j < pairs.length; j++) {
        const [k, v] = pairs[i + j];
        const x = L + j * colW;
        doc.font("Helvetica").fontSize(7).fillColor(C.muted).text(t(k).toUpperCase(), x, y, { width: colW - 10 });
        doc.font("Helvetica-Bold").fontSize(9).fillColor(C.text).text(t(v), x, doc.y + 1, { width: colW - 10 });
        maxH = Math.max(maxH, doc.y - y);
      }
      doc.y = y + maxH + 6;
    }
    doc.font("Helvetica");
  };

  // ── Cover ──
  const p = data.project;
  doc.rect(0, 0, doc.page.width, 250).fill(C.navy);
  doc.rect(0, 250, doc.page.width, 4).fill(C.gold);
  // Simple chevron mark echoing the ASGARD logo.
  doc.save().lineWidth(3).strokeColor(C.gold).moveTo(L, 110).lineTo(L + 22, 70).lineTo(L + 44, 110).stroke().restore();
  doc.save().lineWidth(2).strokeColor(C.gold).moveTo(L + 12, 110).lineTo(L + 22, 90).lineTo(L + 32, 110).stroke().restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22).text("ASGARD", L + 58, 74, { characterSpacing: 4 });
  doc.fillColor(C.gold).font("Helvetica").fontSize(8.5).text(t(data.branding.companyName).toUpperCase(), L + 58, 100, { characterSpacing: 1.5 });
  doc.fillColor("#c9d3de").fontSize(10).text(t(data.branding.departmentName), L, 150);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text(t(REPORT_TYPES[data.params.type]), L, 168, { width: W });
  doc.fillColor(C.gold).font("Helvetica").fontSize(12).text(`${t(p.code)} — ${t(p.name)}${data.unit ? ` — ${t(data.unit.ref)}` : ""}`, L, doc.y + 4, { width: W });

  doc.y = 285;
  keyValues([
    ["Report reference", `${meta.reportCode}`],
    ["Report revision", `Rev ${meta.revision}`],
    ["Project", `${p.code} ${p.name}`],
    ["Scope of report", data.unit ? `${human(data.unit.type)} ${data.unit.ref}` : "Whole project"],
    ["Customer reference", p.customerRef ?? "Not recorded"],
    ["Project status", human(p.status)],
    ["Reporting period", data.params.from || data.params.to ? `${fmtDate(data.params.from)} to ${fmtDate(data.params.to)}` : "Project start to data cut-off"],
    ["Data cut-off", fmtDateTime(data.cutoff)],
    ["Generated", `${fmtDateTime(new Date())} by ${meta.generatedBy}`],
    ["Release status", data.activeRelease ? `${human(data.activeRelease.status)} — ${data.activeRelease.code}, ${data.activeRelease.releasedByName}, ${fmtDate(data.activeRelease.releasedAt)}` : "Not released"],
  ]);

  doc.moveDown(0.8);
  const boxY = doc.y;
  doc.rect(L, boxY, W, 58).lineWidth(1).strokeColor(C.warn).stroke();
  doc.fillColor(C.warn).font("Helvetica-Bold").fontSize(9).text("REPORT STATUS: DRAFT — NOT APPROVED", L + 10, boxY + 9, { width: W - 20 });
  doc.fillColor(C.text).font("Helvetica").fontSize(8).text(
    "This report is compiled automatically from records held in the ASGARD Quality Command Centre at the data cut-off above. It is not approved, certified or a declaration of compliance until the approval block at the end is signed by an authorised person. Missing information is listed in the Outstanding items section rather than assumed.",
    L + 10,
    doc.y + 3,
    { width: W - 20 },
  );
  doc.y = boxY + 70;
  if (data.isDemo) {
    para("This project is DEMO DATA. Every record in this report is synthetic and must not be used as a quality record.", { color: C.bad, bold: true });
  }

  const sections = SECTIONS[data.params.type];
  doc.addPage();

  // ── Summary ──
  if (sections.includes("summary")) {
    heading("Executive quality summary");
    keyValues([
      ["Project scope", p.scope ?? p.description ?? "Not recorded"],
      ["Project manager", p.projectManager ?? "Not recorded"],
      ["Start / target completion", `${fmtDate(p.startDate)} / ${fmtDate(p.targetDate)}`],
      ["Applicable requirements", p.requirements ?? "Not recorded"],
      ["Drawings / revisions", p.drawingRefs ?? "Not recorded"],
      ["Modules / frames", `${p.units.length}`],
    ]);
    const s = data.inspectionStats;
    const pct = (v: number | null) => (v == null ? "n/a (no decided inspections)" : `${(v * 100).toFixed(1)}%`);
    table(
      [
        { header: "Measure", width: 3 },
        { header: "Value", width: 2 },
        { header: "Basis", width: 4 },
      ],
      [
        ["Inspections recorded", String(s.total), "Excludes cancelled records"],
        ["Inspections completed", String(s.completed), "Result recorded and submitted"],
        ["Inspection pass rate", pct(s.passRate), `${s.passRateBasis.numerator} pass of ${s.passRateBasis.denominator} decided (N/A excluded)`],
        ["First-pass yield", pct(s.firstPassYield), `${s.fpyBasis.numerator} of ${s.fpyBasis.denominator} first-attempt inspections passed`],
        ["Welds recorded / accepted", `${data.welds.length} / ${data.welds.filter((w) => w.status === "ACCEPTED").length}`, "Accepted = visual pass and required NDT accepted"],
        ["Confirmed weld defects", String(data.defectPareto.reduce((a, b) => a + b.count, 0)), "Inspector-confirmed only"],
        ["NCRs raised / open", `${data.ncrs.length} / ${data.ncrs.filter((n) => !["CLOSED", "CANCELLED"].includes(n.status)).length}`, ""],
        ["Repairs / rework records", String(data.repairs.length), ""],
        ["Material records", `${data.materials.length} (${data.materials.filter((m) => m.status === "ACCEPTED").length} accepted)`, ""],
        ["Photographic evidence items", String(data.photos.length), "Excludes withdrawn and rejected photos"],
        ["Release gate checks failing", String(data.checks.filter((c) => c.state === "FAIL").length), "See Final inspection and release"],
      ],
    );
  }

  // ── Timeline ──
  if (sections.includes("timeline")) {
    heading("Project timeline");
    const events: [Date, boolean, string, string][] = [];
    if (p.startDate) events.push([p.startDate, false, "Project commenced", ""]);
    for (const m of data.materials) events.push([m.inspectedAt ?? m.createdAt, !m.inspectedAt, `Material ${m.code} received${m.heatNumber ? `, heat ${m.heatNumber}` : ""}`, human(m.status)]);
    for (const i of data.inspections) events.push([i.inspectedAt ?? i.plannedDate ?? i.createdAt, !i.inspectedAt, `${i.code} ${human(i.type)}${i.unit ? ` — ${i.unit.ref}` : ""}`, human(i.result)]);
    for (const w of data.welds) if (w.inspectedAt) events.push([w.inspectedAt, false, `Weld ${w.weldRef} visual inspection`, human(w.visualResult)]);
    for (const n of data.ncrs) {
      events.push([n.raisedAt, false, `${n.code} raised — ${n.defectCategory}`, human(n.priority)]);
      if (n.closedAt) events.push([n.closedAt, false, `${n.code} closed`, "Closed"]);
    }
    for (const r of data.repairs) events.push([r.performedAt ?? r.createdAt, !r.performedAt, `${r.code} repair${r.weld ? ` — weld ${r.weld.weldRef}` : ""}`, `Re-inspection ${human(r.reinspectionResult)}`]);
    for (const rel of data.releases) events.push([rel.releasedAt, false, `${rel.code} ${human(rel.status)}${rel.unit ? ` — ${rel.unit.ref}` : ""}`, rel.revokedAt ? "Revoked" : "Active"]);
    events.sort((a, b) => a[0].getTime() - b[0].getTime());
    if (!events.length) empty("No dated records yet.");
    else table([{ header: "Date", width: 2 }, { header: "Event", width: 6 }, { header: "Status", width: 2 }], events.map(([d, approx, e, s]) => [`${fmtDate(d)}${approx ? " *" : ""}`, e, s]), { stateCol: 2 });
    if (events.some((e) => e[1])) para("* Record date shown because the event date was not recorded.", { color: C.muted, size: 7.5 });
  }

  // ── Inspection & Test Plan ──
  if (sections.includes("itp")) {
    heading("Inspection & Test Plan status");
    if (!data.itpPlans.length) empty("No ITP has been applied to this project in the system.");
    for (const plan of data.itpPlans) {
      const closed = plan.points.filter((x) => x.status !== "OPEN").length;
      para(`${plan.discipline} — ${plan.documentRef ?? "ITP"}: ${closed} of ${plan.points.length} control points closed.`, { bold: true });
      const shown = data.params.type === "EXECUTIVE" ? plan.points.filter((x) => x.pointType === "H") : plan.points.filter((x) => x.pointType === "H" || x.pointType === "W" || x.status !== "OPEN");
      if (!shown.length) {
        empty("No hold or witness points, and no control points signed yet.");
        continue;
      }
      table(
        [{ header: "Item", width: 0.7 }, { header: "Activity", width: 3.2 }, { header: "AMM / Client", width: 1.1 }, { header: "Sign-off document", width: 1.8 }, { header: "Status", width: 1.2 }, { header: "Signed / evidence", width: 2.6 }],
        shown.map((x) => [
          x.itemNo,
          `${x.section ? `[${x.section}] ` : ""}${x.activity}`,
          `${x.pointType ?? "—"} / ${x.clientPoint ?? "—"}`,
          x.signoffDocument ?? "—",
          x.status === "SIGNED" ? "Signed" : x.status === "NOT_APPLICABLE" ? "N/A" : x.pointType === "H" ? "OPEN — HOLD" : "Open",
          x.signedByName ? `${x.signedByName} ${fmtDate(x.signedAt)} — ${x.evidence ?? ""}` : "—",
        ]),
        { stateCol: 4 },
      );
    }
  }

  // ── Materials ──
  if (sections.includes("materials")) {
    heading("Incoming materials and traceability");
    if (!data.materials.length) empty("No material records are linked to this project.");
    else
      table(
        [{ header: "Material", width: 1.4 }, { header: "Description / grade", width: 3 }, { header: "Heat no.", width: 1.5 }, { header: "Certificate", width: 2 }, { header: "Receiving", width: 1.2 }, { header: "Status", width: 1.5 }],
        data.materials.map((m) => [m.code, `${m.description}${m.grade ? ` — ${m.grade}` : " — grade not recorded"}`, m.heatNumber ?? "MISSING", `${m.certificateRef ?? "—"} (${human(m.certStatus)})`, human(m.receivingResult), `${human(m.status)}${m.identificationMismatch ? " — ID MISMATCH" : ""}`]),
        { stateCol: 5 },
      );
  }

  // ── Fabrication & dimensional ──
  const fab = data.inspections.filter((i) => ["FABRICATION", "DIMENSIONAL", "INCOMING_MATERIAL", "INTERMEDIATE"].includes(i.type));
  if (sections.includes("fabrication")) {
    heading("Fabrication and dimensional inspection");
    if (!fab.length) empty("No fabrication or dimensional inspections in this period.");
    for (const i of fab) {
      ensure(60);
      para(`${i.code} — ${human(i.type)}${i.operation ? ` / ${i.operation}` : ""}${i.unit ? ` — ${i.unit.ref}` : ""} — ${fmtDate(i.inspectedAt)} — ${i.inspectorName ?? "inspector not recorded"} — Result: ${human(i.result)} (${human(i.status)})`, { bold: true });
      if (i.criteriaRef) para(`Criteria reference: ${i.criteriaRef}`, { color: C.muted });
      if (i.items.length)
        table(
          [{ header: "Check", width: 3 }, { header: "Requirement", width: 2.5 }, { header: "Tolerance", width: 1.2 }, { header: "Actual", width: 1.3 }, { header: "Result", width: 1 }],
          i.items.map((it) => [it.description, it.requirement ?? "Requires configuration", it.tolerance ?? "—", `${it.actual ?? "—"}${it.unit ? ` ${it.unit}` : ""}`, human(it.result)]),
          { stateCol: 4 },
        );
      else doc.moveDown(0.4);
    }
  }

  // ── All inspections register ──
  if (sections.includes("inspections")) {
    heading("Inspection register");
    if (!data.inspections.length) empty("No inspections in this period.");
    else
      table(
        [{ header: "Ref", width: 1.4 }, { header: "Type", width: 1.6 }, { header: "Frame", width: 1 }, { header: "Date", width: 1.2 }, { header: "Inspector", width: 1.6 }, { header: "Result", width: 1 }, { header: "Record status", width: 1.4 }, { header: "Reviewer", width: 1.6 }],
        data.inspections.map((i) => [`${i.code}${i.reinspectionOfId ? " (re-insp.)" : ""}`, human(i.type), i.unit?.ref ?? "—", fmtDate(i.inspectedAt), i.inspectorName ?? "—", human(i.result), human(i.status), i.reviewerName ?? "Not reviewed"]),
        { stateCol: 5 },
      );
  }

  // ── Welding ──
  if (sections.includes("welding")) {
    heading("Welding inspection summary");
    if (!data.welds.length) empty("No welds recorded.");
    else {
      table(
        [{ header: "Weld", width: 1.2 }, { header: "Frame", width: 1 }, { header: "WPS", width: 1.2 }, { header: "Welder", width: 1.2 }, { header: "Visual", width: 1 }, { header: "Confirmed defects", width: 2.2 }, { header: "Repairs", width: 0.9 }, { header: "Status", width: 1.6 }],
        data.welds.map((w) => [w.weldRef, w.unit?.ref ?? "—", w.wpsRef ?? "Not recorded", w.welderId ?? "—", human(w.visualResult), w.defects.filter((d) => d.confirmed).map((d) => d.category).join(", ") || "None", String(w.repairs.length), human(w.status)]),
        { stateCol: 7 },
      );
      if (data.defectPareto.length) {
        para("Confirmed defects by category", { bold: true });
        table([{ header: "Category", width: 4 }, { header: "Count", width: 1 }], data.defectPareto.map((d) => [d.key, String(d.count)]));
      }
      const unconfirmed = data.welds.flatMap((w) => w.defects.filter((d) => !d.confirmed).map((d) => `${w.weldRef}: ${d.category}`));
      if (unconfirmed.length) para(`Unconfirmed possible defects awaiting inspector review (not counted above): ${unconfirmed.join("; ")}`, { color: C.warn });
    }
  }

  if (sections.includes("ndt")) {
    heading("NDT and test records");
    if (!data.ndt.length) empty("No NDT or test records.");
    else
      table(
        [{ header: "Ref", width: 1.1 }, { header: "Method", width: 1.8 }, { header: "Weld / item", width: 1.5 }, { header: "Procedure", width: 1.5 }, { header: "Report no.", width: 1.4 }, { header: "Contractor", width: 1.6 }, { header: "Result", width: 1.1 }],
        data.ndt.map((n) => [n.code, n.method, n.weld?.weldRef ?? n.componentRef ?? n.unit?.ref ?? "—", n.procedureRef ?? "—", n.reportNo ?? "Awaiting", n.contractor ?? "—", human(n.result)]),
        { stateCol: 6 },
      );
  }

  if (sections.includes("coating")) {
    heading("Painting and coating");
    if (!data.coatings.length) empty("No coating inspection records.");
    else
      table(
        [{ header: "Ref", width: 1 }, { header: "Frame", width: 1 }, { header: "Surface prep", width: 2 }, { header: "Product / batch", width: 2 }, { header: "DFT readings (as recorded)", width: 2.2 }, { header: "Spec ref", width: 1.4 }, { header: "Result", width: 1 }],
        data.coatings.map((c) => [c.code, c.unit?.ref ?? "—", c.surfacePrep ?? "—", `${c.product ?? "—"} / ${c.batchRef ?? "—"}`, c.dftReadings ?? "—", c.specRef ?? "—", human(c.result)]),
        { stateCol: 6 },
      );
  }

  if (sections.includes("ncrs")) {
    heading("Non-conformance register and corrective actions");
    if (!data.ncrs.length) empty("No NCRs raised.");
    else {
      table(
        [{ header: "NCR", width: 1.1 }, { header: "Raised", width: 1.1 }, { header: "Frame", width: 0.9 }, { header: "Category", width: 1.6 }, { header: "Priority", width: 0.9 }, { header: "Description", width: 3 }, { header: "Status", width: 1.4 }],
        data.ncrs.map((n) => [n.code, fmtDate(n.raisedAt), n.unit?.ref ?? "—", n.defectCategory, human(n.priority), n.description, human(n.status)]),
        { stateCol: 6 },
      );
      for (const n of data.ncrs) {
        ensure(80);
        para(`${n.code} — root cause, correction and verification`, { bold: true });
        keyValues([
          ["Containment", n.containment ?? "Not recorded"],
          ["Root cause (" + (n.rootCauseMethod ?? "method not recorded") + ")", n.rootCause ? `${n.rootCauseCategory ? `[${n.rootCauseCategory}] ` : ""}${n.rootCause}` : "Not recorded"],
          ["Disposition / repair method", [n.disposition, n.repairMethod].filter(Boolean).join(" — ") || "Not recorded"],
          ["Verification", n.verificationNotes ? `${n.verificationNotes} (re-inspection ${human(n.reinspectionResult)})` : "Not verified"],
          ["Closed", n.closedAt ? `${fmtDate(n.closedAt)} by ${n.closedByName}` : "Open"],
          ["Owner / target", `${n.ownerName ?? "—"} / ${fmtDate(n.targetDate)}`],
          ["Severity / department", `${n.severity ? human(n.severity) : "Not recorded"} / ${n.department ?? "—"}`],
          ["Stage of detection / detected by", `${n.stageOfDetection ?? "—"} / ${n.detectedBy ?? "—"}`],
          ["Contributing factors", n.contributingFactors ?? "Not recorded"],
          [
            "Impact (structural · safety · schedule · customer · cost · QMS)",
            [n.impactStructural, n.impactSafety, n.impactSchedule, n.impactCustomer, n.impactCost, n.impactQms].some(Boolean)
              ? [n.impactStructural, n.impactSafety, n.impactSchedule, n.impactCustomer, n.impactCost, n.impactQms].map((v) => (v ? human(v) : "—")).join(" · ")
              : "Not assessed",
          ],
          [
            "Effectiveness check",
            n.effectivenessStatus === "PENDING" ? `Pending — due ${fmtDate(n.effectivenessDueAt)}` : n.effectivenessStatus ? `${human(n.effectivenessStatus)} — ${n.effectivenessByName ?? ""} ${fmtDate(n.effectivenessAt)}: ${n.effectivenessNotes ?? ""}` : "Not applicable (NCR not closed)",
          ],
        ]);
        if (n.actions.length) table([{ header: "Action", width: 1 }, { header: "Type", width: 1.2 }, { header: "Description", width: 4 }, { header: "Owner", width: 1.4 }, { header: "Due", width: 1.1 }, { header: "Status", width: 1.2 }], n.actions.map((a) => [a.code, human(a.type), a.description, a.ownerName ?? "—", fmtDate(a.dueDate), human(a.status)]), { stateCol: 5 });
      }
    }
  }

  if (sections.includes("repairs")) {
    heading("Repairs, rework and re-inspection");
    if (!data.repairs.length) empty("No repair or rework records.");
    else {
      table(
        [{ header: "Ref", width: 1 }, { header: "Linked", width: 1.6 }, { header: "Description / method", width: 3.5 }, { header: "Performed", width: 1.5 }, { header: "Hours / cost", width: 1.4 }, { header: "Re-inspection", width: 1.6 }],
        data.repairs.map((r) => [
          r.code,
          [r.ncr?.code, r.weld ? `Weld ${r.weld.weldRef}` : null, r.unit?.ref].filter(Boolean).join(" · ") || "—",
          `${r.description}${r.method ? ` — ${r.method}` : ""}`,
          `${fmtDate(r.performedAt)}${r.performedBy ? ` ${r.performedBy}` : ""}`,
          `${r.hours != null ? `${r.hours} h` : "—"} / ${r.cost != null ? `${r.cost}${r.costIsEstimate ? " (estimate)" : ""}` : "not recorded"}`,
          `${human(r.reinspectionResult)}${r.reinspectedBy ? ` — ${r.reinspectedBy}` : ""}`,
        ]),
        { stateCol: 5 },
      );
    }
  }

  // ── Photographs ──
  const photoSection = sections.find((s) => s.startsWith("photos"));
  if (photoSection) {
    const filter = photoSection.split(":")[1];
    const photos = data.photos.filter((ph) => (filter === "weld" ? ph.weldId || ph.weldRef || /weld/i.test(ph.category) : filter === "material" ? ph.materialId || ph.heatNumber || /material|heat/i.test(ph.category) : filter === "ncr" ? ph.ncrId || ph.repairId || ph.reworkPhase : true));
    heading("Photographic evidence");
    if (!photos.length) empty("No photographs in this scope.");
    else para(`${photos.length} photograph(s), in capture order. Capture time comes from the image's own metadata; where none exists the upload time is shown and marked.`, { color: C.muted });
    doc.moveDown(0.4);
    const colW = (W - 16) / 2;
    const imgH = 170;
    let col = 0;
    let rowY = doc.y;
    let rowH = 0;
    for (const ph of photos) {
      if (col === 0) {
        if (doc.y + imgH + 80 > bottom()) doc.addPage();
        rowY = doc.y;
        rowH = 0;
      }
      const x = L + col * (colW + 16);
      let img: Buffer | null = null;
      try {
        img = await reportImage(await storage().get(ph.storageKey));
      } catch {
        img = null;
      }
      doc.rect(x, rowY, colW, imgH).fill("#eef1f4");
      if (img) doc.image(img, x, rowY, { fit: [colW, imgH], align: "center", valign: "center" });
      else doc.fillColor(C.muted).fontSize(8).text("Preview not available in PDF (original file stored, e.g. HEIC).", x + 10, rowY + imgH / 2 - 6, { width: colW - 20, align: "center" });
      const links = [ph.inspection && `Inspection ${ph.inspection.code}`, ph.ncr && ph.ncr.code, ph.weld ? `Weld ${ph.weld.weldRef}` : ph.weldRef && `Weld ${ph.weldRef}`, ph.material ? `Material ${ph.material.code}` : ph.heatNumber && `Heat ${ph.heatNumber}`, ph.repair && `${ph.repair.code}${ph.reworkPhase ? ` (${ph.reworkPhase.toLowerCase()})` : ""}`].filter(Boolean).join(" · ");
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(8).text(`${ph.code} · ${t(ph.category)}${ph.unit ? ` · ${ph.unit.ref}` : ""}`, x, rowY + imgH + 4, { width: colW });
      doc.font("Helvetica").fontSize(7.5).fillColor(C.text).text(ph.takenAt ? `Taken ${fmtDateTime(ph.takenAt)}` : `Uploaded ${fmtDateTime(ph.uploadedAt)} (no capture date in file)`, x, doc.y + 1, { width: colW });
      if (ph.caption) doc.text(t(ph.caption), x, doc.y + 1, { width: colW });
      if (ph.observedCondition) doc.fillColor(C.muted).text(`Observed: ${t(ph.observedCondition)}`, x, doc.y + 1, { width: colW });
      if (links) doc.fillColor(C.muted).text(t(links), x, doc.y + 1, { width: colW });
      doc.fillColor(ph.reviewStatus === "APPROVED" ? C.ok : C.warn).text(`Evidence review: ${human(ph.reviewStatus)}`, x, doc.y + 1, { width: colW });
      rowH = Math.max(rowH, doc.y - rowY);
      col++;
      if (col === 2) {
        col = 0;
        doc.y = rowY + rowH + 14;
      } else doc.y = rowY;
    }
    if (col === 1) doc.y = rowY + rowH + 14;
    doc.x = L;

    // Before/after pairs for rework.
    const pairs = data.repairs
      .map((r) => ({ r, before: data.photos.filter((ph) => ph.repairId === r.id && ph.reworkPhase === "BEFORE"), after: data.photos.filter((ph) => ph.repairId === r.id && ph.reworkPhase === "AFTER") }))
      .filter((x) => x.before.length || x.after.length);
    if (pairs.length) {
      heading("Before-and-after repair evidence");
      for (const { r, before, after } of pairs) {
        ensure(imgH + 50);
        para(`${r.code} — ${r.description}`, { bold: true });
        const y = doc.y + 4;
        for (const [i, set] of [before, after].entries()) {
          const x = L + i * (colW + 16);
          doc.fillColor(C.muted).fontSize(7.5).text(i === 0 ? "BEFORE" : "AFTER", x, y, { width: colW });
          const ph = set[0];
          doc.rect(x, y + 12, colW, imgH - 20).fill("#eef1f4");
          if (ph) {
            const img = await reportImage(await storage().get(ph.storageKey)).catch(() => null);
            if (img) doc.image(img, x, y + 12, { fit: [colW, imgH - 20], align: "center", valign: "center" });
            doc.fillColor(C.text).fontSize(7.5).text(`${ph.code} ${ph.takenAt ? fmtDateTime(ph.takenAt) : "(no capture date)"}`, x, y + imgH - 4, { width: colW });
          } else doc.fillColor(C.bad).fontSize(8).text("No photograph recorded", x + 10, y + imgH / 2, { width: colW - 20, align: "center" });
        }
        doc.y = y + imgH + 14;
        doc.x = L;
        para(`Re-inspection: ${human(r.reinspectionResult)}${r.reinspectedBy ? ` by ${r.reinspectedBy} on ${fmtDate(r.reinspectedAt)}` : ""}`, { color: r.reinspectionResult === "PASS" ? C.ok : C.warn });
      }
    }
  }

  // ── Outstanding ──
  if (sections.includes("outstanding")) {
    heading("Outstanding items, exclusions and missing evidence");
    if (!data.missing.length) para("No outstanding items were identified from the records.", { color: C.ok });
    else for (const m of data.missing) {
      ensure(16);
      doc.fillColor(C.bad).fontSize(9).text("•", L, doc.y, { continued: true }).fillColor(C.text).text(`  ${t(m)}`, { width: W - 10 });
    }
    doc.moveDown(0.4);
    para("This report covers only records held in the Quality Command Centre. Records held elsewhere (paper travellers, supplier portals, external QMS) are not included unless entered or linked here.", { color: C.muted, size: 8 });
  }

  if (sections.includes("release")) {
    heading("Final inspection and release status");
    table([{ header: "Release check", width: 4 }, { header: "State", width: 1.3 }, { header: "Detail", width: 4 }], data.checks.map((c) => [c.label, c.state === "NOT_REQUIRED" ? "Not required" : c.state, `${c.detail}${c.items?.length ? ` ${c.items.slice(0, 6).join("; ")}${c.items.length > 6 ? "; …" : ""}` : ""}`]), { stateCol: 1 });
    if (data.activeRelease) {
      para(`Release record ${data.activeRelease.code}: ${human(data.activeRelease.status)} by ${data.activeRelease.releasedByName} on ${fmtDateTime(data.activeRelease.releasedAt)}.`, { bold: true });
      if (data.activeRelease.concessionRef) para(`Concession ${data.activeRelease.concessionRef}: ${data.activeRelease.concessionReason ?? ""}`, { color: C.warn });
    } else para("No release has been authorised for this scope.", { color: C.warn, bold: true });
  }

  if (sections.includes("documents")) {
    heading("Document index");
    if (!data.documents.length) empty("No controlled documents linked.");
    else
      table(
        [{ header: "Document no.", width: 1.6 }, { header: "Title", width: 3.4 }, { header: "Type", width: 1.6 }, { header: "Current approved rev", width: 1.6 }, { header: "Status", width: 1.3 }],
        data.documents.map((d) => {
          const approved = d.revisions.find((r) => r.status === "APPROVED");
          return [d.docNo, d.title, d.docType, approved ? `${approved.revision} (${fmtDate(approved.approvedAt)})` : "None approved", human(d.status)];
        }),
        { stateCol: 4 },
      );
  }

  // ── Approval block (always blank — signatures are applied outside the system) ──
  heading("Review and approval");
  para("To be completed by authorised personnel. The system does not pre-fill approval.", { color: C.muted });
  doc.moveDown(0.5);
  for (const role of ["Prepared by (QC)", "Reviewed by (Quality Manager)", "Approved by (authorised signatory)"]) {
    ensure(46);
    const y = doc.y;
    doc.fontSize(8).fillColor(C.muted).text(role.toUpperCase(), L, y);
    for (const [i, lbl] of ["Name", "Signature", "Date"].entries()) {
      const x = L + i * (W / 3);
      doc.moveTo(x, y + 32).lineTo(x + W / 3 - 14, y + 32).lineWidth(0.6).strokeColor(C.line).stroke();
      doc.fontSize(7).fillColor(C.muted).text(lbl, x, y + 35);
    }
    doc.y = y + 50;
  }

  // ── Running header / footer on every page ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    if (i > 0) {
      doc.rect(0, 0, doc.page.width, 36).fill(C.navy);
      doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(8).text("ASGARD", L, 14, { characterSpacing: 2, lineBreak: false });
      doc.fillColor("#c9d3de").font("Helvetica").fontSize(8).text(`${t(REPORT_TYPES[data.params.type])} — ${t(p.code)}${data.unit ? ` / ${t(data.unit.ref)}` : ""}`, L + 70, 14, { width: W - 70, align: "right", lineBreak: false });
    }
    doc.fillColor(C.muted).font("Helvetica").fontSize(7).text(
      `${meta.reportCode} Rev ${meta.revision} · DRAFT — NOT APPROVED · Data cut-off ${fmtDateTime(data.cutoff)} · Page ${i + 1} of ${range.count}`,
      L,
      doc.page.height - 40,
      { width: W, align: "center", lineBreak: false },
    );
    doc.text(t(data.branding.reportFooter), L, doc.page.height - 30, { width: W, align: "center", lineBreak: false });
    if (data.isDemo) {
      doc.save().rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] }).fillColor(C.bad).opacity(0.08).font("Helvetica-Bold").fontSize(90).text("DEMO DATA", 0, doc.page.height / 2 - 45, { width: doc.page.width, align: "center", lineBreak: false }).restore();
      doc.opacity(1);
    }
    doc.page.margins.bottom = oldBottom;
  }

  doc.end();
  return done;
}
