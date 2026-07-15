import { useMemo, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { useSession } from '../../auth/AuthProvider';
import { usePermissions } from '../../auth/usePermissions';
import { PageHeader } from '../rcsa/PageHeader';
import { residualScore, riskLevel, today } from '../../domain/scoring';
import { incidentRepo } from '../incidents/repo';
import { daysOpen, isOpen, type Incident } from '../incidents/types';
import { vendorRepo } from '../vendors/repo';
import { policyRepo } from '../policies/repo';
import { accessRepo } from '../access/repo';
import { kpiRepo } from '../kpis/repo';
import { committeeRepo } from '../committee/repo';
import { awarenessRepo } from '../awareness/repo';
import { complianceRepo } from '../compliance/repo';
import { FRAMEWORKS, coverage } from '../compliance/types';
import { findingsRepo } from '../findings/repo';
import { isOpenFinding, overdueDays as findingOverdueDays, overdue as findingOverdue } from '../findings/types';
import { vulnRepo } from '../vulns/repo';
import { isOpenVuln, slaDaysLeft, slaDeadline } from '../vulns/types';
import {
  buildAttentionItems,
  buildUpcoming,
  headline,
  residualLevel,
  serviceHealth,
  type OverviewData,
} from '../overview/aggregate';

// Reports — build a board-ready status report and print / save it as PDF via the
// browser's print dialog. The report is a DOCUMENT: it uses fixed print-safe
// colours (not theme tokens), so the preview matches the printout exactly, in
// light or dark mode. No PDF libraries — the print engine renders our visuals
// vector-sharp.

// Print-safe palette (colour = meaning, same policy as the app).
const C = {
  crit: '#dc2626',
  high: '#ea580c',
  med: '#d97706',
  low: '#16a34a',
  info: '#2563eb',
  purple: '#9333ea',
  text: '#1e293b',
  mut: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  bg: '#f8fafc',
};

const SECTIONS: { id: string; label: string }[] = [
  { id: 'exec', label: 'Executive summary' },
  { id: 'health', label: 'Service health' },
  { id: 'attention', label: 'CISO attention items' },
  { id: 'rcsa', label: 'RCSA risk summary' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'vulns', label: 'Vulnerability SLA status' },
  { id: 'findings', label: 'Audit findings' },
  { id: 'compliance', label: 'Compliance coverage' },
  { id: 'vendors', label: 'Vendor posture' },
  { id: 'upcoming', label: 'Upcoming deadlines' },
];

const th: React.CSSProperties = { textAlign: 'left', padding: '5px 8px', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em', color: C.mut, borderBottom: `1.5px solid ${C.border}` };
const td: React.CSSProperties = { padding: '5px 8px', fontSize: 11.5, color: C.text, borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' };

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rep-sec" style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, borderBottom: `2px solid ${C.text}`, paddingBottom: 4, marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}

function Meter({ label, value, max, tone, suffix = '' }: { label: string; value: number; max: number; tone: string; suffix?: string }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <span style={{ width: 130, flexShrink: 0, textAlign: 'right', fontSize: 11, color: C.text }}>{label}</span>
      <span style={{ flex: 1, height: 12, background: C.bg, borderRadius: 4, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.max(value > 0 ? 3 : 0, pct)}%`, background: tone }} />
      </span>
      <span style={{ width: 42, fontSize: 11.5, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{value}{suffix}</span>
    </div>
  );
}

export function ReportsPage() {
  const store = useStore();
  const session = useSession();
  const perms = usePermissions('reports');

  // ── Options ──
  const [on, setOn] = useState<Set<string>>(() => new Set(SECTIONS.map((s) => s.id)));
  const [title, setTitle] = useState('InfoSec Status Report');
  const [horizon, setHorizon] = useState(60);
  const [limit, setLimit] = useState(10);
  const [includeClosed, setIncludeClosed] = useState(false);
  const has = (id: string) => on.has(id);
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Data (read live at render) ──
  const external = useMemo(() => ({
    incidents: incidentRepo.list(),
    vendors: vendorRepo.list(),
    policies: policyRepo.list(),
    accessReviews: accessRepo.list(),
    kpis: kpiRepo.list(),
    meetings: committeeRepo.list(),
    courses: awarenessRepo.list(),
    controls: complianceRepo.list(),
    findings: findingsRepo.list(),
    vulns: vulnRepo.list(),
  }), []);
  const data: OverviewData = useMemo(
    () => ({ assets: store.assets, risks: store.risks, treatments: store.treatments, ...external }),
    [store.assets, store.risks, store.treatments, external],
  );

  const H = useMemo(() => headline(data.assets, data.risks, data.treatments, data.incidents, data.controls, data.vulns, data.findings), [data]);
  const tiles = useMemo(() => serviceHealth(data), [data]);
  const attention = useMemo(() => buildAttentionItems(data).slice(0, limit), [data, limit]);
  const upcoming = useMemo(() => buildUpcoming(data, horizon).slice(0, 15), [data, horizon]);

  const incidents = data.incidents.filter((i) => includeClosed || isOpen(i));
  const vulns = data.vulns.filter((v) => includeClosed || isOpenVuln(v));
  const findings = data.findings.filter((f) => includeClosed || isOpenFinding(f));

  const sevTone: Record<string, string> = { Critical: C.crit, High: C.high, Medium: C.med, Low: C.low };
  const residualCounts = (['Critical', 'High', 'Medium', 'Low'] as const).map((l) => ({
    l, n: data.risks.filter((r) => residualLevel(r) === l).length,
  }));
  const topRisks = [...data.risks]
    .filter((r) => residualScore(r) != null)
    .sort((a, b) => (residualScore(b) as number) - (residualScore(a) as number))
    .slice(0, 5);
  const frameworks = FRAMEWORKS.map((f) => {
    const controls = data.controls.filter((c) => c.framework === f);
    return { f, cov: coverage(controls), n: controls.filter((c) => c.status !== 'Not Applicable').length };
  }).filter((x) => x.n > 0);
  const expiredVendors = data.vendors.filter((v) => v.contractExpiry && v.contractExpiry < today());
  const renewingVendors = data.vendors.filter((v) => {
    if (!v.contractExpiry || v.contractExpiry < today()) return false;
    const d = Math.round((new Date(v.contractExpiry).getTime() - new Date(today()).getTime()) / 86400000);
    return d <= 60;
  });

  const genDate = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });

  const execStats = [
    { l: 'Critical residual risks', v: H.criticalResidual, c: C.crit },
    { l: 'Overdue treatments', v: H.overdueTreatments, c: C.high },
    { l: 'Open incidents', v: H.openIncidents, c: C.info },
    { l: 'Vuln SLA breaches', v: H.vulnsBreached, c: C.crit },
    { l: 'Findings overdue', v: H.findingsOverdue, c: C.med },
    { l: 'Compliance score', v: `${H.complianceScore}%`, c: C.low },
  ];

  return (
    <>
      <PageHeader>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--accent)' }}>
          🖨 Print / Save as PDF
        </button>
      </PageHeader>

      <div className="p-6 flex gap-5 items-start">
        {/* ── Options (never printed) ── */}
        <aside className="no-print section-card p-4 w-64 shrink-0 space-y-4 sticky top-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>Report title</div>
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>Sections</div>
            <div className="space-y-1.5">
              {SECTIONS.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--text2)' }}>
                  <input type="checkbox" checked={has(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-[var(--accent)]" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text3)' }}>Options</div>
            <label className="block text-[12px] mb-2" style={{ color: 'var(--text2)' }}>
              Deadline horizon
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value={30}>Next 30 days</option>
                <option value={60}>Next 60 days</option>
                <option value={90}>Next 90 days</option>
              </select>
            </label>
            <label className="block text-[12px] mb-2" style={{ color: 'var(--text2)' }}>
              Attention items
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={999}>All</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--text2)' }}>
              <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
              Include closed / resolved
            </label>
          </div>
          {perms.view && (
            <button onClick={() => window.print()} className="w-full rounded-lg px-3 py-2 text-[13px] font-semibold text-white" style={{ background: 'var(--accent)' }}>
              🖨 Print / Save as PDF
            </button>
          )}
          <p className="text-[10.5px]" style={{ color: 'var(--text3)' }}>
            Opens your browser's print dialog — choose <b>“Save as PDF”</b> as the destination. The preview on the right is exactly what prints.
          </p>
        </aside>

        {/* ── Report document (this is what prints) ── */}
        <div id="report-root" className="flex-1 min-w-0 rounded-xl shadow-sm" style={{ background: '#fff', border: `1px solid ${C.border}`, maxWidth: 860 }}>
          <div style={{ padding: '34px 40px' }}>
            {/* Header */}
            <div style={{ borderBottom: `3px solid ${C.text}`, paddingBottom: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.mut }}>InfoSec Portal · Information Security</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '4px 0 6px' }}>{title || 'InfoSec Status Report'}</h1>
              <div style={{ fontSize: 11, color: C.mut }}>
                Generated {genDate} · Prepared by {session.user.displayName} ({session.user.title}) · Deadline horizon: next {horizon} days
              </div>
            </div>

            {has('exec') && (
              <Sec title="Executive summary">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {execStats.map((s) => (
                    <div key={s.l} style={{ border: `1px solid ${C.border}`, borderLeft: `4px solid ${s.c}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                      <div style={{ fontSize: 10.5, color: C.mut, marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </Sec>
            )}

            {has('health') && (
              <Sec title="Service health">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {tiles.map((t) => {
                    const tone = t.tone === 'crit' ? C.crit : t.tone === 'med' ? C.med : C.low;
                    return (
                      <div key={t.moduleId} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{t.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: tone, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
                        <div style={{ fontSize: 10, color: C.mut }}>{t.sub}</div>
                      </div>
                    );
                  })}
                </div>
              </Sec>
            )}

            {has('attention') && (
              <Sec title={`CISO attention items (top ${Math.min(limit, attention.length)})`}>
                {attention.length === 0 ? <p style={{ fontSize: 11.5, color: C.mut }}>Nothing requires urgent attention.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Priority</th><th style={th}>Item</th><th style={th}>Ref</th><th style={th}>Owner</th><th style={th}>Status</th></tr></thead>
                    <tbody>
                      {attention.map((a) => (
                        <tr key={a.id}>
                          <td style={{ ...td, fontWeight: 700, color: a.priority === 'Critical' ? C.crit : a.priority === 'High' ? C.high : C.med }}>{a.priority}</td>
                          <td style={td}>{a.label}</td>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 10.5 }}>{a.source}</td>
                          <td style={td}>{a.owner}</td>
                          <td style={{ ...td, color: a.overdueDays ? C.crit : C.mut, fontWeight: a.overdueDays ? 700 : 400 }}>{a.overdueDays ? `Overdue ${a.overdueDays}d` : 'Open'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Sec>
            )}

            {has('rcsa') && (
              <Sec title="RCSA risk summary">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: C.mut, marginBottom: 6 }}>Residual risk levels</div>
                    {residualCounts.map((r) => (
                      <Meter key={r.l} label={r.l} value={r.n} max={Math.max(1, ...residualCounts.map((x) => x.n))} tone={sevTone[r.l]} />
                    ))}
                    <div style={{ fontSize: 10.5, color: C.mut, marginTop: 6 }}>{H.overdueTreatments} treatment plan{H.overdueTreatments === 1 ? '' : 's'} overdue · {H.highValueAssets} high-value assets ({H.lowCoverageHighValue} without treatment coverage)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: C.mut, marginBottom: 6 }}>Top residual risks</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>Risk</th><th style={th}>Threat</th><th style={th}>Residual</th></tr></thead>
                      <tbody>
                        {topRisks.map((r) => {
                          const s = residualScore(r) as number;
                          const lvl = riskLevel(s)[0];
                          return (
                            <tr key={r.id}>
                              <td style={{ ...td, fontFamily: 'monospace', fontSize: 10.5 }}>{r.id}</td>
                              <td style={td}>{r.threat}</td>
                              <td style={{ ...td, fontWeight: 700, color: sevTone[lvl] ?? C.mut }}>{s} · {lvl}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Sec>
            )}

            {has('incidents') && (
              <Sec title={`Incidents (${includeClosed ? 'all' : 'open'})`}>
                {incidents.length === 0 ? <p style={{ fontSize: 11.5, color: C.mut }}>No open incidents.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>ID</th><th style={th}>Incident</th><th style={th}>Severity</th><th style={th}>Status</th><th style={th}>Responsible</th><th style={th}>Age</th></tr></thead>
                    <tbody>
                      {incidents.map((i: Incident) => (
                        <tr key={i.id}>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 10.5 }}>{i.id}</td>
                          <td style={td}>{i.shortDesc}</td>
                          <td style={{ ...td, fontWeight: 700, color: sevTone[i.severity] }}>{i.severity}</td>
                          <td style={td}>{i.status}</td>
                          <td style={td}>{i.responsible || '—'}</td>
                          <td style={{ ...td, color: C.mut }}>{daysOpen(i) == null ? '—' : `${daysOpen(i)}d`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Sec>
            )}

            {has('vulns') && (
              <Sec title={`Vulnerability remediation SLAs (${includeClosed ? 'all' : 'open'})`}>
                {vulns.length === 0 ? <p style={{ fontSize: 11.5, color: C.mut }}>No open vulnerabilities.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>ID</th><th style={th}>Vulnerability</th><th style={th}>Severity</th><th style={th}>SLA deadline</th><th style={th}>Position</th><th style={th}>Owner</th></tr></thead>
                    <tbody>
                      {vulns.map((v) => {
                        const left = slaDaysLeft(v);
                        const pos = !isOpenVuln(v) ? v.status : left == null ? '—' : left < 0 ? `${-left}d over` : `${left}d left`;
                        const posColor = !isOpenVuln(v) ? C.mut : left != null && left < 0 ? C.crit : left != null && left <= 7 ? C.med : C.low;
                        return (
                          <tr key={v.id}>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: 10.5 }}>{v.id}</td>
                            <td style={td}>{v.title}</td>
                            <td style={{ ...td, fontWeight: 700, color: sevTone[v.severity] }}>{v.severity}{v.cvss ? ` (${v.cvss})` : ''}</td>
                            <td style={td}>{slaDeadline(v) || '—'}</td>
                            <td style={{ ...td, fontWeight: 700, color: posColor }}>{pos}</td>
                            <td style={td}>{v.owner}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Sec>
            )}

            {has('findings') && (
              <Sec title={`Audit & regulator findings (${includeClosed ? 'all' : 'open'})`}>
                {findings.length === 0 ? <p style={{ fontSize: 11.5, color: C.mut }}>No open findings.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>ID</th><th style={th}>Finding</th><th style={th}>Source</th><th style={th}>Severity</th><th style={th}>Due</th><th style={th}>Status</th></tr></thead>
                    <tbody>
                      {findings.map((f) => (
                        <tr key={f.id}>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 10.5 }}>{f.id}</td>
                          <td style={td}>{f.title}</td>
                          <td style={td}>{f.source}{f.ref ? ` · ${f.ref}` : ''}</td>
                          <td style={{ ...td, fontWeight: 700, color: sevTone[f.severity] }}>{f.severity}</td>
                          <td style={{ ...td, color: findingOverdue(f) ? C.crit : C.text, fontWeight: findingOverdue(f) ? 700 : 400 }}>
                            {f.dueDate}{findingOverdue(f) ? ` (${findingOverdueDays(f)}d late)` : ''}
                          </td>
                          <td style={td}>{f.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Sec>
            )}

            {has('compliance') && (
              <Sec title="Compliance coverage by framework">
                {frameworks.map((x) => (
                  <Meter key={x.f} label={x.f} value={x.cov} max={100} suffix="%" tone={x.cov >= 80 ? C.low : x.cov >= 50 ? C.med : C.crit} />
                ))}
                <div style={{ fontSize: 10.5, color: C.mut, marginTop: 6 }}>Coverage = implemented ÷ applicable controls per framework · overall {H.complianceScore}%.</div>
              </Sec>
            )}

            {has('vendors') && (
              <Sec title="Vendor posture">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: C.crit, marginBottom: 6 }}>Expired contracts ({expiredVendors.length})</div>
                    {expiredVendors.length === 0 ? <p style={{ fontSize: 11, color: C.mut }}>None.</p> : expiredVendors.map((v) => (
                      <div key={v.id} style={{ fontSize: 11.5, color: C.text, padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
                        {v.name} <span style={{ color: C.crit, fontWeight: 700 }}>{v.contractExpiry}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: C.med, marginBottom: 6 }}>Renewing ≤60 days ({renewingVendors.length})</div>
                    {renewingVendors.length === 0 ? <p style={{ fontSize: 11, color: C.mut }}>None.</p> : renewingVendors.map((v) => (
                      <div key={v.id} style={{ fontSize: 11.5, color: C.text, padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
                        {v.name} <span style={{ color: C.med, fontWeight: 700 }}>{v.contractExpiry}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Sec>
            )}

            {has('upcoming') && (
              <Sec title={`Upcoming deadlines (next ${horizon} days)`}>
                {upcoming.length === 0 ? <p style={{ fontSize: 11.5, color: C.mut }}>Nothing due in this window.</p> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>What</th><th style={th}>Context</th><th style={th}>Date</th><th style={th}>In</th></tr></thead>
                    <tbody>
                      {upcoming.map((u) => (
                        <tr key={u.id}>
                          <td style={td}>{u.title}</td>
                          <td style={{ ...td, color: C.mut }}>{u.subtext}</td>
                          <td style={td}>{u.date}</td>
                          <td style={{ ...td, fontWeight: 700, color: u.days < 0 ? C.crit : u.days <= 14 ? C.med : C.text }}>{u.days < 0 ? `${-u.days}d overdue` : `${u.days}d`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Sec>
            )}

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, fontSize: 9.5, color: C.faint, display: 'flex', justifyContent: 'space-between' }}>
              <span>Internal — Information Security. Generated from live portal data.</span>
              <span>InfoSec Portal</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
