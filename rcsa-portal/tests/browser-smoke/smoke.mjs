// Browser smoke test over the Chrome DevTools Protocol. No npm packages: uses
// Node's built-in fetch + WebSocket. Drives a Chromium browser (Edge/Chrome)
// that is ALREADY running with --remote-debugging-port (run-smoke.ps1 does this).
//
// The report separates three kinds of record:
//   steps         actions that were performed (navigation, clicks). "completed"
//                 means only that the action ran without a timeout/error.
//   assertions    explicit checks with an expected and an actual value, each
//                 PASS or FAIL. Only these are acceptance evidence.
//   observations  facts recorded for comparison (counts, text) that are NOT
//                 asserted — e.g. known pre-existing defects.
// Exit code 1 if any assertion fails or any step errors.
//
// usage: node smoke.mjs <cdpPort> <appUrl> <outDir>
import fs from 'node:fs';
import path from 'node:path';

const [cdpPort, appUrl, outDir] = process.argv.slice(2);
if (!cdpPort || !appUrl || !outDir) {
  console.error('usage: node smoke.mjs <cdpPort> <appUrl> <outDir>');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Expected values (demo seed data; see docs/testing.md) ───────────────────
const ADMIN_NAV = [
  'Dashboard', 'Master Calendar', 'Reports', 'RCSA Dashboard', 'Asset Catalogue', 'Risk Catalogue',
  'Treatment Catalogue', 'Compliance', 'Audit Findings', 'Third-Party Vendors', 'Incidents', 'Vulnerabilities',
  'Policy & Document Control', 'Committee Meetings', 'Access Reviews', 'Department KPIs', 'Yearly Plan',
  'Awareness Training', 'Audit Log', 'Directory', 'Settings',
];
const RESTRICTED_NAV = [
  'Dashboard', 'Master Calendar', 'Reports', 'RCSA Dashboard', 'Asset Catalogue', 'Risk Catalogue',
  'Compliance', 'Audit Findings', 'Third-Party Vendors', 'Access Reviews', 'Settings',
];
const FRAMEWORKS = { 'ISO 27001': [12, 42], 'NIST CSF': [7, 43], 'PCI-DSS': [8, 50], 'SOC 2': [6, 33], GDPR: [6, 17] }; // [controls, coverage %]
const ALLOWED_PROBLEMS = [/^HTTP 404: .*\/favicon\.ico$/]; // pre-existing: the project ships no favicon

// ── CDP plumbing ────────────────────────────────────────────────────────────
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let seq = 0;
const pending = new Map();
const problems = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type))
    problems.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) problems.push(`request failed: ${m.params.errorText}`);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) problems.push(`HTTP ${m.params.response.status}: ${m.params.response.url}`);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n${expr.slice(0, 200)}`);
  return r.result.value;
};
const waitFor = async (expr, label, timeout = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evaluate(`(()=>{try{return !!(${expr})}catch{return false}})()`)) return;
    await sleep(150);
  }
  throw new Error(`timeout waiting for: ${label}`);
};
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
};

const HELPERS = `
window.__t = (s) => (s || '').replace(/\\s+/g, ' ').trim();
window.__btn = (label) => [...document.querySelectorAll('button')].find((b) => __t(b.innerText) === label || b.getAttribute('aria-label') === label);
window.__nav = (label) => [...document.querySelectorAll('aside nav button')].find((b) => __t(b.querySelector('span.flex-1')?.textContent) === label);
window.__navLabels = () => [...document.querySelectorAll('aside nav button span.flex-1')].map((s) => __t(s.textContent));
window.__setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
window.__header = () => __t(document.querySelector('header')?.innerText);
window.__main = () => __t(document.querySelector('main')?.innerText);
`;

// ── Report ──────────────────────────────────────────────────────────────────
const report = { url: appUrl, startedAt: new Date().toISOString(), steps: [], assertions: [], observations: [], problems, pageText: {} };
const step = (name) => { report.steps.push({ name, status: 'completed' }); console.log(`  step  ${name}`); };
const assert = (name, expected, actual) => {
  const pass = JSON.stringify(expected) === JSON.stringify(actual);
  report.assertions.push({ name, pass, expected, actual });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`}`);
};
const observe = (name, value, note) => { report.observations.push({ name, value, ...(note ? { note } : {}) }); };

let fatal = null;
try {
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // 1. Load → login page
  await send('Page.navigate', { url: appUrl });
  await waitFor(`document.body.innerText.includes('Sign in to continue')`, 'login page');
  await evaluate(HELPERS);
  step('load app → login page');
  assert('document title', 'Internal RCSA Portal', await evaluate('document.title'));
  assert('demo accounts listed', 4, await evaluate(`[...document.querySelectorAll('button')].filter(b => b.className.includes('border-t') && b.querySelector('.rounded-full')).length`));
  await shot('01-login');

  // 2. Wrong password
  await evaluate(`__setVal(document.querySelector('input:not([type=password])'), 'rchilingarovi'); __setVal(document.querySelector('input[type=password]'), 'wrong-password'); __btn('Sign in').click();`);
  await waitFor(`document.body.innerText.includes('Incorrect username or password.')`, 'wrong-password error');
  step('submit wrong password');
  assert('wrong password: still on login page', true, await evaluate(`!document.querySelector('aside nav')`));

  // 3. Manual login (demo password read from the page, not hard-coded)
  const demoPw = await evaluate(`document.querySelector('.font-mono')?.textContent.trim()`);
  await evaluate(`__setVal(document.querySelector('input[type=password]'), ${JSON.stringify(demoPw)}); __btn('Sign in').click();`);
  await waitFor(`document.querySelector('aside nav')`, 'app shell after login');
  step('manual login as administrator');
  assert('administrator sidebar modules (exact, in order)', ADMIN_NAV, await evaluate('__navLabels()'));
  assert('signed-in user shown in header', true, await evaluate(`__header().includes('Roberti Chilingarovi')`));
  await shot('02-dashboard');

  // 4. Representative modules
  const PAGES = [
    ['Dashboard', 'dashboard'], ['RCSA Dashboard', 'rcsa-dashboard'], ['Asset Catalogue', 'asset-catalogue'],
    ['Risk Catalogue', 'risk-catalogue'], ['Treatment Catalogue', 'treatment-catalogue'], ['Compliance', 'compliance'],
    ['Vulnerabilities', 'vulns'], ['Department KPIs', 'kpis'], ['Master Calendar', 'calendar'],
    ['Audit Log', 'audit-log'], ['Settings', 'settings'],
  ];
  for (const [label, slug] of PAGES) {
    await evaluate(`__nav(${JSON.stringify(label)}).click()`);
    await waitFor(`__header().startsWith(${JSON.stringify(label)})`, `header for ${label}`);
    await sleep(400);
    step(`navigate → ${label}`);
    assert(`${label}: page header`, label, await evaluate(`__header().slice(0, ${label.length})`));
    assert(`${label}: no "No access" screen`, false, await evaluate(`__main().includes('No access')`));
    observe(`${label}: page facts`, await evaluate(`({ tableRows: document.querySelectorAll('main tbody tr').length, svgs: document.querySelectorAll('main svg').length })`));
    report.pageText[slug] = await evaluate('__main()');
    await shot(`page-${slug}`);
  }
  // Page-specific checks (values from the deterministic demo seed).
  await evaluate(`__nav('Risk Catalogue').click()`);
  await waitFor(`__header().startsWith('Risk Catalogue')`, 'risk catalogue');
  assert('Risk Catalogue: register count', true, await evaluate(`__main().includes('204 risks')`));
  assert('Risk Catalogue: first page shows 25 rows', 25, await evaluate(`document.querySelectorAll('main tbody tr').length`));
  await evaluate(`__nav('Treatment Catalogue').click()`);
  await waitFor(`__header().startsWith('Treatment Catalogue')`, 'treatment catalogue');
  observe('Treatment Catalogue: count text on a fresh browser', await evaluate(`(__main().match(/\\d+ treatments?/) || [''])[0]`),
    'Not asserted. Expected 195 since the treatment-initialisation fix (was 0: seeded treatments were lost when risks loaded first). Unit-tested in treatment-initialization.test.tsx.');

  // 5. Risk edit modal (opened and closed, never saved)
  await evaluate(`__nav('Risk Catalogue').click()`);
  await waitFor(`document.querySelector('[aria-label="Edit risk"]')`, 'risk edit button');
  await evaluate(`document.querySelector('[aria-label="Edit risk"]').click()`);
  await waitFor(`document.body.innerText.includes('Edit Risk — RSK-')`, 'risk modal');
  step('open first risk for editing');
  assert('risk modal title', 'Edit Risk — RSK-001', await evaluate(`(document.body.innerText.match(/Edit Risk — RSK-\\d+/) || [''])[0]`));
  assert('risk modal tabs present', [true, true, true, true], await evaluate(`['Basic Info','Controls','Treatment','Comments'].map(t => !!__btn(t))`));
  await shot('03-risk-modal');
  await evaluate(`__btn('Close').click()`);
  await waitFor(`!document.body.innerText.includes('Edit Risk — RSK-')`, 'risk modal closed');
  step('close risk modal without saving');

  // 6. Compliance
  await evaluate(`__nav('Compliance').click()`);
  await waitFor(`__header().startsWith('Compliance')`, 'compliance');
  const fwBtn = (f) => `[...document.querySelectorAll('main button')].find(b => __t(b.innerText).includes(${JSON.stringify(f)}) && __t(b.innerText).includes('controls'))`;
  for (const [f, [controls, pct]] of Object.entries(FRAMEWORKS)) {
    await waitFor(fwBtn(f), `framework card ${f}`);
    assert(`Compliance ${f}: card coverage`, `${pct}%`, await evaluate(`(__t(${fwBtn(f)}.innerText).match(/\\d+%/) || [''])[0]`));
    await evaluate(`${fwBtn(f)}.click()`);
    await waitFor(`__main().includes(${JSON.stringify(f + ' Controls')})`, `framework ${f}`);
    step(`select framework ${f}`);
    assert(`Compliance ${f}: control rows`, controls, await evaluate(`document.querySelectorAll('main tbody tr').length`));
  }
  await evaluate(`__btn('Gap analysis').click()`);
  await waitFor(`__btn('✓ Gap analysis')`, 'gap analysis on');
  step('enable gap analysis (GDPR)');
  const gapStatuses = await evaluate(`[...document.querySelectorAll('main tbody tr')].map(tr => __t(tr.children[3]?.innerText))`);
  assert('Gap analysis: only In Progress / Not Started rows', true, gapStatuses.length > 0 && gapStatuses.every((s) => s === 'In Progress' || s === 'Not Started'));
  observe('Gap analysis (GDPR) statuses', gapStatuses);

  // 7. Sign out, then one-click demo login as a restricted user
  await evaluate(`__btn('Account menu').click()`);
  await waitFor(`__btn('Sign out')`, 'account menu');
  await evaluate(`__btn('Sign out').click()`);
  await waitFor(`document.body.innerText.includes('Sign in to continue')`, 'login page after sign-out');
  step('sign out');
  assert('after sign-out: shell is gone', true, await evaluate(`!document.querySelector('aside nav')`));
  await evaluate(HELPERS);
  const tamar = `[...document.querySelectorAll('button')].find(b => __t(b.innerText).includes('Tamar Natroshvili'))`;
  await waitFor(tamar, 'demo account button');
  await evaluate(`${tamar}.click()`);
  await waitFor(`document.querySelector('aside nav')`, 'shell for restricted user');
  await evaluate(HELPERS);
  step('one-click demo login as Identity & Access Lead');
  assert('restricted user sidebar modules (exact, in order)', RESTRICTED_NAV, await evaluate('__navLabels()'));
  await evaluate(`__nav('Third-Party Vendors').click()`);
  await waitFor(`__header().startsWith('Third-Party Vendors')`, 'vendors');
  step('restricted user opens Third-Party Vendors');
  assert('Vendors: rows for restricted user', 6, await evaluate(`document.querySelectorAll('main tbody tr').length`));
  await shot('04-restricted-vendors');
} catch (e) {
  fatal = String(e?.stack ?? e);
  report.steps.push({ name: 'ERROR', status: 'failed', error: fatal });
  console.log(`  ERROR ${fatal}`);
}

const unexpected = problems.filter((p) => !ALLOWED_PROBLEMS.some((re) => re.test(p)));
assert('browser: no console errors, exceptions or failed requests (favicon 404 allow-listed)', [], unexpected);
observe('browser problems incl. allow-listed', problems);

report.finishedAt = new Date().toISOString();
report.summary = {
  stepsCompleted: report.steps.filter((s) => s.status === 'completed').length,
  stepErrors: report.steps.filter((s) => s.status === 'failed').length,
  assertionsPassed: report.assertions.filter((a) => a.pass).length,
  assertionsFailed: report.assertions.filter((a) => !a.pass).length,
  observations: report.observations.length,
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nsummary: ${JSON.stringify(report.summary)}`);
ws.close();
process.exit(fatal || report.summary.assertionsFailed ? 1 : 0);
