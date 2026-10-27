# Pilot plan — one live project, two weeks, paper in parallel

Goal: prove on the factory floor that the Command Centre records inspections, photos, NCRs and the ITP at least as reliably as the paper QF 6.42 / NCR forms — before any paper process is retired.

## Before day 1 (Quality Manager + IT, ~2 hours)

| # | Task | Who | Where |
|---|---|---|---|
| 1 | Host the app on the company network with HTTPS and daily backups (see docs/DEPLOYMENT.md; on-site server recommended) | IT | — |
| 2 | Review the **QM review pack** (Excel) and approve, or correct, each QF 6.42 template | Quality Manager | Settings → Checklist templates → *Download QM review pack*; approve in the same tab |
| 3 | Confirm release rules (ITP Hold Points, required photo categories, concessions) and role permissions | Quality Manager | Settings → Release rules / Permissions |
| 4 | Create real user accounts; purge demo data | Administrator | User Management; Settings → Data |
| 5 | Pick the pilot project — one **currently in manufacture** — and import it (Project Register → Import from Excel) or create it | QC | Project Register |
| 6 | Apply the ITP (Structural, plus any other discipline that applies) | QC | Project → ITP |

## During the pilot (2 weeks)

- Inspectors complete the **paper form as normal** and enter the same inspection in the app the same day (tablet/phone at the bay where possible).
- Photos: every QC photo taken on the project is uploaded the same day with frame and category.
- Every NCR on the project is raised in the app (paper NCR still issued).
- Hold Points are signed in the app by the Quality Manager when the paper is signed.
- Friday: generate the Detailed project quality report and compare it with the paper pack.

## Go / no-go after two weeks

| Measure | Target |
|---|---|
| Paper inspections also in the app | 100% of sections |
| Photos uploaded with frame + category the same day | ≥ 90% |
| NCRs in the app with root cause & actions | 100% |
| Discrepancies between app report and paper pack | 0 unresolved |
| Inspector time per section vs paper | No worse than paper + 20% |
| Inspector / QM feedback | Issues logged and resolved or planned |

**Go:** extend to all new projects; paper QF 6.42 kept only where a client contract requires it.
**No-go:** keep paper, fix the logged issues, repeat the pilot.
Rollback is trivial at any point — the paper process never stopped.

## Known decisions still open
- Hosting location and who administers backups (IT).
- Whether factory photos may be sent to an external AI service (leave AI review off until decided).
- SSO / MFA before any access from outside the company network.
