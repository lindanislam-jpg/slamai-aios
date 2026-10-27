# Status — what is built, what needs company input

## Final verification (this build)

- `npx tsc --noEmit` clean · `npx eslint . --max-warnings=0` clean · `npm test` **50/50 passed** (12 files, real PostgreSQL) · `npm run build` succeeds (44 routes).
- Production server (`npm start`) end-to-end run with Playwright on a freshly seeded database, signing in as each of the 7 roles and opening all 23 main pages: every page loads for permitted roles; Users and Settings are refused for every non-admin; the Excel export is refused (403) for Production Viewer; no browser console errors.
- Real browser photo upload as a QC Inspector stored EV-000012 with the capture time read from EXIF; a Final Quality Handover Pack PDF was generated and downloaded as a Quality Manager (valid PDF, ~480 KB).

Legend: ✅ implemented and verified · ⚠️ implemented, limitation noted · ⛔ not done / needs company input

## Implemented and verified

| Area | State | How verified |
|---|---|---|
| Executive dashboard (live KPIs, trends, donuts, NCR ageing, risks, filters, drill-down, Excel) | ✅ | Browser; KPI maths unit-tested; reconciliation test against DB; KPI workbook formulas recomputed |
| Project register + project page (overview, timeline, photos, materials, fabrication, welding, inspections, NCRs, documents, release, reports) | ✅ | Browser flows |
| Photo evidence: multi-upload, drag-drop, camera capture, validation, thumbnails, EXIF capture time, metadata edit with history, review/approve, withdraw (never deleted), linking, before/after | ✅ | Integration tests (valid/invalid/oversized/duplicate/cross-project/permissions/persistence) + browser |
| Fabrication QC, inspection register, configurable checklists/templates, draft→submit→review, segregation of duties, re-inspection | ✅ | Tests + browser as inspector and QM |
| Welding QC: welds, visual results, defects (confirmed vs unconfirmed/AI), repair → re-inspection, NDT hold, Pareto/repeats/trends | ✅ | Tests + browser |
| Material traceability: heat/grade/cert search, gaps, certificate verification, accept/quarantine/reject | ✅ | Tests + browser |
| NDT and painting/coating records | ✅ | Tests + browser |
| NCR & CAPA lifecycle, root cause, actions, verified closure, recurring NCRs, ageing | ✅ | Tests + browser |
| Rework & repair (actual vs estimated cost kept separate) | ✅ | Tests + browser |
| Final inspection & release gate, concession, revoke | ✅ | Tests + browser |
| Audits (schedule, checklist, findings, CAPA, closure evidence) | ✅ | Browser |
| Documents (append-only revisions, second-person approval, supersede) & calibration status | ✅ | Tests + browser |
| PDF reports — 7 types, from live records, revisions, DEMO watermark, missing-info list, blank approval block | ✅ | Tests (all types) + visual check of rendered pages |
| Excel exports — 10 workbooks, About sheet, KPI workbook with formulas + data dictionary | ✅ | Tests + downloaded and opened |
| Global search (project, frame, inspection, weld, heat no., cert, NCR, photo, document, NDT) | ✅ | Browser |
| Auth, roles, configurable permissions matrix, lockout, session revocation | ✅ | Tests + browser as several roles |
| Audit trail (every change, before/after) + Activity log page | ✅ | Tests + browser |
| In-app notifications with de-duplication, preferences, scheduled script | ✅ | Tests |
| Demo data clearly labelled; purge tool | ⚠️ | Seeding verified; purge reviewed and typechecked, not run against the dev database |
| Backup & restore script | ✅ | Backup restored into a fresh database; counts and files matched |
| CI (typecheck, lint, tests on Postgres, build) | ⚠️ | Workflow written; runs on GitHub on push/PR |

## Company forms imported (local demo database)

The QF 6.42 Rev 2 Steel QC Structural Inspection workbook (from the Quality Department's Google Drive) was imported with `npm run import:forms`: 19 sections, 267 checks, all **unapproved** pending Quality Manager review. Two issues in the form itself were reported: Lifting Eyes row 2.12 has no check text, and AHU Platform Steel uses number 3.11 twice. The workbook is not stored in the repository.

## Limitations

- ⚠️ **HEIC photos** are stored and downloadable, but the server cannot decode HEVC-HEIC, so there is no thumbnail, no PDF image and no AI review for them. iPhones can be set to "Most Compatible" (JPEG), or convert before upload.
- ⚠️ **Photo capture time** is the camera's local time as written in EXIF (no time zone); it is interpreted in the server's time zone.
- ⚠️ **S3 storage driver** is implemented but not tested against a real bucket.
- ⚠️ **AI photo review** is implemented against the Anthropic API but not exercised end-to-end here (no API key in this environment). Disabled state verified.
- ⚠️ Reports are generated synchronously in the request; very large photo sets (hundreds of photos) will be slow. A background job queue is the next step if that becomes a problem.

## Needs company credentials, data or approval

- ⛔ **Real users** — create them in User Management; demo `@example.com` accounts are deactivated by the purge.
- ⛔ **Acceptance criteria / tolerances / ITPs / WPS** — must be entered or approved by the responsible quality personnel (checklist templates, criteria references). The app deliberately ships none.
- ⛔ **Release rules & required evidence categories** — review Settings → Release rules with the Quality Manager.
- ⛔ **Role permissions** — confirm the default matrix (Settings → Permissions).
- ⛔ **QMS / SharePoint integration** — none configured; adapter interface only (docs/INTEGRATIONS.md).
- ⛔ **Email notifications** — not implemented; needs an approved provider.
- ⛔ **SSO / MFA** — not implemented; recommended before any internet exposure.
- ⛔ **Hosting, TLS, backups schedule** — IT decision (docs/DEPLOYMENT.md).
- ⛔ **AI vision** — needs an API key and a data-policy decision on sending factory photos to an external service.
- ⛔ **Branding** — company name/footer configurable in Settings; logo is a vector approximation of the ASGARD mark from the prototype screenshot — replace with the official artwork.
