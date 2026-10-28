# User guide — QC inspectors and Quality Managers

## Signing in and roles

Sign in at the address your administrator gives you. What you can do depends on your role:

| Role | Typical use |
|---|---|
| Administrator | Users, settings, everything |
| Quality Manager | Reviews inspections, closes NCRs, approves documents, authorises release and concessions |
| QC Inspector | Records fabrication, dimensional, coating and general inspections; uploads photos; raises NCRs |
| Welding Inspector | Records welds, visual inspection, confirms weld defects, NDT |
| Material Inspector | Registers material, verifies certificates, accepts/quarantines material |
| Production Viewer | Read-only |
| Auditor / Read-only | Read-only plus downloads, reports and exports |

Buttons you are not allowed to use are hidden. The server enforces the same rules, so nothing can be changed by guessing a URL.

## Your first project report in 10 minutes

1. **Project Register → New project.** Enter the name, scope, dates, drawing references and the ITP/specification reference. The app gives it an ID (PRJ-0001…).
2. Open the project → **Overview** → add the **modules / frames** (e.g. M-201, F-1043).
3. **Upload factory photos** — *Project Photo Evidence → Upload photos* (or the Photos tab on the project):
   - Drag photos in, click to browse, or on a phone/tablet use **Take photo**.
   - Choose the project (required), frame, category (e.g. *Frame assembly*, *Weld visual inspection*) and stage. Add a caption, heat number or weld reference if relevant. These details apply to every photo in the batch, so upload one batch per frame/stage.
   - Each file is checked (JPG/PNG/HEIC, size limit, duplicates). You get an evidence ID (EV-000123) per photo.
   - The capture time is read from the photo itself. If the photo has none (e.g. screenshots, some messaging apps strip it), the app shows the upload time and marks it — it never guesses.
4. Record inspections (*Inspection Register → New*), welds (*Welding QC*), materials (*Material Traceability*). Link photos to them from the photo page or the upload form.
5. Open the project → **Reports** → choose *Detailed project quality report* → **Generate**. Download the PDF. Regenerating creates the next revision.

The report lists everything that is missing (unverified certificates, open NCRs, checklist items without approved criteria, missing evidence) instead of filling gaps. It is marked **DRAFT — NOT APPROVED** until signed in the approval block.

## Inspections

- A checklist item with no requirement text is shown as **Requires configuration**. Enter the requirement from the approved drawing/ITP — the app never invents tolerances.
- Workflow: *Draft → Submitted → Accepted/Rejected*. You cannot submit without a result, a date and answers to required items, and you cannot record *Pass* while a required item failed.
- A different person must review. Accepted records are locked; corrections are made with a re-inspection.
- **Re-inspection**: use *Create re-inspection* on the failed record. First-pass yield counts only first attempts.

## Welding

- Record each weld (ID, frame, WPS, welder, process). Record the visual result.
- Visual **Fail** → status *Repair required*. Log the repair (method, who, hours/cost if known) → *Awaiting re-inspection*. Recording the re-inspection result needs a Welding Inspector/QM.
- Welds marked *NDT required* stay *Awaiting inspection* until an NDT record with a report number is accepted.
- Defects you record are confirmed if you hold confirm rights. AI suggestions are always *unconfirmed* until an inspector confirms them; unconfirmed defects are excluded from KPIs.

## Materials

- Register each delivery item with grade, heat number and certificate reference. Entering a certificate number marks it *uploaded, unverified* — not verified.
- Accept only works when heat number, grade, a **verified** certificate and a passed receiving inspection are present, and no identification mismatch is flagged. The page tells you exactly what is missing.
- Quarantine or reject with a reason. Changing a heat number/grade/certificate later resets verification.
- Search by heat number from the top search bar or the material register.

## Project numbers and importing projects

New projects can use your own number (e.g. **AMM764**); leave it blank to get PRJ-0001 style numbering. The number cannot be changed later because it appears on every record and report.
To load many projects at once: *Project Register → Import projects from Excel*. Download the template, fill the **Projects** sheet (one row per project) and the **Units** sheet (modules / frames, with an optional parent), then **Preview**. Nothing is written until you press **Import**. Existing projects and units are skipped, never overwritten, and release can't be imported — it is only ever recorded in the app.

## Inspection & Test Plan (QF 6.14)

Open a project → **ITP** tab → upload the ITP workbook and tick the disciplines that apply (Structural, Architectural, Electrical, Mechanical, Process Pipe). Every row becomes a control point with its acceptance criteria, method, frequency, responsibility, sign-off document and the Sub / AMM / Client / 3rd-party codes exactly as in the ITP.
- **Sign** a control point with the evidence reference (report number, form, dossier). Inspectors sign I/R/W/M/S points; **Hold (H)** and **Accept (A)** points need a Quality Manager.
- A point that does not apply is marked **not applicable** with a reason (Quality Manager). Signed points can be reopened with a reason; everything is in the history.
- **Project release is blocked while any Hold Point is open** (Settings → Release rules → "All ITP Hold Points signed"). Single module/frame releases are not blocked by project-level hold points such as the handover pack.

## NCR and CAPA

1. **Raise** (from an inspection, weld or material page, or *NCR → New*). Add containment.
2. **Investigate**: root cause category, method (5 Whys / fishbone) and the root cause.
3. **Action in progress**: add corrective and preventive actions with owners and due dates.
4. Complete actions; a Quality Manager **verifies** them.
5. **Awaiting verification** → a Quality Manager records verification evidence and the re-inspection result and **closes** it.

Uploading a repair photo does not close anything. Reopening a closed NCR needs a reason and is recorded.

The NCR follows the company NCR form (QC-NCR-001): severity (Minor / Major / Critical), department, stage of detection, detected by, drawing reference, containment, 5-Why root cause, contributing factors, and an **impact assessment** (structural, safety, schedule, customer, cost, quality system). While an NCR is open the page states **Can product be released? No**.
**Verification of effectiveness:** when an NCR closes, an effectiveness check is scheduled (30 days by default, Settings → Limits). The page lists any same-category NCRs raised since closure. A Quality Manager records *Effective* or *Not effective*; *Not effective* reopens the NCR to Action in progress for escalation.

## Final inspection and release

*Final Inspection & Release* shows every configured check for a project or a single frame: final inspection, unresolved inspections, open NCRs and actions, materials and certificates, welds, NDT, and required photo categories.
Release is refused while a check fails. A Quality Manager can release under a **documented concession** (reference + justification), which is recorded and shown on reports. Releases can be revoked with a reason. The AI never releases anything.

## Project files

Project → **Files** keeps any file that belongs to the project: drawings, specifications, purchase orders, material certificates, test reports, client correspondence (.msg/.eml), method statements and handover/QC packs. Drag several files in at once, choose a category (and optionally the module/frame), add a note such as "Rev C issued for construction", and upload. Up to 100 MB per file; PDF, Office, images, CAD (DWG/DXF/STEP/IGES), ZIP and e-mail files are accepted. Each file gets a number (FL-000123), is fingerprinted so the same file can't be attached twice, and every upload and download is in the audit trail. Files always download; they are never opened inside the app.

Inspectors can add files; only a Quality Manager or administrator can remove one, with a reason (e.g. "superseded by Rev D"). Removal hides the file from the project but keeps the record and the stored file. Use **Documents** instead when a document needs a revision history with second-person approval.

## Documents and calibration

Every document has numbered revisions. A new revision never overwrites an old one; approving a revision supersedes the previous approved one, and the uploader cannot approve their own revision. Calibration records show *Current / Due soon / Expired / No record*.

## Notifications

The bell shows reminders for your role (overdue inspections/NCRs/actions, missing certificates, quarantine, NDT, calibration, audit findings, missing evidence, projects awaiting release). Mute types you don't need under *Notifications → Preferences*. No emails are sent.

## Exports

Every register has an Excel link; *Analytics & Reports → Exports* has them all. Each workbook starts with an *About* sheet (who, when, filters, demo warning). The KPI workbook contains the raw inspection rows and live Excel formulas so anyone can check the dashboard numbers.

## Importing your existing inspection forms (QF 6.42)

Your QF 6.42 Steel QC / Structural Inspection workbook can be turned into checklist templates, so inspectors fill in the same numbered checks in the app:

```bash
npm run import:forms -- "path/to/QF_6_42 Steel QC Structural Inspection.xlsx"            # preview, writes nothing
npm run import:forms -- "path/to/…xlsx" --apply --register-document --stages             # import
```

- Each section sheet (Floor, Walls, Roof, Secondary Steel, Painting, Skids, …) becomes one template, keeping the form's check numbers, wording, groups (Cutting / Fabrication / Welding) and the role that completes each check. Dimensional checks get a millimetre field; the form states no tolerance, so the item says so.
- Front page, weld map and sign-off sheets are skipped. Rows whose text can't be read, or numbers used twice, are listed as warnings for you to fix in the form.
- `--register-document` adds the workbook to the document register as a new revision (under review). `--stages` sets the production stages to the form's sections.
- Imported templates are **not approved**. A Quality Manager reviews and approves each one in Settings → Checklist templates before use. Re-running skips templates that already exist.

## Corrective Maintenance Requests (CMR)

**Anyone with "Raise CMR" permission** (inspectors, supervisors, technicians, project managers): CMR → *Report an equipment problem*. Choose the asset from the register (or type its name), describe the fault, set priority, and tick *Equipment unavailable* if it cannot be used — a registered asset is then shown **out of service**. Attach photos or documents on the CMR page (up to 4 MB each).

**Maintenance technicians**: acknowledge → assign → start work → record diagnosis, work done, parts and downtime in the work log → *Work done — request verification*. Use *Waiting for parts / external support* while blocked.

**Quality Manager / authorised verifier**: *Verify repair* records the checks carried out and, if ticked, approves the asset's **return to service**. The technician who did the work cannot verify it. Then *Close*. If the fault comes back, *Reopen* — the earlier closure is kept under *Earlier closures*.

The system never declares equipment safe or calibrated; it records who verified it.

## Smart Quality Alerts

Alerts are raised automatically from the records by rules (Settings → *Alert rules*): repeated weld defects, failed inspections with no NCR, missing heat numbers, overdue / critical / repeated CMRs, equipment out of service, overdue NCRs and actions, rework awaiting inspection, open Hold Points at release, and more. Each alert lists the records that triggered it.

- One alert per rule per record — no duplicates. Rules are re-evaluated every few minutes, after CMR changes, and on *Re-evaluate now*.
- If the condition disappears (e.g. heat number added) the alert resolves itself. If it comes back later, the alert reopens.
- People with *Manage alerts* can acknowledge, assign, resolve (with how) or dismiss (with a reason).
- Administrators change rules, severities and thresholds in Settings → Alert rules; each change creates a new rule version in the audit trail. Default thresholds are starting points — confirm them with the Quality Manager.

## Roles added

Production Supervisor, Maintenance Technician and Project Manager. Default permissions are in Settings → Permissions and can be changed by an administrator.
