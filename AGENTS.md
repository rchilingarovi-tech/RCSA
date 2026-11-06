# AGENTS.md: shared rules for AI assistants (canonical)

This file is the **single source of the shared rules** for both Codex and Claude
Code. `CLAUDE.md` imports it. Process detail lives in
[`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md). Project state lives in
[`docs/DEVELOPMENT_STATUS.md`](docs/DEVELOPMENT_STATUS.md).

## Project in one paragraph

RCSA is an in-house Information Security Management Platform ("InfoSec
Portal"). V1 is a **frontend-only prototype**: React 18 + TypeScript + Vite, with
all data in browser `localStorage`, seeded with fictional demo data, and
client-side demo authentication. It is **not approved for real organisational
or customer data**. The application lives in `rcsa-portal/`. Product intent and
terminology are in `rcsa-portal/PRODUCT.md`.

## Commands (run from `rcsa-portal/`)

| Command | Purpose |
|---|---|
| `npm test` | Vitest suite. Green = ordinary tests pass **and** every documented known defect still reproduces exactly. |
| `npm run test:defects` | Shows the evidence for each known defect: exactly the known-defect tests fail. |
| `npm run build` | Strict type-check of the app **and** the tests, then a production build. |
| `npm run lint` | Type-check only. |

Testing rules and the known-defect mechanism are described in
`rcsa-portal/docs/testing.md`. The browser smoke test (manual, read-only) is in
`rcsa-portal/tests/browser-smoke/`.

## Non-negotiable rules

1. **Preserve existing functionality.** Change behaviour only when the user has explicitly authorised it.
2. **Protected areas.** Changes that affect **business rules, data integrity, persisted records, access control or audit behaviour** need the user's **explicit authorisation for that specific change**. That includes fixes for known defects. Protection does **not** forbid improvements or fixes; it means asking first.

   Paths below are relative to `rcsa-portal/src/`. They were verified against the repository on 2026-11-06.

   | Area | Paths |
   |---|---|
   | Risk scoring, asset criticality, treatment status and catalogue rules | `domain/scoring.ts`, `domain/constants.ts`, `state/filters.ts` |
   | Risk, Treatment and Asset forms and catalogues | `components/risks/`, `components/treatments/`, `components/assets/`, `modules/rcsa/RiskCataloguePage.tsx`, `modules/rcsa/TreatmentCataloguePage.tsx` |
   | Compliance rules (coverage, controls) | `modules/compliance/` |
   | Data models | `data/models.ts`, plus each module's `modules/*/types.ts` where it defines persisted records |
   | Repositories and persistence | `data/` (`repository.ts`, `localStorageRepo.ts`, `createLocalRepo.ts`, `index.ts`, `seed.ts`), `modules/*/repo.ts`, `state/AppStore.tsx`, the delete and save orchestration in `state/ModalsProvider.tsx` |
   | CSV import, export and data transformation | `io/import.ts`, `io/templates.ts`, `csv/export.ts`, `lib/tableIo.ts`, `lib/csv.ts`, `modules/*/io.ts` |
   | Authentication and authorisation | `auth/`, `components/auth/LoginPage.tsx`, `modules/settings/`, `config.ts`, module gating in `modules/registry.tsx` and `components/layout/AppShell.tsx`, and any permission check (`can`, `canView`, `usePermissions`) wherever it is called |
   | Audit integrity | `audit/auditLog.ts`, `modules/audit/AuditPage.tsx`, the audit calls and redaction settings in the repositories |

   If unsure whether a change is covered, ask.
3. **Git.** No commits, pushes, merges, rebases, history rewrites or branch deletions without the user's approval for that specific action. Never push to `main` or `develop`.
4. **Branches.** Work on a feature branch created from the **latest `develop`**. Review feature work against **`develop`**, not `main`. `main` is the stable baseline.
5. **No unapproved scope.** Get approval before installing or upgrading dependencies, making architectural changes, or making security-sensitive configuration changes (auth, permissions, CSP, build or deploy settings).
6. **No automation that bypasses the user.** Don't enable automatic commits, pushes, merges, unrestricted permission or sandbox modes, or the Codex stop-time review gate unless the user asks.
7. **Data.** Demo data only. Never add, request or process real organisational, employee or customer data in V1.
8. **Secrets.** Never read, print or commit credentials, tokens or `.env` contents.

## Verification and reporting

- **Say what you actually ran.** Report each test, build or browser check as **executed by you** (with the real command and result) or **reported by someone else** (another agent, an earlier session). Never present a reported result as your own.
- **Known defects are not fixes.** A green `npm test` includes passing *known-defect* tests, which prove that a bug **still exists exactly as documented**. Never describe them as fixed. A defect is fixed only when its `knownDefect` test is converted to an ordinary regression test and passes.
- **No overclaiming.** Completed steps are not assertions, equal lengths are not equal content, and a smoke test is not acceptance coverage.
- **Stop and ask** on unexpected changes, unclear scope, or anything that would touch a protected area (rule 2).
- Unfinished work is never presented as done. If a session ends mid-task, hand over (see `docs/AI_HANDOFF.md`).

## Roles

Claude normally **implements**; Codex normally **reviews independently and
read-only**. The user can swap roles for a task. Neither assistant hands work
to the other without the user's authorisation.

When reviewing:
- Review `develop...<feature-branch>`, plus all staged (`git diff --cached`), unstaged and untracked changes.
- Rank findings by severity, each with a file and line.
- Mark each finding *verified* (reproduced or confirmed in code) or *plausible*.
- Don't modify files during a review.
