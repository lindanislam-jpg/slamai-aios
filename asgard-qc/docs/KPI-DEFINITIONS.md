# KPI definitions

The dashboard computes everything live from records (`src/lib/kpi.ts`); the same definitions appear as tooltips and in the KPI Excel workbook.

| KPI | Definition |
|---|---|
| Total inspections | Inspections in the period (by inspection date, else planned date, else record date), excluding cancelled. |
| Inspections completed | In-period inspections with a result and status Submitted, Reviewed or Accepted. Drafts and rejected records are not complete. |
| Inspection pass rate | Completed inspections with Pass ÷ completed with Pass, Fail or Hold. N/A excluded from the denominator. Includes re-inspections. |
| First-pass yield | First-attempt (not re-inspection) completed inspections with Pass ÷ first-attempt completed with Pass, Fail or Hold. |
| Overdue inspections | Current: Draft/Rejected inspections whose planned date has passed. |
| Open / overdue NCRs | Current: NCRs not Closed/Cancelled; overdue = past target date. |
| Open corrective actions | Current: actions not Verified/Cancelled; overdue = Open/In progress past due date. |
| Weld defects | Inspector-confirmed defects recorded in the period. AI/unconfirmed excluded. |
| Rework volume | Repairs performed in the period. |
| Rework cost | Sum of costs entered as **actual**. Estimates are shown separately; missing costs are never estimated. |
| Material exceptions | Current: non-rejected materials with missing heat number, unverified/missing/rejected certificate, or ID mismatch. |
| Quarantined | Current: materials in Quarantine. |
| Outstanding NDT | Current: NDT/test requests with no result. |
| Audit actions outstanding | Current: audit findings not Closed. |
| Released modules/frames | Current: units with an active (not revoked) release ÷ all units. |
| Missing evidence | Current: for active projects, required photo categories (Settings → Release rules) with no photo. |

Empty datasets show "—" (not 0 % or 100 %). The *Data* filter can restrict to real or DEMO records. "vs previous period" compares with the same-length window immediately before.
