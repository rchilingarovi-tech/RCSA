# Automated tests

Vitest + jsdom + React Testing Library. Test files live next to the code they
cover (`*.test.ts` / `*.test.tsx`); shared harness code is in `src/test/`.
Tests never change application behaviour: they only import and exercise it.

## Commands

| Command | What it does | Expected result today |
|---|---|---|
| `npm test` | Normal run. Ordinary tests plus known-defect tests (see below). | **All green.** |
| `npm run test:defects` | Defect mode. Each known defect runs its scenario, its invariants and its correct-behaviour assertion as an ordinary test, so the real assertion failure (the evidence of each bug) is printed. | **Exactly the known defects fail** (currently 17); everything else passes. A non-zero exit code is expected here. |
| `npm run test:watch` | Watch mode for local development. | — |
| `npm run build` | Type-checks application **and** test files (`tsc --noEmit`, strict), then builds. Test code is never bundled, and test files are excluded from Tailwind's class scan (`tailwind.config.js`), so they cannot change the production CSS. | Green. |

A separate **browser smoke test** (not part of `npm test`, read-only, with
limited coverage) lives in `tests/browser-smoke/`. See its README for what it
asserts and what it does not.

## Reading the results

A green `npm test` means: every ordinary test passed **and** every known defect
still reproduces exactly as documented. It does **not** mean every application
behaviour is correct. The known-defect tests are listed in the output with the
prefix `[known defect]`.

## Known-defect tests

A known-defect test documents a confirmed, not-yet-fixed bug. It is declared as
a **structured specification** with `knownDefect(name, spec)` from
`src/test/helpers.ts`. It is never a test body whose failure message gets
pattern-matched:

| Field | Purpose |
|---|---|
| `observe()` | Runs the scenario and returns what happened. |
| `invariants(o)` | Facts that hold **both** while the bug exists **and** after a correct fix: the record exists, the row is imported or reported, the update hit the right record, the scenario really ran. Checked first, on every run. |
| `correct(o)` | Asserts the correct behaviour. It must currently fail. |
| `symptom(o)` + `documented` | A projection of the observation, plus the **exact** wrong value the app produces today, compared with strict deep equality. |

Under `npm test` a known-defect test is green **only** if the scenario ran,
every invariant held, the correct assertion failed, **and** the observed wrong
behaviour equals the documented one exactly. Otherwise it goes red:

| Situation | Message |
|---|---|
| The bug is fixed (`correct` passes) | `Known defect no longer reproduces …`. Convert it to a normal regression test: assert `correct` with `it`, and keep the invariants. |
| The behaviour is wrong in a *different* way (e.g. other wrong scores) | `Known defect changed symptom …`, with the expected and actual values. |
| A prerequisite or invariant fails (e.g. the imported row is missing, the row was silently discarded) | `Known-defect invariant failed …` |
| The scenario crashed (TypeError, render failure, Testing Library timeout) | The original error is re-thrown, never mistaken for the defect. |

Earlier versions matched the assertion **message**. That accepted false
positives: a different wrong score, a missing imported row, and a row discarded
without diagnostics all produced a matching message. These exact scenarios are
now negative self-tests in `src/test/helpers.test.ts`. They take the **real**
specs from `src/test/defects/rcsaImport.ts`, keep the specs unchanged, swap in a
fabricated observation, and require rejection. The same file proves that the
correct outcome is reported as "no longer reproduces". For the ID-collision
defects, `id-collision.test.ts` runs the same scenarios, invariants and correct
assertions with a *correct* allocator. A real fix would therefore flip those
tests to "no longer reproduces". The invariants also check that the new record
is persisted exactly once, exactly as created.

### Current known defects (17 scenarios, 7 root causes)

| Root cause | Scenarios | File |
|---|---|---|
| ID reuse (R15): S1 can reissue the ID of the deleted highest record, so an out-of-date reference to it attaches to a new, unrelated record (Risk→Asset, Treatment→Risk). Closed only by ID-integrity stage S5 (`docs/ID_INTEGRITY_DESIGN.md`). | 2 | `src/test/regressions/id-collision.test.ts` |
| Editing a risk drops its custom (non-catalogue) controls | 1 | `src/test/regressions/custom-controls.test.tsx` |
| RCSA CSV import: invalid Yes/No asset flags silently become "No" | 5 | `src/io/import.test.ts` |
| RCSA CSV import: invalid inherent/residual scores silently become 1 / "not assessed" | 4 | `src/io/import.test.ts` |
| Risk CSV export → import loses scores and keeps the formula-guard apostrophe | 2 | `src/io/import.test.ts` |
| KPI history: blank entries parse as 0 data points | 2 | `src/modules/kpis/kpis.test.ts` |
| Storage write failures are swallowed: on a fresh install, if **only** the treatment-seed write fails, treatments still initialise empty. This is the limit left by the treatment-initialisation fix. | 1 | `src/test/regressions/treatment-initialization.test.tsx` |

**Fixed and converted:** the 3 ID-collision scenarios (D1: count-based IDs
overwriting a live record) became ordinary regression tests when ID-integrity
stage S1 landed. They live in `id-collision.test.ts`, with the allocator tests
in `src/data/ids.test.tsx`.

`treatment-initialization.test.tsx` also contains **ordinary** regression tests
for the fixed fresh-install defect. They use the real `AppStore`, every load
order, and exact saved records and risk links. Guard tests cover the legacy
migration, existing data and reset.

## Environment

- **Time zone.** Tests run in `Asia/Tbilisi` (GMT+4), set in `vitest.config.ts`,
  because the app's date rules are local-time. Date tests freeze the clock with
  `freezeLocalTime()`.
- **Browser storage.** Every test starts with empty `localStorage` and `sessionStorage` (`src/test/setup.ts`).
- **jsdom gaps.** `setup.ts` adds `Blob.text()` and `URL.createObjectURL` /
  `revokeObjectURL`, which browsers have and jsdom 25 lacks. No business logic
  is mocked.

## Supported Node versions

| Node | Status |
|---|---|
| **26.13.0** | **Verified** (development machine). |
| 22.x and 24.x LTS | Expected to work: within the declared `engines` of Vitest 4.1, Vite 6.4 and jsdom 25. **Not yet verified.** |
| 20.x | Allowed by the dependencies' `engines`, but Node 20 is end-of-life. Not recommended. |
| 18.x and older | **Not supported for tests** (Vitest 4 requires Node 20+). Vite 6 itself still accepts Node 18. |

Toolchain: Vite 6.4 (build and dev server), Vitest 4.1, jsdom 25, React Testing
Library 16.

Node 25+ enables its own experimental `localStorage` global, which hides
jsdom's. `vitest.config.ts` passes `--no-experimental-webstorage` to test
workers through the top-level `execArgv` option. (Vitest 4 removed
`poolOptions`; on Vitest 3 the same setting lived under
`poolOptions.forks.execArgv`.) The flag is detected through `process.allowedNodeEnvironmentFlags`, so
it is only used on Node versions that recognise it (22.4+).

The machine's Node is installed through **fnm**. If `node`/`npm` aren't found,
run `fnm env --use-on-cd | Out-String | Invoke-Expression` (PowerShell) first.
