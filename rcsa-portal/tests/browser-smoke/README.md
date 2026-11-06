# Browser smoke test

A **smoke test**, not an acceptance suite. It checks that the app loads in a real
Chromium browser and that a fixed, read-only path through it works. It is useful
for toolchain changes (for example the Vite 5 → 6 upgrade), where the question is
whether the same app still behaves the same. It does not show that the
application is functionally correct.

Not part of `npm test`. It needs a running app server and a local browser.

## Run it

```powershell
# 1. Serve the app (one of):
npm run dev -- --port 5181 --strictPort          # dev server
npm run build; npm run preview -- --port 5183    # production build

# 2. In another shell (Node 22+ and Edge or Chrome required):
.\tests\browser-smoke\run-smoke.ps1 -Url http://localhost:5181/ -Out C:\temp\smoke-dev

# 3. Optional: compare two runs (e.g. before/after a toolchain change):
node tests\browser-smoke\compare-smoke.mjs C:\temp\smoke-A\report.json C:\temp\smoke-B\report.json --mask-clock
```

`run-smoke.ps1` starts a headless browser with a **fresh, throw-away profile**
(so the demo seed data is loaded), runs `smoke.mjs`, then closes the browser and
deletes the profile. The exit code is non-zero if any assertion fails or any
step errors.

## What the report contains

`report.json` separates three kinds of record. Only the second counts as evidence.

| Section | Meaning | Is it evidence? |
|---|---|---|
| `steps` | Actions performed (navigate, click, sign in). `completed` means only that the action ran without a timeout or error. | **No.** A completed step asserts nothing by itself. |
| `assertions` | Explicit checks, each with an `expected` and an `actual` value and a PASS/FAIL result. | **Yes.** |
| `observations` | Recorded facts that are *not* asserted: per-page row and SVG counts, gap-analysis statuses, browser problems including allow-listed ones. A known pre-existing defect is recorded here too: a fresh profile shows 0 treatments. | **No.** These are kept for comparison only. |
| `pageText` | The full visible text of each visited page. | Only through `compare-smoke.mjs`. |

`compare-smoke.mjs` compares assertions (including their actual values) and
observations exactly. It compares page text by **exact string equality**.
Text lengths are printed for orientation only. **Equal length is not equal
content**, and no conclusion is drawn from lengths. It prints only the first
difference on each page. `--mask-clock` replaces exactly two wall-clock
timestamp formats with `<CLOCK>` and says how many it masked, so that a page
whose only expected difference is the time can be confirmed identical
everywhere else.

## What it asserts (46 assertions)

- **Login page:** the document title, and 4 demo accounts listed.
- **Wrong password:** the user stays on the login page.
- **Manual admin login:** the exact list of 21 sidebar modules, in order, and the signed-in user's name in the header.
- **11 modules visited through the sidebar** (Dashboard, RCSA Dashboard, Asset, Risk and Treatment Catalogue, Compliance, Vulnerabilities, KPIs, Master Calendar, Audit Log, Settings): each page's header, and no "No access" screen.
- **Risk Catalogue:** "204 risks" and 25 rows on the first page.
- **Risk edit modal:** the title "Edit Risk — RSK-001" and all 4 tabs. It is closed without saving.
- **Compliance, all 5 frameworks:** each card's coverage % (42/43/50/33/17) and its row count (12/7/8/6/6).
- **Gap analysis:** shows only In Progress and Not Started rows.
- **Sign out:** the app shell is gone.
- **One-click login as the restricted Identity & Access user:** the exact list of 11 sidebar modules (Incidents absent), and 6 rows in Vendors.
- **Browser health:** no console errors or warnings, no exceptions, no failed requests. The missing `/favicon.ico` (404) is allow-listed because the project ships no favicon.

## Limitations (it does not provide full browser acceptance coverage)

- **Read-only path only.** It does not create, edit, save or delete anything, and does not run an import, an export or a download. It does not check persistence across reloads, and does not exercise "Reset demo data".
- **Partial module coverage.** It visits 11 of the 21 modules plus the restricted view. It does not open Reports, Incidents, Audit Findings, Policies, Committee, Access Reviews, Yearly Plan, Awareness or Directory.
- **Values are not checked against business rules.** Expected values come from the deterministic demo seed. Apart from those, it checks presence and counts. It does not validate charts, KPI figures, dashboard numbers or calendar entries.
- **No visual comparison.** Screenshots are saved for people to look at; they are not diffed automatically.
- **One environment.** Headless Chromium (Edge or Chrome) at 1440×900 in a single locale and timezone (the machine's). There's no Firefox or Safari, no mobile or narrow viewport, and no accessibility or keyboard-only check.
- **Brittle selectors.** It finds elements by visible text, ARIA labels and some CSS classes, so a copy change can break a step without any regression. It uses short fixed waits (about 400 ms) for charts to settle.
- **Demo-only flows.** It reads the demo password from the login page and uses one-click demo login. Neither exists in a real AD-backed deployment.
- **Windows runner.** `run-smoke.ps1` is PowerShell and uses Windows process management. `smoke.mjs` itself is cross-platform, given any Chromium already started with `--remote-debugging-port`.
- **A single run of a time-dependent page.** Dates are relative to the real clock, so text and counts that depend on "today" can change between days.
