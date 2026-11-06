# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (confirmed): the Information Security / GRC team.** Security analysts, GRC
editors and security architects who maintain the department's registers day to day —
risks, treatments, incidents, vulnerabilities, audit findings, vendors, policies,
access-review campaigns, KPIs, the annual plan and awareness programmes.

They work from desktops during the working day, usually with several registers open at
once, and are the people who answer "what is our exposure right now?" and "what is
overdue?".

Other roles exist in the system as seeded accounts and access levels (a CISO /
administrator persona, an identity & access lead, and a read-only internal auditor),
and the RBAC model supports admin / editor / viewer per module. Whether people outside
the InfoSec team — asset owners elsewhere in the bank, management, external auditors —
become real day-to-day users is **not yet decided** and must not be assumed by future
work.

## Product Purpose

A single in-house InfoSec portal that moves the department **off scattered documents
(Word, Excel, email attachments) and onto one service**. That is the confirmed north
star: every register that used to be a spreadsheet lives here, with the derived views
(dashboards, calendar, reports) generated from that same data rather than re-typed.

Success = the team stops maintaining parallel spreadsheets, and answers about posture,
overdue work and upcoming deadlines come from the portal.

## Positioning

Purpose-built for one financial institution's InfoSec department rather than a generic
GRC suite: the modules mirror how this team actually works (RCSA asset → risk →
treatment chain, regulator/audit findings, vulnerability remediation SLAs), and the
cross-service layers (executive dashboard, master calendar, report builder) aggregate
those registers automatically instead of asking anyone to assemble a pack by hand.

## Operating Context

- **Sector:** a financial institution's information-security function. Compliance work
  spans multiple frameworks configured in the product: ISO 27001, NIST CSF, PCI-DSS,
  SOC 2 and GDPR (SWIFT CSP appears in seeded audit context).
- **Regulatory / assurance rituals:** regulator inspections, internal audit and
  external audit produce findings with remediation owners and deadlines; periodic
  access-review campaigns; policy/document review cycles; committee meetings with
  decisions and open actions; vendor contract renewals; awareness campaigns.
- **Timezone:** the team operates in **GMT+4**; all date logic is computed in local
  time (a deliberate fix — UTC-based dates shifted deadlines by a day).
- **Displacement target:** spreadsheets and documents. CSV import/export exists on
  every standalone register precisely so existing Excel content can be brought in and
  taken back out.
- **Deployment today:** run locally and served over the office network for
  demonstration; not yet a hosted production service.

## Capabilities and Constraints

**Confirmed capabilities (all live):**

- **Overview group:** executive Dashboard (cross-service posture), Master Calendar
  (every dated obligation across modules), Reports (section-configurable, print /
  save-as-PDF).
- **RCSA:** RCSA Dashboard with cross-filtering charts, Asset Catalogue (C·I·A →
  criticality), Risk Catalogue (inherent + optional residual scoring, decisions),
  Treatment Catalogue (plans addressing one or more risks).
- **Risk & Compliance:** Compliance (multi-framework control coverage and gaps), Audit
  Findings (regulator / internal / external / self-identified, with remediation owner
  and deadline), Third-Party Vendors (criticality, residual score, contract renewals).
- **Security Operations:** Incidents (tracking, pipeline, time-to-closure),
  Vulnerabilities (scan / pentest findings with severity-based remediation SLAs —
  deadline derived from discovery date, breaches flagged).
- **Governance:** Policy & Document Control, Committee Meetings, Access Reviews.
- **Planning & Performance:** Department KPIs (RAG, direction-aware), Yearly Plan,
  Awareness Training.
- **Administration:** Audit Log (field-level change diffs), Directory (AD-shaped
  identities and group→role mapping), Settings (profile + per-module access control).
- **Cross-cutting:** per-module RBAC (view/create/edit/delete/export), CSV
  import/export with validation and preview, notification bell derived from real
  overdue data, light/dark theming, collapsible sidebar, drag-to-reorder dashboard
  panels.

**Terminology that must stay exact:** RCSA (Risk & Control Self-Assessment); asset
value = C×I×A; inherent vs **residual** risk (residual is optional — unassessed risks
are excluded from residual rollups); treatment (a plan addressing one or more risks);
finding (audit/regulator); vulnerability (scan/pentest); SLA breach; coverage
(implemented ÷ applicable controls).

**Technical constraints:**

- Vite + React 18 + TypeScript (strict) + Tailwind; runtime dependencies deliberately
  minimal (react + react-dom only — a charting library was removed to reduce
  third-party/audit surface). Charts are hand-built on shared primitives.
- **Data is currently browser-local (localStorage) and per-device.** The architecture
  is deliberately migration-ready: one persistence seam per area, an async repository
  contract, and an identity seam intended for Active Directory. Moving to a shared
  database and real AD authentication is a known, planned direction — **undecided in
  timing**, and no current claim of production readiness should be made.
- Authentication and RBAC today are demo-grade (client-side); they are a UX gate, not
  an enforced security control. This is documented, not hidden.
- Three modules — **Risk Catalogue, Treatment Catalogue, Compliance** — are
  change-protected: their business logic must stay byte-identical unless explicitly
  authorized; only mechanical changes are allowed.
- An automated test suite (Vitest) covers the core scoring, status, coverage,
  KPI, SLA and CSV-import rules, plus documented known defects
  (`docs/testing.md`). Coverage of the wider platform is still partial: no CI,
  no coverage baseline yet.

## Brand Commitments

- Product name in the interface: **InfoSec Portal** ("Information Security platform").
- **Honest-data rule (binding):** every figure shown must derive from real records.
  No fabricated trends, sample numbers, or placeholder metrics — where history does not
  exist yet, the product says so rather than inventing a trend.
- No security theater: demo-grade limitations are stated plainly in the product and its
  documentation.

## Evidence on Hand

- A working implementation of every module listed above (this repository), with seeded,
  **sanitized demo data** — the seeded people, vendors, incidents and findings are
  fictional and must never be presented as real bank records.
- A production-readiness audit of the codebase exists (`audit/PRODUCTION_READINESS_REPORT.md`,
  outside this project root) covering code quality, database-migration readiness and AD
  integration.
- An Active Directory / LDAP integration handoff note: `docs/ldap-ad-integration.md`.
- **Absent — must not be fabricated:** real customer/user testimonials, benchmarks,
  uptime or performance claims, certification status, pricing, licensing, and any
  statement that the portal is in production use.

## Product Principles

1. **Documents → service.** Every feature should remove a spreadsheet, a Word file or
   an email thread from the team's workflow. If it does not, question it.
2. **Real data or nothing.** Derive every number from records in the system; never
   fabricate a trend, count or benchmark to make a view look complete.
3. **Migration-ready by construction.** Persistence, identity and audit each go through
   a single seam. Never scatter storage or auth access through the UI — moving to a
   shared database and AD must stay a small, contained change.
4. **Modules stay decoupled; aggregation is a separate layer.** A module never reaches
   into another module's internals; cross-service views are built by pure aggregation
   functions that are handed data.
5. **Be explicit about what is demo-grade.** State limitations (client-side auth,
   local storage, tamper-able audit trail) rather than implying assurance the product
   does not yet provide.

## Accessibility & Inclusion

No product-specific accessibility standard has been established with the user yet. Known
state: the interface uses semantic tables and buttons with aria-labels and supports a
light and a dark theme, but **no formal accessibility pass has been done**, and some
interactions (drag-to-reorder dashboard panels, dense register tables) are effectively
desktop-only. Treat a formal standard as an **open decision**, not an assumption.
