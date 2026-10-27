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

## NCR and CAPA

1. **Raise** (from an inspection, weld or material page, or *NCR → New*). Add containment.
2. **Investigate**: root cause category, method (5 Whys / fishbone) and the root cause.
3. **Action in progress**: add corrective and preventive actions with owners and due dates.
4. Complete actions; a Quality Manager **verifies** them.
5. **Awaiting verification** → a Quality Manager records verification evidence and the re-inspection result and **closes** it.

Uploading a repair photo does not close anything. Reopening a closed NCR needs a reason and is recorded.

## Final inspection and release

*Final Inspection & Release* shows every configured check for a project or a single frame: final inspection, unresolved inspections, open NCRs and actions, materials and certificates, welds, NDT, and required photo categories.
Release is refused while a check fails. A Quality Manager can release under a **documented concession** (reference + justification), which is recorded and shown on reports. Releases can be revoked with a reason. The AI never releases anything.

## Documents and calibration

Every document has numbered revisions. A new revision never overwrites an old one; approving a revision supersedes the previous approved one, and the uploader cannot approve their own revision. Calibration records show *Current / Due soon / Expired / No record*.

## Notifications

The bell shows reminders for your role (overdue inspections/NCRs/actions, missing certificates, quarantine, NDT, calibration, audit findings, missing evidence, projects awaiting release). Mute types you don't need under *Notifications → Preferences*. No emails are sent.

## Exports

Every register has an Excel link; *Analytics & Reports → Exports* has them all. Each workbook starts with an *About* sheet (who, when, filters, demo warning). The KPI workbook contains the raw inspection rows and live Excel formulas so anyone can check the dashboard numbers.
