import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { FormSection } from '../../components/common/FormSection';
import { useUi } from '../../components/common/UiProvider';
import { today } from '../../domain/scoring';
import { incidentRepo } from './repo';
import {
  CATEGORIES,
  nowLocal,
  INCIDENT_STATUSES,
  SEVERITIES,
  type Incident,
  type IncidentCategory,
  type IncidentStatus,
  type Severity,
} from './types';

const todayStr = today;


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

  // Any field change arms the discard guard (change events bubble to the form).
  const [dirty, setDirty] = useState(false);

  // Root cause and corrective action are not answerable while an incident is
  // still open, so that stage recedes until the status says otherwise.
  const investigationPending = status === 'Open' && !rootCause && !correctiveAction;

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!shortDesc.trim()) { ui.toast('Enter a short description.', 'bg-orange-600'); return; }
    if (!reportedBy.trim()) { ui.toast('Enter who reported it.', 'bg-orange-600'); return; }
    if (occurredAt && reportedAt && occurredAt > reportedAt) { ui.toast('Incident time cannot be after the time reported.', 'bg-orange-600'); return; }
    // Closure date is only meaningful when Closed; auto-fill / clear accordingly.
    const resolvedClosedAt = status === 'Closed' ? (closedAt || todayStr()) : '';
    // A closure before the report date would silently corrupt time-to-closure stats.
    if (resolvedClosedAt && reportedAt && resolvedClosedAt < reportedAt.slice(0, 10)) {
      ui.toast('Closure date cannot be before the time reported.', 'bg-orange-600'); return;
    }

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
    <Modal open onClose={onClose} dirty={dirty} title={e ? `Edit Incident — ${e.id}` : 'Report New Incident'} subtitle="Security incident record" maxWidth="max-w-2xl">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="p-6">
        <FormSection first title="What happened" hint="The facts you have now — everything needed to log the incident.">
          <label className="block"><span className={lbl}>Short description *</span><input value={shortDesc} maxLength={200} onChange={(ev) => setShortDesc(ev.target.value)} className={field} placeholder="e.g. Phishing campaign targeting finance team" /></label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Time reported</span><input type="datetime-local" value={reportedAt} onChange={(ev) => setReportedAt(ev.target.value)} className={field} /></label>
            <label className="block"><span className={lbl}>Incident time (when it happened)</span><input type="datetime-local" value={occurredAt} onChange={(ev) => setOccurredAt(ev.target.value)} className={field} /></label>
            <label className="block"><span className={lbl}>Reported by *</span><input value={reportedBy} maxLength={120} onChange={(ev) => setReportedBy(ev.target.value)} className={field} placeholder="Person / source" /></label>
            <label className="block"><span className={lbl}>Responsible person</span><input value={responsible} maxLength={120} onChange={(ev) => setResponsible(ev.target.value)} className={field} placeholder="Handler / owner" /></label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <label className="block">
              <span className={lbl}>Category</span>
              <select value={category} onChange={(ev) => setCategory(ev.target.value as IncidentCategory)} className={field}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block">
              <span className={lbl}>Severity</span>
              <select value={severity} onChange={(ev) => setSeverity(ev.target.value as Severity)} className={field}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label className="block">
              <span className={lbl}>Affected asset / system</span>
              <input value={asset} maxLength={120} onChange={(ev) => setAsset(ev.target.value)} className={field} placeholder="e.g. Email Gateway" />
            </label>
          </div>

          {category === 'Other' && (
            <label className="block"><span className={lbl}>Specify category</span><input value={categoryOther} maxLength={120} onChange={(ev) => setCategoryOther(ev.target.value)} className={field} placeholder="Describe the incident category" /></label>
          )}

          <label className="block"><span className={lbl}>Description</span><textarea value={description} maxLength={2000} onChange={(ev) => setDescription(ev.target.value)} className={field} rows={3} placeholder="What happened, impact, actions taken…" /></label>
        </FormSection>

        <FormSection
          title="Investigation & closure"
          muted={investigationPending}
          hint={investigationPending
            ? 'Usually answered after investigation — leave blank while the incident is still open.'
            : 'Findings and remedial action for this incident.'}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className={lbl}>Status</span>
              <select value={status} onChange={(ev) => setStatus(ev.target.value as IncidentStatus)} className={field}>{INCIDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label className="block">
              <span className={lbl}>Closure date</span>
              <input type="date" value={closedAt} onChange={(ev) => setClosedAt(ev.target.value)} className={field} disabled={status !== 'Closed'} title={status !== 'Closed' ? 'Set status to Closed to record a closure date' : ''} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Root cause</span><textarea value={rootCause} maxLength={2000} onChange={(ev) => setRootCause(ev.target.value)} className={field} rows={3} placeholder="Underlying cause" /></label>
            <label className="block"><span className={lbl}>Corrective action</span><textarea value={correctiveAction} maxLength={2000} onChange={(ev) => setCorrectiveAction(ev.target.value)} className={field} rows={3} placeholder="Remedial action taken" /></label>
          </div>
        </FormSection>

        <div className="flex justify-end gap-3 pt-5 mt-5 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Incident' : 'Report Incident'}</button>
        </div>
      </form>
    </Modal>
  );
}
