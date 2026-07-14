import { useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal';
import { EvidenceTags } from '../common/EvidenceTags';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { useUi } from '../common/UiProvider';
import { genId, today } from '../../domain/scoring';
import { TREATMENT_STATUSES } from '../../domain/constants';
import type { Treatment, TreatmentStatus } from '../../data/models';

// A treatment is a concrete action/project that addresses one or more risks.
export function TreatmentModal({ editId, riskId }: { editId: string | null; riskId: string | null }) {
  const store = useStore();
  const modals = useModals();
  const perms = usePermissions('treatment-catalogue');
  const ui = useUi();

  const existing = editId ? store.treatments.find((t) => t.id === editId) ?? null : null;

  const [riskIds, setRiskIds] = useState<string[]>(
    () => existing?.riskIds ?? (riskId ? [riskId] : []),
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [owner, setOwner] = useState(existing?.owner ?? '');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '');
  const [status, setStatus] = useState<TreatmentStatus>(existing?.status ?? 'Open');
  const [evidence, setEvidence] = useState<string[]>(() => [...(existing?.evidence ?? [])]);
  const [evidenceInput, setEvidenceInput] = useState('');
  const [comments, setComments] = useState<string[]>(() => [...(existing?.comments ?? [])]);
  const [commentInput, setCommentInput] = useState('');
  const [riskSearch, setRiskSearch] = useState('');

  const toggleRisk = (id: string) =>
    setRiskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const riskLabel = (id: string) => {
    const r = store.risks.find((x) => x.id === id);
    return r ? `${r.id} — ${r.threat}` : id;
  };
  const q = riskSearch.trim().toLowerCase();
  const riskOptions = q
    ? store.risks.filter((r) => `${r.id} ${r.threat} ${r.vuln}`.toLowerCase().includes(q))
    : store.risks;

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
    if (!title.trim()) { ui.toast('Give the treatment a title.', 'bg-orange-600'); return; }
    if (riskIds.length === 0) { ui.toast('Select at least one risk this treatment addresses.', 'bg-orange-600'); return; }

    const obj: Treatment = {
      id: editId || genId('TRT', store.treatments),
      riskIds,
      title: title.trim(),
      description: description.trim(),
      owner: owner.trim(),
      dueDate,
      status,
      evidence: [...evidence],
      comments: [...comments],
      submittedAt: existing?.submittedAt || today(),
    };
    void store.saveTreatment(obj).then(() => {
      ui.toast(editId ? 'Treatment updated' : 'Treatment created', 'bg-green-700');
      modals.closeTreatment();
    });
  }

  return (
    <Modal
      open
      onClose={() => modals.closeTreatment()}
      title={editId ? `Edit Treatment — ${editId}` : 'New Treatment'}
      subtitle="A mitigation action/project that addresses one or more risks"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Deploy EDR across endpoints" />
        </div>

        {/* Multi-risk picker */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">
            Addresses Risks * <span className="font-normal text-gray-400">({riskIds.length} selected)</span>
          </label>
          {riskIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {riskIds.map((id) => (
                <span key={id} className="badge bg-blue-100 text-blue-800 inline-flex items-center gap-1.5">
                  {riskLabel(id)}
                  <button type="button" onClick={() => toggleRisk(id)} className="font-bold hover:opacity-70" aria-label={`Remove ${id}`}>✕</button>
                </span>
              ))}
            </div>
          )}
          <input
            value={riskSearch}
            onChange={(e) => setRiskSearch(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm mb-1"
            placeholder="Search risks by ID, threat or vulnerability…"
          />
          <div className="border rounded max-h-44 overflow-y-auto bg-gray-50 divide-y divide-gray-100">
            {riskOptions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400">No risks match “{riskSearch}”.</p>
            ) : (
              riskOptions.map((r) => (
                <label key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100">
                  <input type="checkbox" checked={riskIds.includes(r.id)} onChange={() => toggleRisk(r.id)} />
                  <span className="font-mono text-xs text-blue-600">{r.id}</span>
                  <span className="flex-1 truncate">{r.threat}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Description / Action Plan</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" rows={3} placeholder="Describe the steps to treat the risk(s)…" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Owner</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Name / team" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TreatmentStatus)} className="w-full border rounded px-3 py-2 text-sm">
              {TREATMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

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

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Comments</label>
          <div className="space-y-2 min-h-[2rem] mb-2">
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
              className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Add a note…"
            />
            <button type="button" onClick={addComment} className="btn-neutral border rounded px-3 py-2 text-sm hover:bg-gray-50 font-semibold">Add</button>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          {editId && perms.remove ? (
            <button type="button" onClick={() => modals.deleteTreatmentFlow(editId)} className="text-red-600 text-sm hover:underline">Delete treatment</button>
          ) : (
            <span />
          )}
          <div className="flex gap-3 ml-auto">
            <button type="button" onClick={() => modals.closeTreatment()} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold">Save Treatment</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
