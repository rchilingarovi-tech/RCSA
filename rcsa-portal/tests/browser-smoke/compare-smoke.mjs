// Compare two smoke-test reports (e.g. Vite 5 vs Vite 6, or dev vs production).
//
// What is compared, and how:
//   • assertions    — name, pass/fail, expected and ACTUAL value, exactly.
//   • page text     — the full visible text of every page, by exact string
//                     equality. Lengths are printed for orientation only and are
//                     NOT evidence of equality (equal length ≠ equal content).
//   • observations  — exactly.
// Port numbers in URLs are normalised. Differences are printed with context.
// Exit code 1 if anything differs, so time-dependent text (timestamps) shows up
// as a listed difference to be judged, never silently ignored.
//
// Only the FIRST difference on a page is printed. To make sure nothing else
// differs on a page whose only expected difference is the clock, run again with
// --mask-clock: it replaces exactly two wall-clock formats ("11/6/2026, 9:51:49 AM"
// and "Nov 06, 2026 09:51 AM") with <CLOCK>, reports how many were masked, and
// compares the rest of the text exactly.
//
// usage: node compare-smoke.mjs <reportA.json> <reportB.json> [--mask-clock]
import fs from 'node:fs';

const args = process.argv.slice(2);
const maskClock = args.includes('--mask-clock');
const [fa, fb] = args.filter((a) => !a.startsWith('--'));
const CLOCKS = [/\b\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M\b/g, /\b[A-Z][a-z]{2} \d{2}, \d{4} \d{2}:\d{2} [AP]M\b/g];
let masked = 0;
const mask = (s) => (maskClock ? CLOCKS.reduce((t, re) => t.replace(re, () => { masked += 1; return '<CLOCK>'; }), s) : s);
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/localhost:\d+/g, 'localhost:PORT'));
const A = load(fa);
const B = load(fb);
const diffs = [];

const byName = (xs) => new Map(xs.map((x) => [x.name, x]));
for (const kind of ['assertions', 'observations']) {
  const a = byName(A[kind] ?? []);
  const b = byName(B[kind] ?? []);
  for (const name of new Set([...a.keys(), ...b.keys()])) {
    const ja = JSON.stringify(a.get(name) ?? null);
    const jb = JSON.stringify(b.get(name) ?? null);
    if (ja !== jb) diffs.push(`${kind.toUpperCase()} [${name}]\n    A: ${ja.slice(0, 300)}\n    B: ${jb.slice(0, 300)}`);
  }
}

const pages = [...new Set([...Object.keys(A.pageText ?? {}), ...Object.keys(B.pageText ?? {})])];
let identical = 0;
for (const p of pages) {
  const a = mask(A.pageText?.[p] ?? '');
  const b = mask(B.pageText?.[p] ?? '');
  if (a === b) { identical += 1; continue; }
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  diffs.push(`PAGE TEXT [${p}] (lengths A=${a.length} B=${b.length}) first difference at char ${i}\n    A: …${a.slice(Math.max(0, i - 60), i + 80)}…\n    B: …${b.slice(Math.max(0, i - 60), i + 80)}…`);
}

console.log(`assertions A: ${A.summary?.assertionsPassed}/${A.assertions?.length} pass   B: ${B.summary?.assertionsPassed}/${B.assertions?.length} pass`);
console.log(`pages with IDENTICAL text content: ${identical}/${pages.length}${maskClock ? ` (after masking ${masked} wall-clock timestamp(s) — nothing else is masked)` : ' (exact, unmasked)'}`);
console.log(diffs.length === 0 ? 'RESULT: identical' : `RESULT: ${diffs.length} difference(s):`);
diffs.forEach((d) => console.log('  ' + d));
process.exit(diffs.length ? 1 : 0);
