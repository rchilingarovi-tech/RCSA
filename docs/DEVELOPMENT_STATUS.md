# Development status

**As of:** 2026-11-07. `develop` is at `0495385` (PR #5, the post-S1 status
sync; the S1 code merged in PR #4 at `0793830`). **ID-integrity stage S2
(create-only CSV imports) is implemented on `feature/v1-import-id-integrity`,
not merged**; the final branch review is pending. Stages S3–S6 are not started.
`main` is at `bb880cc`, the stable baseline from before the testing foundation. Rules: [`../AGENTS.md`](../AGENTS.md). Workflow:
[`AI_HANDOFF.md`](AI_HANDOFF.md).

> Update this file whenever a milestone lands or a defect is fixed or found.
> When you do, re-check every claim against the repository.

## 1. V1 architecture (frontend-only prototype)

- **Stack.** React 18.3 + TypeScript 5.9 (strict) + Vite 6.4 + Tailwind 3.4. The only runtime dependencies are `react` and `react-dom`. Charts are hand-built.
- **Shell.** `rcsa-portal/src/components/layout/AppShell.tsx`. The menu and module list come from one registry, `rcsa-portal/src/modules/registry.tsx`. There is no URL router: the active module is kept in `localStorage`.
- **State.** The RCSA modules (assets, risks, treatments) share a React context store (`src/state/AppStore.tsx`) behind an **async** repository interface (`src/data/repository.ts`). The other modules use a **synchronous** generic repository (`src/data/createLocalRepo.ts`), one instance per module.
- **Cross-module views.** Dashboard, Master Calendar, Reports and the notification bell aggregate other modules' data through pure functions such as `src/modules/overview/aggregate.ts`.
- **Persistence limitations.**
  - Everything is in browser `localStorage`, per device and per browser profile, with no shared or multi-user data.
  - Storage write failures are swallowed silently.
  - A save reads the whole collection, changes it and writes it back, so the last writer wins.
  - There is no server, backup or migration path yet.
- **Security limitations** (documented in `PRODUCT.md`). These are UX gates, **not security controls**:
  - Authentication and per-module RBAC run entirely in the browser.
  - The session is a user id kept in `localStorage`.
  - Passwords are hashed with a non-cryptographic demo hash.
  - The demo "switch user" option needs no password.
  - The audit trail is client-side and can be tampered with.
  - Aggregate views do not filter their data by the user's module rights.

## 2. Platform modules (21, from `src/modules/registry.tsx`)

| Group | Modules |
|---|---|
| Overview | Dashboard · Master Calendar · Reports |
| RCSA | RCSA Dashboard · Asset Catalogue · **Risk Catalogue**\* · **Treatment Catalogue**\* |
| Risk & Compliance | **Compliance**\* · Audit Findings · Third-Party Vendors |
| Security Operations | Incidents · Vulnerabilities |
| Governance | Policy & Document Control · Committee Meetings · Access Reviews |
| Planning & Performance | Department KPIs · Yearly Plan · Awareness Training |
| Administration | Audit Log · Directory |
| Footer | Settings |

\* Business rules are protected. Other protected areas cut across modules: data models, persistence, CSV import/export, authentication, authorisation and audit. See `AGENTS.md`, rule 2.

## 3. Completed milestones

| Milestone | Where | Notes |
|---|---|---|
| V1 modules above | `develop`, `main` | Built before the testing work |
| **Testing foundation** (PR #1) | `develop` at `fa8e293` (contains commit `123a47a`) | Independently reviewed by Codex; final verdict ACCEPT (as reported by the user) |
| **AI workflow documents** (PR #2) | `develop` at `36ec4cf` | Reviewed by Codex: ACCEPT |
| Milestone 3, application stabilisation: **treatment initialisation fix** (PR #3) | `develop` at `f5d6df4` | Fresh-install treatments are now seeded together with risks. Regression tests are in `treatment-initialization.test.tsx`. Reviewed by Codex: ACCEPT. |
| Milestone 4, **ID integrity stage S1** (shared safe ID allocator) | `develop` at `0793830` (contains commit `061bb35`) | Design: `docs/ID_INTEGRITY_DESIGN.md`. Fixes D1 and R11; R15 (D8) stays open. Reviewed by Codex: ACCEPT (`review-mw4s0k34-cyg35x`). |
| Milestone 4, **ID integrity stage S2** (create-only CSV imports) | **`feature/v1-import-id-integrity` only, not merged** | Design: `docs/ID_INTEGRITY_S2_DESIGN.md` (revision 6.1, Codex ACCEPT). Implemented in four separately approved, Codex-reviewed steps: strict CSV grammar and identity/reference validation; checked create-only persistence core; checked audit, repository and store integration; UI integration. All 13 importers create new records only (any non-blank ID cell blocks the file), with exact fail-closed parent references, all-or-nothing validation, a commit-time recheck, one checked append-only write, a checked audit batch and five reported outcomes. CSV updates of existing records are deferred. Final branch review pending. S3–S6 are not started; each needs separate approval. |

**Testing foundation** (`rcsa-portal/docs/testing.md`):
- 316 Vitest tests, as run by Codex on S1 (`review-mw4s0k34-cyg35x`). The merge `0793830` has the same tree as S1 commit `061bb35`. They cover asset criticality, inherent and residual scoring, treatment status and overdue rules, compliance coverage, KPI RAG and attainment, vulnerability SLAs, CSV parsing and validation, treatment initialisation, and record ID allocation.
- 17 known-defect specifications on `develop` (see §4).
- **On the S2 branch:** 541 Vitest tests passing and 18 known-defect specifications (D9 added), as run by Claude on 2026-11-07. Not yet independently re-run: Codex's sandbox could not start Vitest during the S2 reviews.
- A self-test of the known-defect mechanism.
- A manual browser smoke test in `rcsa-portal/tests/browser-smoke/`: 46 assertions on a read-only path. This is **not** acceptance coverage.
- Verification record: `rcsa-portal/docs/verification/2026-11-vite6-upgrade.md`.

**Toolchain:** Vite 6.4.5 · Vitest 4.1.12 · jsdom 25 · React Testing Library 16 · TypeScript 5.9.3. Node 26.13.0 is verified; Node 20 or later is required for tests. There is **no CI yet** and no coverage baseline.

**Dependency audit:** `npm audit` run by Claude on 2026-11-06 in `rcsa-portal/` at `fa8e293`. It has not been verified independently; re-run `npm audit` before relying on these figures. It found 6 advisories (0 critical, 4 high, 2 moderate), all in development tooling (devDependencies):

| Severity | Package | Dependency | Advisories |
|---|---|---|---|
| High | `postcss` | direct | GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 |
| High | `browserslist` | transitive | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g |
| High | `nanoid` | transitive | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8 |
| High | `source-map-js` | transitive | GHSA-68fv-2mgg-jv7q |
| Moderate | `postcss-selector-parser` | transitive | GHSA-rj75-hqrm-r3gf |
| Moderate | `baseline-browser-mapping` | transitive | GHSA-w5vr-8v7q-w6rv |

Claude's earlier audit runs reported the same six packages before the Vite 6 upgrade (`develop` lockfile). Those results were reported in session and not recorded in the repository.

## 4. Known defects with automated tests (18 scenarios, 8 root causes, with S2)

Each scenario is a `knownDefect` spec that pins the **exact** current wrong behaviour. A passing test means the defect **still exists**.

| # | Root cause | Scenarios | Test location |
|---|---|---|---|
| ~~D1~~ | **Fixed by ID-integrity S1** (PR #4, merged into `develop` at `0793830`). Count-based IDs no longer overwrite a live record after a delete. Its 3 known-defect specs are now ordinary regression tests. | 0 | `src/test/regressions/id-collision.test.ts`, `src/data/ids.test.tsx` |
| D8 | **ID reuse (R15).** The ID of the deleted *highest* record can be reissued, so an out-of-date reference to it (an open edit form, another tab) attaches to the new, unrelated record. This affects Risk→Asset and Treatment→Risk. It is closed only by ID-integrity stage S5. Protected. | 2 | `src/test/regressions/id-collision.test.ts` |
| D2 | Editing a risk **drops its custom (non-catalogue) controls**, even when nothing is changed. Protected. | 1 | `src/test/regressions/custom-controls.test.tsx` |
| D3 | RCSA CSV import: an invalid Yes/No asset flag becomes "No" with no error. | 5 | `src/io/import.test.ts` |
| D4 | RCSA CSV import: an invalid score becomes 1, or "not assessed" for residual scores, with no error. | 4 | `src/io/import.test.ts` |
| D5 | Risk export → import resets scores and keeps the apostrophe added to block spreadsheet formulas. Since S2 (create-only), the specs observe the export **with its ID column cleared**, imported as a new record; scores are compared without IDs. **Still open**: removing the update path removed one way to trigger it, not the defect. | 2 | `src/io/import.test.ts` |
| D9 | Treatment export writes the computed `Overdue` status, which the import rejects, so an overdue treatment cannot be re-entered through CSV and its stored status is lost. Added with S2 (decision D5-2). **Unresolved.** | 1 | `src/io/import.test.ts` |
| D6 | KPI history: blank entries are parsed as 0 data points. | 2 | `src/modules/kpis/kpis.test.ts` |
| D7 | Storage write failures are swallowed. On a fresh install, if **only** the treatment-seed write fails while the risk write succeeds, treatments still initialise empty. This is the limit left by the initialisation fix; the root cause is the swallowed-write persistence defect in §5. | 1 | `src/test/regressions/treatment-initialization.test.tsx` |

D1–D6 were the original 17 scenarios. D7 was added with the treatment-initialisation fix. D1's 3 scenarios became regression tests and D8 (2 scenarios) was added, both with ID-integrity S1. D9 (1 scenario) was added with ID-integrity S2, and the D5 specs were redefined on the create-only path.

## 5. Additional verified defects (no automated test yet)

All of these were reported or reproduced by **Codex** during reviews. The last column says what **Claude** has independently confirmed.

| Area | Defect | Claude's confirmation |
|---|---|---|
| Initialisation | **Fixed (PR #3, merged into `develop` at `f5d6df4`).** In a fresh browser, the seeded treatments were lost when risks loaded before treatments, and `[]` was persisted. The fix seeds treatments with risks only when neither is stored, and regression tests cover it. Browsers that already saved `[]` are deliberately **not** repaired automatically: that state can't be told apart from a user deleting every treatment. Use "Reset demo data", which also resets assets and risks. | Reproduced and tested |
| Persistence | Storage write failures are swallowed, so a save can report success and still lose the change (`localStorageRepo.ts:89`, `createLocalRepo.ts`). One consequence is tested as D7. **On the S2 branch, CSV imports no longer use these writes** (checked write with read-back); ordinary form saves, deletes and resets are unchanged. | Code confirmed |
| Persistence | **Notification rendering can seed a missing standalone collection.** `AppShell` renders `buildNotifications` on every render (`components/layout/AppShell.tsx:104`), which calls seven standalone `repo.list()` functions (`components/layout/notifications.ts:39-61`); `list()` seeds a missing key (`createLocalRepo.ts:54-56`). So any re-render, including one after an import, can write an unrelated collection that was missing. Found during the S2 design review; deferred as a separate persistence defect (decision B-4). | Reproduced by Codex (S2 design review, 2026-11-06); code confirmed by Claude |
| Legacy migration | The one-time legacy migration can **permanently lose embedded treatment plans** in two ways:<br>• it writes the cleaned risks even if writing the derived treatments failed (`localStorageRepo.ts:157-158`);<br>• saving a risk before the migration has run persists the cleaned risks without the plans (`saveRisk()`, `localStorageRepo.ts:174`).<br>Only affects browsers that still hold pre-treatment legacy data. | Reported and reproduced by Codex (2026-11-06); code confirmed by Claude |
| Initialisation, other paths | Invalid stored risks with no treatments stored can persist `[]` for both collections. Malformed treatment JSON falls back to the demo treatments, even next to custom risks. Initialisation in two tabs at once can overwrite another tab's save. | Reported by Codex (2026-11-06); not reproduced by Claude |
| Persistence | Two concurrent saves: the second overwrites the first (lost update). | Reported by Codex only; consistent with the code's read-change-write pattern |
| CSV integrity | **Round-trip losses** when an export is re-imported:<br>• asset evidence, and risk evidence and comments, are erased (the exports have no such columns);<br>• a treatment exported with the computed `Overdue` status is rejected on import (pinned as D9, §4);<br>• treatment comments are exported joined with `" \| "` and come back as a single comment.<br>**Still open.** Since S2, an export cannot be re-imported as-is (its ID column blocks the file); with the ID column cleared it is imported as **new** records and these losses apply to the copies. They block any future CSV bulk-update stage. | Code confirmed (`src/csv/export.ts`, `src/io/import.ts`) |
| CSV import (S2 limitations, by design) | On the S2 branch: importing the same rows twice creates duplicate business records with new IDs; CSV import is **not** backup/restore (original IDs are not kept, and references in a file from another browser are resolved against this browser's records); another tab writing between the commit check and the write is not detected (R7); data and audit are separate writes (an audit failure after a saved import is reported, never rolled back); historical IDs that are delimiter-bearing, armored or ambiguous cannot be referenced from CSV. Full list: `docs/ID_INTEGRITY_S2_DESIGN.md` §11. | Documented in the accepted design |
| CSV integrity | The RCSA importer numbers error rows after removing blank lines, so an error is reported against the wrong spreadsheet row (`import.ts:97`). | Code confirmed |
| ID integrity (platform-wide) | Risks R1–R15 are inventoried in `docs/ID_INTEGRITY_DESIGN.md`. **S1 fixed R1/R2 (D1) and R11** (oversized IDs reused or hanging an import). **On the S2 branch (not merged):** duplicate and case-variant IDs in imports (R3, R4) are removed by construction (create-only, allocated IDs), R12 is addressed for references (exact, fail-closed), and the preview-to-commit gap (R8) is addressed by a commit-time recheck with zero writes on refusal. Still open, each for a later approved stage:<br>• upsert re-creating a deleted record (R6);<br>• stale links to deleted records (R13);<br>• ID reuse (R5, R9, R15/D8);<br>• calendar keys across collections (R14);<br>• tab races (R7, which V1 cannot prevent). | Probe-reproduced or code-confirmed by Claude; R11–R15 reproduced by Codex |
| Audit integrity | Audit diffs compare the **140-character truncated** display text, so an edit beyond the first 140 characters is not recorded (`src/audit/auditLog.ts:46`). | Code confirmed |
| Audit integrity | When an asset is deleted, the risks and treatments deleted with it are not audited (`localStorageRepo.ts:198`). | Code confirmed |
| Vulnerability dates | The CSV import accepts any discovery-date text (`src/modules/vulns/io.ts:17`). An invalid date makes the SLA deadline `NaN`, so the record is **never flagged as breached**. | Missing validation confirmed in code; the `NaN` outcome was reproduced by Codex only |
| KPI presentation | A KPI with fewer than 2 history points is shown as "improving" (`src/modules/kpis/KpisPage.tsx:24`). The policy for a target of 0 needs a decision. | Code confirmed (first point only) |

## 6. Immediate priorities

These are **proposed; each needs user approval.** Items 1–4 affect protected areas (`AGENTS.md` rule 2: business rules, persistence, CSV, audit), so each specific change needs explicit authorisation.

1. **Stop the data loss:** ~~D1 (ID allocation)~~ (S1, PR #4, merged into `develop` at `0793830`), D2 (custom controls), then ID-integrity stages S2–S6 (`docs/ID_INTEGRITY_DESIGN.md`). S2 is implemented on `feature/v1-import-id-integrity` and awaits its final branch review and merge.
2. **CSV integrity:** D3–D5, D9, the §5 round-trip losses and the row numbering. These must be fixed before any CSV bulk-update stage.
3. **Persistence:**
   - report storage write failures to the user (this also resolves D7);
   - ~~fix the initialisation order~~ (PR #3, merged into `develop` at `f5d6df4`);
   - make the legacy migration safe against partial writes;
   - audit cascade deletes and compare audit values in full.
4. **Input validation:** vulnerability discovery dates. Decide the KPI zero-target and short-history policy.
5. **Engineering:**
   - CI (type-check, tests, build) and a coverage baseline;
   - the development-dependency advisories (re-audit first; see §3);
   - tests for §5.

When a defect is fixed, convert its `knownDefect` test into a normal regression test (see `rcsa-portal/docs/testing.md`) and update §4 and §5.

## 7. Planned V2: future work, not implemented

None of the following exists in the repository today. Timing is undecided (`PRODUCT.md`).

**Documented in the repository** (`PRODUCT.md`, `rcsa-portal/docs/ldap-ad-integration.md`):
- Shared server-side persistence replacing `localStorage`. The repository interfaces in `src/data/` are the intended seam.
- Server-side authentication against Active Directory or LDAP (handoff notes: `rcsa-portal/docs/ldap-ad-integration.md`), with RBAC enforced on the server.
- A server-side, append-only audit trail.
- Shared multi-user data with protection against concurrent overwrites.

**Proposed technology: not an approved or recorded decision.** The user named a TypeScript/**NestJS** backend, **PostgreSQL** and **AWS** as the target for a migration-readiness review on 2026-11-05. There is no recorded decision that selects them. Treat them as proposals that need the user's approval before any design or implementation work.
