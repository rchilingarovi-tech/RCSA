import { useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal';
import { EvidenceTags } from '../common/EvidenceTags';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { useUi } from '../common/UiProvider';
import { genId, riskLevel, today } from '../../domain/scoring';
import {
  ASSESSMENTS, CONTROL_CATALOGUE, IMPACT_OPTIONS, LIKELIHOOD_OPTIONS,
  OTHER_THREAT, THREAT_CATALOGUE,
} from '../../domain/constants';
import { statusBadgeClass, treatmentStatus as treatmentEffStatus } from '../../domain/scoring';
import type { Assessment, Risk, Score5 } from '../../data/models';

type TabId = 'basic' | 'controls' | 'treatment' | 'comments';

interface FormShape {
  assetIds: string[];
  threatSelect: string;
  threatOther: string;
  vuln: string;
  owner: string;
  assessment: Assessment;
  impact: Score5;
  likelihood: Score5;
  resImpact: Score5;
  resLikelihood: Score5;
  customControl: string;
  acceptanceExpiry: string;
}

function initForm(r: Risk | null): { form: FormShape; controls: Set<string> } {
  if (!r) {
    return {
      form: {
        assetIds: [], threatSelect: '', threatOther: '', vuln: '', owner: '', assessment: 'Mitigate',
        impact: 5, likelihood: 3, resImpact: 3, resLikelihood: 2, customControl: '',
        acceptanceExpiry: '',
      },
      controls: new Set<string>(),
    };
  }
  const known = THREAT_CATALOGUE.includes(r.threat);
  return {
    form: {
      assetIds: [...r.assetIds],
      threatSelect: known ? r.threat : OTHER_THREAT,
      threatOther: known ? '' : r.threat,
      vuln: r.vuln, owner: r.owner, assessment: r.assessment,
      impact: r.impact, likelihood: r.likelihood, resImpact: r.resImpact ?? 3, resLikelihood: r.resLikelihood ?? 2,
      customControl: '', acceptanceExpiry: r.acceptanceExpiry || '',
    },
    // only catalogue controls become checkboxes (matches prototype L1245)
    controls: new Set(r.controls.filter((c) => CONTROL_CATALOGUE.includes(c))),
  };
}

export function RiskModal({ editId, assetId }: { editId: string | null; assetId: string | null }) {
  const store = useStore();
  const modals = useModals();
  const riskPerms = usePermissions('risk-catalogue');
  const treatmentPerms = usePermissions('treatment-catalogue');
  const ui = useUi();

  const existing = editId ? store.risks.find((r) => r.id === editId) ?? null : null;
  const init = initForm(existing);
  const [tab, setTab] = useState<TabId>('basic');
  const [form, setForm] = useState<FormShape>(() => ({
    ...init.form,
    assetIds: existing?.assetIds ?? (assetId ? [assetId] : []),
  }));
  const [assetSearch, setAssetSearch] = useState('');
  const [controls, setControls] = useState<Set<string>>(init.controls);
  const [evidence, setEvidence] = useState<string[]>(() => [...(existing?.evidence ?? [])]);
  const [evidenceInput, setEvidenceInput] = useState('');
  const [comments, setComments] = useState<string[]>(() => [...(existing?.comments ?? [])]);
  const [commentInput, setCommentInput] = useState('');
  // Residual risk is optional — only shown when already assessed or explicitly added.
  const [residualOn, setResidualOn] = useState<boolean>(() => existing != null && existing.resImpact != null && existing.resLikelihood != null);

  const set = <K extends keyof FormShape>(key: K, value: FormShape[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleAsset = (id: string) =>
    setForm((f) => ({
      ...f,
      assetIds: f.assetIds.includes(id) ? f.assetIds.filter((x) => x !== id) : [...f.assetIds, id],
    }));
  const assetLabel = (id: string) => {
    const a = store.assets.find((x) => x.id === id);
    return a ? `${a.id} — ${a.name}` : id;
  };
  const q = assetSearch.trim().toLowerCase();
  const assetOptions = q
    ? store.assets.filter((a) => `${a.id} ${a.name} ${a.department}`.toLowerCase().includes(q))
    : store.assets;

  const linkedTreatments = editId ? store.treatments.filter((t) => t.riskIds.includes(editId)) : [];

  const inScore = form.impact * form.likelihood;
  const resScore = form.resImpact * form.resLikelihood;
  const inL = riskLevel(inScore);
  const resL = riskLevel(resScore);
  const showOther = form.threatSelect === OTHER_THREAT;
  const showAcceptance = form.assessment === 'Accept';

  function toggleControl(value: string, checked: boolean) {
    setControls((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  }

  function addEvidence() {
    const v = evidenceInput.trim();
    if (!v) return;
    setEvidence((arr) => [...arr, v]);
    setEvidenceInput('');
  }

  function addComment() {
    const v = commentInput.trim();
    if (!v) return;
    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setComments((arr) => [...arr, `[${ts}] ${v}`]);
    setCommentInput('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let threatVal = form.threatSelect;
    let customThreat = false;
    if (threatVal === OTHER_THREAT) { threatVal = form.threatOther.trim(); customThreat = true; }
    if (!threatVal) { ui.toast('Select or enter a threat type.', 'bg-orange-600'); return; }
    if (form.assetIds.length === 0) { ui.toast('Select at least one asset this risk applies to.', 'bg-orange-600'); return; }

    const checked = [...controls];
    if (form.customControl.trim()) checked.push(form.customControl.trim());

    const obj: Risk = {
      id: editId || genId('RSK', store.risks),
      assetIds: form.assetIds,
      threat: threatVal, customThreat, vuln: form.vuln.trim(), owner: form.owner.trim(),
      impact: form.impact, likelihood: form.likelihood,
      ...(residualOn ? { resImpact: form.resImpact, resLikelihood: form.resLikelihood } : {}),
      assessment: form.assessment, controls: checked,
      acceptanceExpiry: form.acceptanceExpiry, evidence: [...evidence], comments: [...comments],
      submittedAt: existing?.submittedAt || today(),
    };
    void store.saveRisk(obj).then(() => {
      ui.toast(editId ? 'Risk updated' : 'Risk logged', 'bg-green-700');
      modals.afterRiskSaved();
    });
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'controls', label: 'Controls' },
    { id: 'treatment', label: 'Treatment' },
    { id: 'comments', label: 'Comments' },
  ];

  const headerExtra = (
    <div className="flex border-b px-6 bg-gray-50">
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`tab-btn ${tab === t.id ? 'active' : ''}`}>
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      open
      onClose={() => modals.closeRisk(false)}
      onBack={() => modals.closeRisk(true)}
      title={editId ? `Edit Risk — ${editId}` : 'Log New Risk'}
      subtitle="Threat · Scoring · Controls · Treatment plan · Evidence · Comments"
      maxWidth="max-w-5xl"
      headerExtra={headerExtra}
    >
      <form onSubmit={handleSubmit} className="p-6">
        {/* Basic Info */}
        {tab === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Applies to Assets * <span className="font-normal text-gray-400">({form.assetIds.length} selected)</span>
              </label>

              {/* Selected assets as removable chips */}
              {form.assetIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.assetIds.map((id) => (
                    <span key={id} className="badge bg-blue-100 text-blue-800 inline-flex items-center gap-1.5">
                      {assetLabel(id)}
                      <button type="button" onClick={() => toggleAsset(id)} className="font-bold hover:opacity-70" aria-label={`Remove ${id}`}>✕</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search + scrollable checkbox list (handles a large asset catalogue) */}
              <input
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm mb-1"
                placeholder="Search assets by ID, name or department…"
              />
              <div className="border rounded max-h-44 overflow-y-auto bg-gray-50 divide-y divide-gray-100">
                {assetOptions.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">No assets match “{assetSearch}”.</p>
                ) : (
                  assetOptions.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100">
                      <input type="checkbox" checked={form.assetIds.includes(a.id)} onChange={() => toggleAsset(a.id)} />
                      <span className="font-mono text-xs text-blue-600">{a.id}</span>
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="text-xs text-gray-400">{a.department}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Threat Type *</label>
              <select required value={form.threatSelect} onChange={(e) => set('threatSelect', e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                <option value="">Select from catalogue…</option>
                {THREAT_CATALOGUE.map((t) => <option key={t}>{t}</option>)}
                <option value={OTHER_THREAT}>— Other / New threat —</option>
              </select>
              {showOther && (
                <div className="mt-2">
                  <input required value={form.threatOther} onChange={(e) => set('threatOther', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Enter new threat type" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Vulnerability *</label>
              <input required value={form.vuln} onChange={(e) => set('vuln', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Describe the vulnerability" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Risk Owner *</label>
                <input required value={form.owner} onChange={(e) => set('owner', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Risk owner" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Treatment Decision</label>
                <select value={form.assessment} onChange={(e) => set('assessment', e.target.value as Assessment)} className="w-full border rounded px-3 py-2 text-sm">
                  {ASSESSMENTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded p-4 bg-orange-50">
                <h4 className="font-semibold text-sm mb-3 text-orange-800">Inherent Risk (before controls)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Impact (1–5)</label>
                    <select value={form.impact} onChange={(e) => set('impact', Number(e.target.value) as Score5)} className="w-full border rounded px-2 py-1.5 text-sm">
                      {IMPACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Likelihood (1–5)</label>
                    <select value={form.likelihood} onChange={(e) => set('likelihood', Number(e.target.value) as Score5)} className="w-full border rounded px-2 py-1.5 text-sm">
                      {LIKELIHOOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className={`mt-3 text-center font-bold text-sm py-2 rounded ${inL[1]}`}>Score: {inScore} — {inL[0]}</div>
              </div>
              {residualOn ? (
                <div className="border rounded p-4 bg-green-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm text-green-800">Residual Risk (after controls)</h4>
                    <button type="button" onClick={() => setResidualOn(false)} className="text-xs text-gray-500 hover:text-red-600">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Impact (1–5)</label>
                      <select value={form.resImpact} onChange={(e) => set('resImpact', Number(e.target.value) as Score5)} className="w-full border rounded px-2 py-1.5 text-sm">
                        {IMPACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Likelihood (1–5)</label>
                      <select value={form.resLikelihood} onChange={(e) => set('resLikelihood', Number(e.target.value) as Score5)} className="w-full border rounded px-2 py-1.5 text-sm">
                        {LIKELIHOOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={`mt-3 text-center font-bold text-sm py-2 rounded ${resL[1]}`}>Score: {resScore} — {resL[0]}</div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setResidualOn(true)}
                  className="border border-dashed rounded p-4 flex flex-col items-center justify-center text-center hover:bg-gray-50 min-h-[150px]"
                  style={{ borderColor: 'var(--border-strong)' }}
                >
                  <span className="text-2xl leading-none mb-1" style={{ color: 'var(--accent)' }}>＋</span>
                  <span className="font-semibold text-sm" style={{ color: 'var(--text2)' }}>Add residual risk assessment</span>
                  <span className="text-xs mt-1" style={{ color: 'var(--text3)' }}>Optional — residual risk after controls. Not required to log the risk.</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        {tab === 'controls' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Check all controls currently in place for this risk.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border rounded p-4 bg-gray-50">
              {CONTROL_CATALOGUE.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={controls.has(c)} onChange={(e) => toggleControl(c, e.target.checked)} /> {c}
                </label>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Additional / custom control</label>
              <input value={form.customControl} onChange={(e) => set('customControl', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Describe any other control in place" />
            </div>
          </div>
        )}

        {/* Treatment */}
        {tab === 'treatment' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">Treatments addressing this risk</label>
                {editId && treatmentPerms.create && (
                  <button type="button" onClick={() => modals.newTreatmentForRisk(editId)} className="btn-neutral border rounded px-3 py-1.5 text-xs hover:bg-gray-50">＋ Add treatment</button>
                )}
              </div>
              {!editId ? (
                <p className="text-xs text-gray-400">Save the risk first, then add treatment plans that address it.</p>
              ) : linkedTreatments.length === 0 ? (
                <p className="text-xs text-gray-400">No treatments yet. Use “Add treatment” to create a mitigation plan.</p>
              ) : (
                <div className="space-y-2">
                  {linkedTreatments.map((t) => {
                    const st = treatmentEffStatus(t);
                    return (
                      <div key={t.id} className="border rounded p-3 bg-gray-50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-blue-600">{t.id}</span>
                            <span className="font-semibold text-sm truncate">{t.title || 'Untitled treatment'}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {t.owner || 'Unassigned'} · Due {t.dueDate || 'N/A'}
                            {t.riskIds.length > 1 ? ` · shared with ${t.riskIds.length - 1} other risk(s)` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`badge ${statusBadgeClass(st)}`}>{st}</span>
                          {treatmentPerms.edit && <button type="button" onClick={() => modals.editTreatment(t.id)} className="text-blue-600 text-xs hover:underline">Edit</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {showAcceptance && (
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Risk Acceptance Expiry Date</label>
                <input type="date" value={form.acceptanceExpiry} onChange={(e) => set('acceptanceExpiry', e.target.value)} className="border rounded px-3 py-2 text-sm" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Evidence Files</label>
              <div className="flex gap-2">
                <input
                  value={evidenceInput}
                  onChange={(e) => setEvidenceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEvidence(); } }}
                  className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Evidence filename"
                />
                <button type="button" onClick={addEvidence} className="btn-neutral border rounded px-3 py-2 text-sm hover:bg-gray-50">Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <EvidenceTags items={evidence} onRemove={(i) => setEvidence((arr) => arr.filter((_, idx) => idx !== i))} />
              </div>
            </div>
          </div>
        )}

        {/* Comments */}
        {tab === 'comments' && (
          <div className="space-y-4">
            <div className="space-y-2 min-h-[3rem]">
              {comments.length ? comments.map((c, i) => (
                <div key={i} className="comment-bubble flex justify-between items-start gap-2">
                  <span>{c}</span>
                  <button type="button" onClick={() => setComments((arr) => arr.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 text-xs font-bold flex-shrink-0">✕</button>
                </div>
              )) : <p className="text-xs text-gray-400">No comments yet.</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addComment(); } }}
                className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Add InfoSec comment / review note…"
              />
              <button type="button" onClick={addComment} className="btn-neutral border rounded px-3 py-2 text-sm hover:bg-gray-50 font-semibold">Add</button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          {editId && riskPerms.remove ? (
            <button type="button" onClick={() => modals.deleteRiskFlow(editId)} className="text-red-600 text-sm hover:underline">Delete risk</button>
          ) : (
            <span />
          )}
          <div className="flex gap-3 ml-auto">
            <button type="button" onClick={() => modals.closeRisk(false)} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold">Save Risk</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
