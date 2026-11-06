# Verification record: Vite 5.4.21 → 6.4.5, Vitest 3.2.7 → 4.1.12

Branch `feature/v1-automated-tests`. Uncommitted at the time of writing.

This record **corrects the wording** of the upgrade report delivered on
2026-11-05, and records the browser smoke runs of 2026-11-06.

## Corrections to the 2026-11-05 report

| The 2026-11-05 report said | Precise statement |
|---|---|
| "All 19 steps pass" | 19 **steps completed**: each action ran without a timeout or error. The script made **no explicit assertions** that day. Its only checks were the `waitFor` conditions each step needed to continue, such as "the page header shows the module name". Counts and texts were *recorded*, not compared with expected values. |
| "Identical results … 21,833 characters of visible page text" | 21,833 was the **total length**, given for orientation, and equal length proves nothing. The comparison itself was **exact string equality per page**, and found 10/11 pages identical; the 11th differed by a wall-clock timestamp. That script printed only the first difference on each page, so other differences on the same page could not be ruled out at the time. The 2026-11-06 runs below close that gap with `--mask-clock`. |
| Browser verification results | They were **evidence saved by Claude** from runs on the development machine, using scripts kept in the session scratchpad. **No reviewer re-ran them independently.** The scripts are now in the repository (`tests/browser-smoke/`) so they can be re-run. |

## Browser smoke runs: 2026-11-06 (Claude, repository scripts)

Script: `tests/browser-smoke/smoke.mjs` with explicit assertions. Headless Edge
with a fresh profile. Node 26.13.0. Windows 11.

| Target | Steps completed | Assertions | Unexpected browser problems |
|---|---|---|---|
| Vite 6.4.5 dev server | 25 | **46 / 46 pass** | 0 |
| Vite 6.4.5 production build (`vite preview`) | 25 | **46 / 46 pass** | 0 |
| Vite 5.4.21 dev server (reference copy built from `develop`'s lockfile, same source) | 25 | **46 / 46 pass** | 0 |
| Vite 5.4.21 production build (reference) | 25 | **46 / 46 pass** | 0 |

The `/favicon.ico` 404 appeared in all four runs. It predates the upgrade (the
project has no favicon) and is allow-listed.

`compare-smoke.mjs`, in every pairing (V5 vs V6 dev, V5 vs V6 production, V6 dev
vs V6 production):
- **Assertions:** identical, including their actual values.
- **Page text, exact and unmasked:** 9–10 of 11 pages identical. The remaining
  pages differ only at a wall-clock timestamp, shown as the first difference.
- **Page text with `--mask-clock`:** **11 / 11 pages identical**, after masking
  4 timestamps per pairing. Nothing else is masked.

Observed in every run and **not caused by the upgrade**: on a fresh browser the
Treatment Catalogue shows "0 treatments". This is the pre-existing
initialisation defect (seeded treatments are lost when risks load first). It is
recorded as an observation, not asserted.

**Coverage limits.** This is a read-only smoke path over 11 of the 21 modules
plus the restricted-user view. It is **not** full browser acceptance coverage.
See `tests/browser-smoke/README.md`.

## Production assets

- **2026-11-05:** the Vite 6 output was analysed against Vite 5. Every
  string/number/regex literal value is the same; there are 12 whitespace-only
  CSS changes; the app module list is the same, with only React's CommonJS
  wrappers differing.
- **2026-11-06:** a build was found to contain one extra CSS rule,
  `.grow{flex-grow:1}`. Tailwind had scanned a **test file** whose comment
  contained the word "grow". This was fixed in configuration:
  `tailwind.config.js` now excludes `src/**/*.test.{ts,tsx}` and `src/test/**`
  from the content scan. After the fix, `index.html`, the JS
  (`index-Bc6t_krZ.js`) and the CSS (`index-BzDvlIDf.css`) are
  **byte-identical (SHA-256)** to the approved 2026-11-05 Vite 6 build.
