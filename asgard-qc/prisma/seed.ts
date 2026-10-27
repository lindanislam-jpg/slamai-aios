/**
 * Seed script.
 *
 *   npm run db:seed
 *
 * 1. Creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD /
 *    ADMIN_NAME (never hard-coded). Skipped if that user already exists.
 * 2. If SEED_DEMO_DATA=true, creates clearly labelled synthetic records
 *    (isDemo = true) so the dashboard, reports and workflows can be tried.
 *    Demo users have example.com addresses and fictional names; demo photos
 *    are generated placeholder images, not factory photographs.
 *
 * Demo data can be removed later from Settings → Data (or `npm run db:purge-demo`).
 * Runs through the same services the app uses, so it also exercises them.
 */
import { PrismaClient, type Role } from "@prisma/client";
import sharp from "sharp";
import { hashPassword } from "../src/lib/session";
import { permissionsFor, type Actor } from "../src/lib/permissions";
import { createProject, createUnit, updateProject } from "../src/lib/services/projects";
import { createInspection, reviewInspection, submitInspection, updateInspection } from "../src/lib/services/inspections";
import { addDefect, createWeld, recordVisual, recordWeldRepair } from "../src/lib/services/welding";
import { createMaterial, dispositionMaterial, verifyCertificate } from "../src/lib/services/materials";
import { addAction, closeNcr, moveNcr, raiseNcr, updateActionStatus, updateNcr } from "../src/lib/services/ncrs";
import { saveCoating, saveNdt } from "../src/lib/services/ndt-coating";
import { addFinding, saveAudit } from "../src/lib/services/audits";
import { addCalibration, addRevision, approveRevision, createDocument, createEquipment } from "../src/lib/services/documents";
import { uploadPhotos } from "../src/lib/services/photos";
import { runNotificationScan } from "../src/lib/services/notifications";

const db = new PrismaClient();
const DAY = 86_400_000;
const ago = (days: number, hour = 9) => {
  const d = new Date(Date.now() - days * DAY);
  d.setUTCHours(hour, 15, 0, 0);
  return d;
};

async function ensureUser(email: string, name: string, role: Role, password: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  return db.user.create({ data: { email, name, role, passwordHash: await hashPassword(password) } });
}

const actorOf = (u: { id: string; name: string; email: string; role: Role }): Actor => ({ ...u, permissions: permissionsFor(u.role) });

async function demoPhoto(label: string, hue: number, takenAt: Date | null) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,32%)"/><stop offset="1" stop-color="hsl(${hue + 30},30%,14%)"/></linearGradient></defs>
    <rect width="1200" height="900" fill="url(#g)"/>
    <g stroke="hsl(${hue},20%,55%)" stroke-width="18" fill="none" opacity="0.55"><path d="M120 760 L600 160 L1080 760"/><path d="M300 760 L600 400 L900 760"/><line x1="120" y1="760" x2="1080" y2="760"/></g>
    <text x="60" y="110" font-family="sans-serif" font-size="64" font-weight="700" fill="#e6c77f">DEMO PHOTO</text>
    <text x="60" y="180" font-family="sans-serif" font-size="40" fill="#ffffff">${label.replace(/&/g, "&amp;")}</text>
    <text x="60" y="850" font-family="sans-serif" font-size="28" fill="#c9d3de">Synthetic placeholder — not a factory photograph</text>
  </svg>`;
  let img = sharp(Buffer.from(svg)).jpeg({ quality: 82 });
  if (takenAt) {
    const s = takenAt.toISOString().slice(0, 19).replace("T", " ").replace(/-/g, ":");
    img = img.withExif({ IFD2: { DateTimeOriginal: s } });
  }
  return img.toBuffer();
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 chars) to create the first administrator.");
    process.exit(1);
  }
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  const admin = await ensureUser(email, process.env.ADMIN_NAME?.trim() || "Administrator", "ADMIN", password);
  console.log(`Administrator: ${admin.email}`);

  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("SEED_DEMO_DATA is not 'true' — no demo records created.");
    return;
  }
  if (await db.project.count({ where: { isDemo: true } })) {
    console.log("Demo data already present — skipping.");
    return;
  }
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  const started = new Date(Date.now() - 1000);

  // Fictional demo users — only created when a password for them is supplied.
  const users = demoPassword
    ? {
        qm: await ensureUser("demo.qm@example.com", "Demo Quality Manager", "QUALITY_MANAGER", demoPassword),
        qc: await ensureUser("demo.inspector@example.com", "Demo QC Inspector", "QC_INSPECTOR", demoPassword),
        weld: await ensureUser("demo.welding@example.com", "Demo Welding Inspector", "WELDING_INSPECTOR", demoPassword),
        mat: await ensureUser("demo.materials@example.com", "Demo Material Inspector", "MATERIAL_INSPECTOR", demoPassword),
        view: await ensureUser("demo.viewer@example.com", "Demo Production Viewer", "PRODUCTION_VIEWER", demoPassword),
        aud: await ensureUser("demo.auditor@example.com", "Demo Auditor", "AUDITOR", demoPassword),
      }
    : null;
  const A = actorOf(admin);
  const QM = users ? actorOf(users.qm) : A;
  const QC = users ? actorOf(users.qc) : A;
  const WI = users ? actorOf(users.weld) : A;
  const MI = users ? actorOf(users.mat) : A;

  // ── Projects ──
  const p1 = await createProject(A, {
    name: "DEMO Site Office Modules — Block A",
    customerRef: "DEMO-CUST-001",
    description: "Synthetic demonstration project.",
    scope: "Fabrication, welding, coating and final inspection of 4 steel-framed site office modules (demo).",
    startDate: ago(48),
    targetDate: ago(-20),
    projectManager: "Demo Project Manager",
    departments: "Fabrication, Welding, Paint shop, Quality",
    drawingRefs: "DEMO-DWG-100 rev C; DEMO-DWG-101 rev B",
    requirements: "Per DEMO inspection & test plan ITP-DEMO-01 (illustrative reference only)",
  });
  await updateProject(A, p1.id, { status: "ACTIVE" });
  const p2 = await createProject(A, {
    name: "DEMO Plant Room Skid",
    description: "Synthetic demonstration project — nearly complete.",
    scope: "One steel skid frame, welded and painted (demo).",
    startDate: ago(40),
    targetDate: ago(2),
    projectManager: "Demo Project Manager",
    requirements: "ITP-DEMO-02 (illustrative)",
  });
  await updateProject(A, p2.id, { status: "AWAITING_RELEASE" });

  const units1 = [];
  for (const ref of ["M-201", "M-202"]) units1.push(await createUnit(A, { projectId: p1.id, ref, type: "MODULE", description: "Demo office module", drawingRef: "DEMO-DWG-100", revision: "C" }));
  const frames1 = [];
  for (const [i, ref] of ["F-1041", "F-1042", "F-1043", "F-1044"].entries())
    frames1.push(await createUnit(A, { projectId: p1.id, ref, type: "FRAME", parentId: units1[i < 2 ? 0 : 1].id, description: "Demo base frame", drawingRef: "DEMO-DWG-101", revision: "B", stage: "Welding" }));
  const skid = await createUnit(A, { projectId: p2.id, ref: "SK-01", type: "FRAME", description: "Demo skid frame", drawingRef: "DEMO-DWG-300", revision: "A", stage: "Final inspection" });

  // ── Materials ──
  const mats = [
    { projectId: p1.id, description: "Demo RHS 100x100x5", grade: "S355J2H", supplier: "Demo Steel Supplier", poRef: "PO-DEMO-11", heatNumber: "DEMO-H-77423", certificateRef: "CERT-DEMO-3.1-0091", quantity: 24, unit: "lengths", receivingResult: "PASS" as const, inspectedAt: ago(45) },
    { projectId: p1.id, description: "Demo plate 10mm", grade: "S275JR", supplier: "Demo Steel Supplier", poRef: "PO-DEMO-12", heatNumber: "DEMO-H-77391", certificateRef: "CERT-DEMO-3.1-0092", quantity: 6, unit: "sheets", receivingResult: "PASS" as const, inspectedAt: ago(44) },
    { projectId: p1.id, description: "Demo UB 203x133", grade: "S355JR", supplier: "Demo Steel Supplier", poRef: "PO-DEMO-13", heatNumber: null, certificateRef: null, quantity: 8, unit: "lengths", receivingResult: "HOLD" as const, inspectedAt: ago(10) },
    { projectId: p1.id, description: "Demo flat bar 50x8", grade: "S355JR", supplier: "Demo Steel Supplier", poRef: "PO-DEMO-14", heatNumber: "DEMO-H-77356", certificateRef: "CERT-DEMO-3.1-0101", quantity: 20, unit: "lengths", receivingResult: "PASS" as const, inspectedAt: ago(9), identificationMismatch: true },
    { projectId: p2.id, description: "Demo SHS 80x80x4", grade: "S355J2H", supplier: "Demo Steel Supplier", poRef: "PO-DEMO-21", heatNumber: "DEMO-H-77312", certificateRef: "CERT-DEMO-3.1-0120", quantity: 12, unit: "lengths", receivingResult: "PASS" as const, inspectedAt: ago(38) },
  ];
  const matRows = [];
  for (const m of mats) matRows.push(await createMaterial(MI, { ...m, inspectorName: MI.name }));
  for (const i of [0, 1, 4]) {
    await verifyCertificate(QM, matRows[i].id, true);
    await dispositionMaterial(QM, matRows[i].id, "ACCEPTED");
  }
  await dispositionMaterial(QM, matRows[3].id, "QUARANTINED", "Stencilled heat number does not match certificate (demo).");

  // ── Inspections (spread over the last 6 weeks for trends) ──
  const insp = async (actor: Actor, projectId: string, unitId: string | null, type: Parameters<typeof createInspection>[1]["type"], daysAgo: number, result: "PASS" | "FAIL" | "HOLD", extra: Record<string, unknown> = {}, review = true) => {
    const i = await createInspection(actor, {
      projectId,
      unitId,
      type,
      stage: extra.stage as string | undefined,
      operation: extra.operation as string | undefined,
      plannedDate: ago(daysAgo + 1),
      inspectedAt: ago(daysAgo, 8 + (daysAgo % 8)),
      criteriaRef: "ITP-DEMO-01 (illustrative)",
      reinspectionOfId: extra.reinspectionOfId as string | undefined,
      items: [
        { description: "Drawing revision matches traveller", requirement: "Current approved revision per DEMO-DWG register", result: result === "FAIL" ? "PASS" : result, actual: "Rev matches" },
        { description: "Overall length", requirement: "Per drawing (demo — configure real tolerance)", tolerance: "Not configured", actual: "6002", unit: "mm", result: result },
        { description: "Diagonal check (squareness)", actual: "3 (diagonal difference)", unit: "mm", result: result },
      ],
    });
    await updateInspection(actor, i.id, { result });
    await submitInspection(actor, i.id);
    if (review) await reviewInspection(actor.id === QM.id ? A : QM, i.id, "ACCEPTED");
    return i;
  };
  const created: { id: string }[] = [];
  const types = ["FABRICATION", "DIMENSIONAL", "WELD_VISUAL", "INTERMEDIATE"] as const;
  for (let w = 0; w < 6; w++) {
    for (let n = 0; n < 4; n++) {
      const frame = frames1[(w + n) % 4];
      const fail = (w * 4 + n) % 7 === 3;
      const hold = (w * 4 + n) % 11 === 5;
      const i = await insp(n % 2 ? WI : QC, p1.id, frame.id, types[n], 40 - w * 7 - n, fail ? "FAIL" : hold ? "HOLD" : "PASS", { operation: n === 0 ? "Cutting & preparation" : undefined, stage: n === 2 ? "Welding" : "Fabrication" }, w < 5);
      if (fail) created.push(i);
    }
  }
  // A passing re-inspection of the first failure.
  if (created[0]) await insp(QC, p1.id, frames1[0].id, "FABRICATION", 3, "PASS", { reinspectionOfId: created[0].id });
  // An overdue planned inspection that has not been done.
  await createInspection(QC, { projectId: p1.id, unitId: frames1[3].id, type: "DIMENSIONAL", plannedDate: ago(4), items: [{ description: "Frame squareness" }] });

  // Skid: everything done except NDT report, for a near-release demo.
  for (const [t, d] of [["INCOMING_MATERIAL", 37], ["FABRICATION", 30], ["WELD_VISUAL", 22], ["COATING", 9], ["FINAL", 2]] as const) await insp(QC, p2.id, skid.id, t, d, "PASS");

  // ── Welds ──
  const welds = [];
  for (const [i, f] of frames1.entries()) {
    for (let j = 1; j <= 3; j++) {
      const w = await createWeld(WI, { projectId: p1.id, unitId: f.id, weldRef: `${f.ref}-W${j}`, wpsRef: "WPS-DEMO-135-01", welderId: `DEMO-WLD-0${(i % 3) + 1}`, welderQualRef: `WQ-DEMO-0${(i % 3) + 1}`, process: "135 (MAG)", stage: "Welding", ndtRequired: j === 1 });
      welds.push(w);
    }
  }
  const defectPlan: [number, string][] = [[1, "Undercut"], [4, "Undercut"], [7, "Porosity"], [10, "Undercut"], [2, "Weld spatter"], [5, "Incorrect weld profile"]];
  for (const [idx, w] of welds.entries()) {
    const defect = defectPlan.find(([i]) => i === idx);
    await recordVisual(WI, w.id, { visualResult: defect ? "FAIL" : "PASS", inspectedAt: ago(30 - idx), inspectorName: WI.name, criteriaRef: "Acceptance criteria per approved WPS/ITP (demo reference)" });
    if (defect) await addDefect(WI, w.id, { category: defect[1], notes: "Demo defect" });
  }
  // One AI-style suggestion left unconfirmed.
  await addDefect(WI, welds[8].id, { category: "Porosity", notes: "Demo: suggested from photo, awaiting inspector", source: "AI_SUGGESTION" });
  // Repair and re-inspection for weld 1.
  await recordWeldRepair(WI, welds[1].id, { description: "Ground out undercut and re-welded toe (demo)", method: "Grind and re-weld per WPS-DEMO-135-01", performedBy: "DEMO-WLD-02", performedAt: ago(20), hours: 1.5 });
  await recordVisual(WI, welds[1].id, { visualResult: "PASS", inspectedAt: ago(19) });
  const pendingRepair = await recordWeldRepair(WI, welds[4].id, { description: "Undercut repair (demo)", method: "Grind and re-weld", performedBy: "DEMO-WLD-02", performedAt: ago(5), hours: 1, cost: 85, costIsEstimate: true });

  const skidWeld = await createWeld(WI, { projectId: p2.id, unitId: skid.id, weldRef: "SK-01-W1", wpsRef: "WPS-DEMO-135-01", welderId: "DEMO-WLD-01", process: "135 (MAG)", ndtRequired: true });
  await recordVisual(WI, skidWeld.id, { visualResult: "PASS", inspectedAt: ago(22) });

  // ── NDT ──
  await saveNdt(WI, null, { projectId: p1.id, unitId: frames1[0].id, weldId: welds[0].id, method: "Magnetic particle (MT)", procedureRef: "NDT-PROC-DEMO-MT", requestedAt: ago(25), reportNo: "DEMO-MT-0012", reportDate: ago(23), contractor: "Demo NDT Contractor", personnelRef: "Demo Level 2", result: "ACCEPT" });
  await saveNdt(WI, null, { projectId: p1.id, unitId: frames1[1].id, weldId: welds[3].id, method: "Ultrasonic (UT)", procedureRef: "NDT-PROC-DEMO-UT", requestedAt: ago(15), contractor: "Demo NDT Contractor" });
  await saveNdt(WI, null, { projectId: p2.id, unitId: skid.id, weldId: skidWeld.id, method: "Magnetic particle (MT)", procedureRef: "NDT-PROC-DEMO-MT", requestedAt: ago(12), contractor: "Demo NDT Contractor" });

  // ── Coating ──
  await saveCoating(QC, null, { projectId: p2.id, unitId: skid.id, surfacePrep: "Blast cleaned (demo)", product: "Demo epoxy primer", batchRef: "DEMO-B-551", envReadings: "Recorded on traveller (demo)", dftReadings: "As recorded on demo DFT sheet", specRef: "Coating spec DEMO-CS-01", result: "PASS", inspectedAt: ago(9) });

  // ── NCRs ──
  const n1 = await raiseNcr(WI, { projectId: p1.id, unitId: frames1[1].id, description: "Undercut observed on fillet weld toe at column base (demo).", defectCategory: "Undercut", requirementRef: "WPS-DEMO-135-01 / ITP-DEMO-01", priority: "HIGH", ownerName: "Demo Welding Supervisor", targetDate: ago(2), weldId: welds[4].id, containment: "Frame tagged HOLD (demo)" });
  await updateNcr(QM, n1.id, { rootCauseCategory: "Method / procedure", rootCauseMethod: "5 Whys", rootCause: "Travel speed too high on vertical-up runs (demo).", disposition: "Repair" });
  await moveNcr(QM, n1.id, "ACTION_IN_PROGRESS");
  await addAction(QM, { ncrId: n1.id, type: "CORRECTIVE", description: "Repair undercut per WPS and re-inspect (demo).", ownerName: "Demo Welding Supervisor", dueDate: ago(1) });
  await addAction(QM, { ncrId: n1.id, type: "PREVENTIVE", description: "Toolbox talk on travel speed for vertical welds (demo).", ownerName: "Demo Welding Supervisor", dueDate: ago(-7) });
  await db.repair.update({ where: { id: pendingRepair.id }, data: { ncrId: n1.id } });

  const n2 = await raiseNcr(QC, { projectId: p1.id, unitId: frames1[2].id, description: "Frame diagonal outside configured check value (demo).", defectCategory: "Dimensional", priority: "MEDIUM", ownerName: "Demo Fabrication Lead", targetDate: ago(-5), inspectionId: created[1]?.id });
  void n2;
  const n3 = await raiseNcr(MI, { projectId: p1.id, description: "Flat bar heat number stencil does not match mill certificate (demo).", defectCategory: "Material / traceability", priority: "HIGH", ownerName: "Demo Stores", targetDate: ago(-3), materialId: matRows[3].id, containment: "Material quarantined (demo)" });
  void n3;
  const n4 = await raiseNcr(QC, { projectId: p1.id, unitId: frames1[0].id, description: "Missing gusset plate at node 4 (demo).", defectCategory: "Missing component", priority: "LOW", ownerName: "Demo Fabrication Lead", targetDate: ago(20) });
  await moveNcr(QM, n4.id, "INVESTIGATING");
  await updateNcr(QM, n4.id, { rootCauseCategory: "Design / drawing", rootCauseMethod: "5 Whys", rootCause: "Gusset not shown on cutting list (demo).", disposition: "Rework — fit missing plate" });
  await moveNcr(QM, n4.id, "ACTION_IN_PROGRESS");
  const a4 = await addAction(QM, { ncrId: n4.id, type: "CORRECTIVE", description: "Fit and weld gusset; update cutting list (demo).", ownerName: "Demo Fabrication Lead", dueDate: ago(18) });
  await updateActionStatus(QM, a4.id, "COMPLETED");
  await updateActionStatus(A, a4.id, "VERIFIED");
  await moveNcr(QM, n4.id, "AWAITING_VERIFICATION");
  await closeNcr(QM, n4.id, { verificationNotes: "Gusset fitted, visual re-inspection passed (demo).", reinspectionResult: "PASS" });

  // ── Audit ──
  const audit = await saveAudit(QM, null, { title: "DEMO internal process audit — welding", auditType: "Internal process audit", scope: "Welding records and traceability (demo)", standardRefs: "Company procedure QP-DEMO-07 (reference only)", scheduledAt: ago(14), auditor: "Demo Auditor", status: "COMPLETED", checklist: "Are WPS references recorded for every weld?\nAre welder IDs traceable to qualifications?\nAre NDT reports filed for every weld requiring NDT?" });
  await addFinding(QM, audit.id, { type: "OBSERVATION", description: "Two welds missing welder qualification reference (demo).", clauseRef: "QP-DEMO-07 §4", ownerName: "Demo Welding Supervisor", dueDate: ago(-10) });
  await addFinding(QM, audit.id, { type: "NONCONFORMITY", description: "NDT report outstanding beyond 7 days (demo).", clauseRef: "QP-DEMO-07 §6", ownerName: "Demo Quality Manager", dueDate: ago(1) });
  await saveAudit(QM, null, { title: "DEMO supplier audit — steel stockholder", auditType: "Supplier audit", scheduledAt: ago(-21), auditor: "Demo Auditor", standardRefs: "Supplier approval procedure (reference only)" });

  // ── Documents & calibration ──
  const wps = await createDocument(QM, { docNo: "WPS-DEMO-135-01", title: "DEMO welding procedure specification — MAG fillet welds", docType: "WPS", ownerName: "Demo Welding Coordinator" });
  const rev = await addRevision(QM, wps.id, { revision: "A", notes: "Demo reference — no file attached" });
  await approveRevision(A, rev.id);
  const itp = await createDocument(QM, { docNo: "ITP-DEMO-01", title: "DEMO inspection & test plan — Block A", docType: "Inspection & test plan", projectId: p1.id, ownerName: "Demo Quality Manager" });
  await addRevision(QM, itp.id, { revision: "1", notes: "Demo reference — awaiting approval" });
  const tape = await createEquipment(QM, { assetNo: "DEMO-TAPE-01", description: "Demo steel tape 10 m", location: "QC office", intervalDays: 365 });
  await addCalibration(QM, tape.id, { calibratedAt: ago(300), dueAt: ago(-65), certificateRef: "DEMO-CAL-1001", provider: "Demo Calibration Lab", result: "Pass" });
  const gauge = await createEquipment(QM, { assetNo: "DEMO-WG-02", description: "Demo weld gauge", location: "Weld bay", intervalDays: 365 });
  await addCalibration(QM, gauge.id, { calibratedAt: ago(380), dueAt: ago(15), certificateRef: "DEMO-CAL-0877", provider: "Demo Calibration Lab", result: "Pass" });
  const dft = await createEquipment(QM, { assetNo: "DEMO-DFT-01", description: "Demo DFT gauge", location: "Paint shop", intervalDays: 180 });
  await addCalibration(QM, dft.id, { calibratedAt: ago(160), dueAt: ago(-20), certificateRef: "DEMO-CAL-1120", provider: "Demo Calibration Lab", result: "Pass" });

  // ── Photos (generated placeholders) ──
  const photoPlan: { label: string; category: string; stage: string; unit?: string; days: number | null; weld?: number; ncr?: string; repairPhase?: "BEFORE" | "AFTER"; material?: number; project?: string }[] = [
    { label: "Project kick-off, bay 2", category: "Project commencement", stage: "Project commencement", days: 47 },
    { label: "RHS delivery, heat DEMO-H-77423", category: "Steel identification & heat numbers", stage: "Incoming materials", days: 45, material: 0 },
    { label: "Plate delivery", category: "Incoming materials", stage: "Incoming materials", days: null, material: 1 },
    { label: "Saw cutting RHS", category: "Cutting & preparation", stage: "Cutting & preparation", unit: "F-1041", days: 38 },
    { label: "Frame F-1042 on jig", category: "Frame assembly", stage: "Frame assembly", unit: "F-1042", days: 31 },
    { label: "Welding F-1043 base", category: "Welding in progress", stage: "Welding", unit: "F-1043", days: 27 },
    { label: "Weld F-1042-W2 undercut (before)", category: "Repair & rework — before", stage: "Welding", unit: "F-1042", days: 21, weld: 4, ncr: "n1", repairPhase: "BEFORE" },
    { label: "Weld F-1041-W2 visual", category: "Weld visual inspection", stage: "Welding", unit: "F-1041", days: 19, weld: 1 },
    { label: "Flat bar stencil mismatch", category: "Steel identification & heat numbers", stage: "Incoming materials", days: 9, material: 3 },
    { label: "Skid final inspection", category: "Final inspection", stage: "Final inspection", days: 2, project: "p2" },
    { label: "Skid coated", category: "Painting & coating", stage: "Painting & coating", days: 9, project: "p2" },
  ];
  const repairForPhotos = await db.repair.findFirst({ where: { weldId: welds[4].id } });
  for (const [i, ph] of photoPlan.entries()) {
    const projectId = ph.project === "p2" ? p2.id : p1.id;
    const unitId = ph.project === "p2" ? skid.id : ph.unit ? frames1.find((f) => f.ref === ph.unit)?.id : undefined;
    const buf = await demoPhoto(ph.label, (i * 37) % 360, ph.days == null ? null : ago(ph.days, 10));
    const [res] = await uploadPhotos(i % 2 ? QC : WI, projectId, [{ name: `demo-${i + 1}.jpg`, data: buf }], {
      category: ph.category,
      stage: ph.stage,
      unitId,
      caption: `${ph.label} (demo)`,
      weldId: ph.weld != null ? welds[ph.weld].id : undefined,
      weldRef: ph.weld != null ? welds[ph.weld].weldRef : undefined,
      ncrId: ph.ncr === "n1" ? n1.id : undefined,
      repairId: ph.repairPhase ? repairForPhotos?.id : undefined,
      reworkPhase: ph.repairPhase,
      materialId: ph.material != null ? matRows[ph.material].id : undefined,
      heatNumber: ph.material != null ? matRows[ph.material].heatNumber ?? undefined : undefined,
      tags: "demo",
    });
    if (!res.ok) console.warn("photo failed", res);
  }

  // Mark everything created during this run as demo data.
  const since = { gte: started };
  await db.$transaction([
    db.project.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.unit.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.photo.updateMany({ where: { uploadedAt: since }, data: { isDemo: true } }),
    db.inspection.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.weld.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.weldDefect.updateMany({ where: { recordedAt: since }, data: { isDemo: true } }),
    db.material.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.ndtRecord.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.coatingRecord.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.ncr.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.correctiveAction.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.repair.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.qualityAudit.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.auditFinding.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.document.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.equipment.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.calibrationRecord.updateMany({ where: { createdAt: since }, data: { isDemo: true } }),
    db.releaseRecord.updateMany({ where: { releasedAt: since }, data: { isDemo: true } }),
  ]);
  const scan = await runNotificationScan();
  console.log(`Demo data created. Notifications: ${scan.conditions} conditions.`);
  if (!users) console.log("DEMO_USER_PASSWORD not set — demo role accounts were not created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
