import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { useUi } from '../../components/common/UiProvider';
import { incidentRepo } from './repo';
import {
  CATEGORIES,
  INCIDENT_STATUSES,
  SEVERITIES,
  type Incident,
  type IncidentCategory,
  type IncidentStatus,
  type Severity,
} from './types';

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowLocal = () => new Date().toISOString().slice(0, 16);

export function IncidentModal({ incident, onClose, onSave }: { incident: Incident | 'new'; onClose: () => void; onSave: (i: Incident) => void }) {
  const ui = useUi();
  const e = incident === 'new' ? null : incident;

  const [shortDesc, setShortDesc] = useState(e?.shortDesc ?? '');
  const [reportedAt, setReportedAt] = useState(e?.reportedAt ?? nowLocal());
  const [occurredAt, setOccurredAt] = useState(e?.occurredAt ?? nowLocal());
  const [reportedBy, setReportedBy] = useState(e?.reportedBy ?? '');
  const [category, setCategory] = useState<IncidentCategory>(e?.category ?? 'Phishing');
  const [categoryOther, setCategoryOther] = useState(e?.categoryOther ?? '');
  const [severity, setSeverity] = useState<Severity>(e?.severity ?? 'Medium');
  const [asset, setAsset] = useState(e?.asset ?? '');
  const [status, setStatus] = useState<IncidentStatus>(e?.status ?? 'Open');
  const [responsible, setResponsible] = useState(e?.responsible ?? '');
  const [closedAt, setClosedAt] = useState(e?.closedAt ?? '');
  const [description, setDescription] = useState(e?.description ?? '');
  const [rootCause, setRootCause] = useState(e?.rootCause ?? '');
  const [correctiveAction, setCorrectiveAction] = useState(e?.correctiveAction ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!shortDesc.trim()) { ui.toast('Enter a short description.', 'bg-orange-600'); return; }
    if (!reportedBy.trim()) { ui.toast('Enter who reported it.', 'bg-orange-600'); return; }
    if (occurredAt && reportedAt && occurredAt > reportedAt) { ui.toast('Incident time cannot be after the time reported.', 'bg-orange-600'); return; }
    // Closure date is only meaningful when Closed; auto-fill / clear accordingly.
    const resolvedClosedAt = status === 'Closed' ? (closedAt || todayStr()) : '';

    onSave({
      id: e ? e.id : incidentRepo.nextId(),
      shortDesc: shortDesc.trim(),
      reportedAt,
      occurredAt,
      reportedBy: reportedBy.trim(),
      category,
      categoryOther: category === 'Other' ? categoryOther.trim() : '',
      severity,
      asset: asset.trim(),
      description: description.trim(),
      rootCause: rootCause.trim(),
      correctiveAction: correctiveAction.trim(),
      status,
      responsible: responsible.trim(),
      closedAt: resolvedClosedAt,
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Incident — ${e.id}` : 'Report New Incident'} subtitle="Security incident record" maxWidth="max-w-2xl">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Short description *</label><input value={shortDesc} onChange={(ev) => setShortDesc(ev.target.value)} className={field} placeholder="e.g. Phishing campaign targeting finance team" /></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Time reported</label><input type="datetime-local" value={reportedAt} onChange={(ev) => setReportedAt(ev.target.value)} className={field} /></div>
          <div><label className={lbl}>Incident time (when it happened)</label><input type="datetime-local" value={occurredAt} onChange={(ev) => setOccurredAt(ev.target.value)} className={field} /></div>
          <div><label className={lbl}>Reported by *</label><input value={reportedBy} onChange={(ev) => setReportedBy(ev.target.value)} className={field} placeholder="Person / source" /></div>
          <div><label className={lbl}>Responsible person</label><input value={responsible} onChange={(ev) => setResponsible(ev.target.value)} className={field} placeholder="Handler / owner" /></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={lbl}>Category</label>
            <select value={category} onChange={(ev) => setCategory(ev.target.value as IncidentCategory)} className={field}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label className={lbl}>Severity</label>
            <select value={severity} onChange={(ev) => setSeverity(ev.target.value as Severity)} className={field}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(ev) => setStatus(ev.target.value as IncidentStatus)} className={field}>{INCIDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div>
            <label className={lbl}>Closure date</label>
            <input type="date" value={closedAt} onChange={(ev) => setClosedAt(ev.target.value)} className={field} disabled={status !== 'Closed'} title={status !== 'Closed' ? 'Set status to Closed to record a closure date' : ''} />
          </div>
        </div>

        {category === 'Other' && (
          <div><label className={lbl}>Specify category</label><input value={categoryOther} onChange={(ev) => setCategoryOther(ev.target.value)} className={field} placeholder="Describe the incident category" /></div>
        )}

        <div><label className={lbl}>Affected asset / system</label><input value={asset} onChange={(ev) => setAsset(ev.target.value)} className={field} placeholder="e.g. Email Gateway, Server SRV-09" /></div>
        <div><label className={lbl}>Description</label><textarea value={description} onChange={(ev) => setDescription(ev.target.value)} className={field} rows={3} placeholder="What happened, impact, actions taken…" /></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>Root cause</label><textarea value={rootCause} onChange={(ev) => setRootCause(ev.target.value)} className={field} rows={3} placeholder="Underlying cause (post-investigation)" /></div>
          <div><label className={lbl}>Corrective action</label><textarea value={correctiveAction} onChange={(ev) => setCorrectiveAction(ev.target.value)} className={field} rows={3} placeholder="Remedial / corrective action taken" /></div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Incident' : 'Report Incident'}</button>
        </div>
      </form>
    </Modal>
  );
}
