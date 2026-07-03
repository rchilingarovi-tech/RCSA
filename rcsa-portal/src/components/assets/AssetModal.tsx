import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal';
import { EvidenceTags } from '../common/EvidenceTags';
import { Badge } from '../common/Badge';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { useUi } from '../common/UiProvider';
import { assetValue, criticality, genId, today } from '../../domain/scoring';
import { ASSET_STATUSES, CIA_OPTIONS, DATA_CLASSES } from '../../domain/constants';
import type { Asset, AssetStatus, CIA, DataClass, YesNo } from '../../data/models';

interface FormShape {
  name: string;
  process: string;
  department: string;
  busOwner: string;
  itOwner: string;
  applicantName: string;
  dataClass: DataClass;
  status: AssetStatus;
  c: CIA;
  i: CIA;
  a: CIA;
  pci: boolean;
  criticalProcess: boolean;
  internet: boolean;
  thirdParty: boolean;
  cloud: boolean;
  reviewDate: string;
  notes: string;
}

const yes = (b: boolean): YesNo => (b ? 'Yes' : 'No');

function blankForm(): FormShape {
  return {
    name: '', process: '', department: '', busOwner: '', itOwner: '', applicantName: '',
    dataClass: 'Confidential', status: 'Submitted', c: 3, i: 3, a: 3,
    pci: false, criticalProcess: false, internet: false, thirdParty: false, cloud: false,
    reviewDate: '', notes: '',
  };
}

function fromAsset(a: Asset): FormShape {
  return {
    name: a.name, process: a.process, department: a.department, busOwner: a.busOwner,
    itOwner: a.itOwner, applicantName: a.applicantName, dataClass: a.dataClass, status: a.status,
    c: a.c, i: a.i, a: a.a,
    pci: a.pci === 'Yes', criticalProcess: a.criticalProcess === 'Yes', internet: a.internet === 'Yes',
    thirdParty: a.thirdParty === 'Yes', cloud: a.cloud === 'Yes',
    reviewDate: a.reviewDate || '', notes: a.notes || '',
  };
}

export function AssetModal({ editId }: { editId: string | null }) {
  const store = useStore();
  const modals = useModals();
  const perms = usePermissions('asset-catalogue');
  const ui = useUi();

  const existing = editId ? store.assets.find((a) => a.id === editId) ?? null : null;
  const [form, setForm] = useState<FormShape>(() => (existing ? fromAsset(existing) : blankForm()));
  const [evidence, setEvidence] = useState<string[]>(() => [...(existing?.evidence ?? [])]);
  const [evidenceInput, setEvidenceInput] = useState('');

  const set = <K extends keyof FormShape>(key: K, value: FormShape[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const value = useMemo(() => assetValue(form), [form.c, form.i, form.a]);
  const [critLabel, critClass] = criticality(value);

  function addEvidence() {
    const v = evidenceInput.trim();
    if (!v) return;
    setEvidence((arr) => [...arr, v]);
    setEvidenceInput('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const obj: Asset = {
      id: editId || genId('AST', store.assets),
      name: form.name.trim(),
      process: form.process.trim(),
      department: form.department.trim(),
      busOwner: form.busOwner.trim(),
      itOwner: form.itOwner.trim(),
      applicantName: form.applicantName.trim(),
      c: form.c, i: form.i, a: form.a,
      dataClass: form.dataClass,
      status: form.status,
      pci: yes(form.pci),
      criticalProcess: yes(form.criticalProcess),
      internet: yes(form.internet),
      thirdParty: yes(form.thirdParty),
      cloud: yes(form.cloud),
      reviewDate: form.reviewDate,
      notes: form.notes.trim(),
      evidence: [...evidence],
      submittedAt: existing?.submittedAt || today,
    };
    void store.saveAsset(obj).then(() => {
      ui.toast(editId ? 'Asset updated' : 'Asset registered', 'bg-green-700');
      modals.afterAssetSaved(obj.id, editId || '');
    });
  }

  const inputCls = 'border rounded px-3 py-2';

  return (
    <Modal
      open
      onClose={() => modals.closeAsset(false)}
      onBack={() => modals.closeAsset(true)}
      title={editId ? `Edit Asset — ${editId}` : 'Register New Asset'}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={`${inputCls} md:col-span-2`} placeholder="Asset Name *" />
        <input required value={form.process} onChange={(e) => set('process', e.target.value)} className={inputCls} placeholder="Business Process *" />
        <input required value={form.department} onChange={(e) => set('department', e.target.value)} className={inputCls} placeholder="Department *" />
        <input required value={form.busOwner} onChange={(e) => set('busOwner', e.target.value)} className={inputCls} placeholder="Business Owner *" />
        <input required value={form.itOwner} onChange={(e) => set('itOwner', e.target.value)} className={inputCls} placeholder="IT Owner *" />
        <input required value={form.applicantName} onChange={(e) => set('applicantName', e.target.value)} className={inputCls} placeholder="Applicant Name *" />

        <select value={form.dataClass} onChange={(e) => set('dataClass', e.target.value as DataClass)} className={inputCls}>
          {DATA_CLASSES.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={form.status} onChange={(e) => set('status', e.target.value as AssetStatus)} className={inputCls}>
          {ASSET_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <div className="grid grid-cols-3 gap-3 md:col-span-2">
          {(['c', 'i', 'a'] as const).map((k, idx) => (
            <div key={k}>
              <label className="text-xs text-gray-500 block mb-1">{['Confidentiality', 'Integrity', 'Availability'][idx]}</label>
              <select value={form[k]} onChange={(e) => set(k, Number(e.target.value) as CIA)} className="w-full border rounded px-2 py-2">
                {CIA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-50 rounded px-3 py-2 md:col-span-2">
          Asset Value: <span className="font-bold text-lg ml-1">{value}</span>
          <Badge className={`${critClass} ml-2`}>{critLabel}</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:col-span-2 border rounded p-4 bg-gray-50">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pci} onChange={(e) => set('pci', e.target.checked)} /> PCI DSS in scope</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.criticalProcess} onChange={(e) => set('criticalProcess', e.target.checked)} /> Critical process</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.internet} onChange={(e) => set('internet', e.target.checked)} /> Internet-facing</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.thirdParty} onChange={(e) => set('thirdParty', e.target.checked)} /> Third-party dependency</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.cloud} onChange={(e) => set('cloud', e.target.checked)} /> Cloud-hosted</label>
        </div>

        <input type="date" value={form.reviewDate} onChange={(e) => set('reviewDate', e.target.value)} className={`${inputCls} md:col-span-2`} title="Next Review Date" />

        <div className="flex items-center gap-2 md:col-span-2">
          <input
            value={evidenceInput}
            onChange={(e) => setEvidenceInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEvidence(); } }}
            className="border rounded px-3 py-2 flex-1"
            placeholder="Evidence filename (e.g. arch.pdf)"
          />
          <button type="button" onClick={addEvidence} className="btn-neutral border rounded px-3 py-2 text-sm hover:bg-gray-50">Add</button>
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-1 min-h-[1.5rem]">
          <EvidenceTags items={evidence} onRemove={(i) => setEvidence((arr) => arr.filter((_, idx) => idx !== i))} />
        </div>

        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className={`${inputCls} md:col-span-2`} rows={2} placeholder="Notes / description" />

        <div className="md:col-span-2 flex justify-between items-center pt-4">
          {editId && perms.remove ? (
            <button type="button" onClick={() => modals.deleteAssetFlow(editId)} className="text-red-600 text-sm hover:underline">Delete asset</button>
          ) : (
            <span />
          )}
          <div className="flex gap-3 ml-auto">
            <button type="button" onClick={() => modals.closeAsset(false)} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold">Save Asset</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
