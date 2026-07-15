import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../components/layout/Drawer';
import { Pill } from '../../components/common/Pill';
import { Icon } from '../../components/common/Icon';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { incidentIo } from './io';
import { takeIntent } from '../../lib/intent';
import { incidentRepo } from './repo';
import { IncidentsDashboard } from './IncidentsDashboard';
import { IncidentList } from './IncidentList';
import { IncidentFilters } from './IncidentFilters';
import { IncidentModal } from './IncidentModal';
import { categoryLabel, severityColor, statusColor, statusLabel, timeToClosureDays, filterIncidents, EMPTY_INCIDENT_FILTER, type Incident, type IncidentFilter } from './types';

const fmtDateTime = (s: string) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); };
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString() : '—');

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="w-36 shrink-0 text-[12px] font-semibold" style={{ color: 'var(--text3)' }}>{label}</div>
      <div className="text-sm" style={{ color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  );
}

export function IncidentsPage() {
  const ui = useUi();
  const perms = usePermissions('incidents');
  const [incidents, setIncidents] = useState<Incident[]>(() => incidentRepo.list());
  const [filter, setFilter] = useState<IncidentFilter>(EMPTY_INCIDENT_FILTER);
  const [editing, setEditing] = useState<Incident | 'new' | null>(() => (takeIntent('new:incidents') ? 'new' : null));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Multi-tab safety: when another tab writes the incidents store, re-read it so
  // this tab never saves from (or renders) a stale copy (lost-update guard).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.incidents.v1') setIncidents(incidentRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filtered = useMemo(() => filterIncidents(incidents, filter), [incidents, filter]);
  const responsibleOptions = useMemo(() => [...new Set(incidents.map((i) => i.responsible).filter(Boolean))].sort(), [incidents]);

  const selected = selectedId ? incidents.find((i) => i.id === selectedId) ?? null : null;

  const save = (i: Incident) => { setIncidents(incidentRepo.save(i)); setEditing(null); ui.toast('Incident saved', 'bg-green-700'); };
  const del = (i: Incident) => ui.confirm(`Delete "${i.id}"?`, 'This cannot be undone.', () => { setIncidents(incidentRepo.remove(i.id)); setSelectedId(null); ui.toast('Incident deleted', 'bg-red-700'); });
  const openEdit = (i: Incident) => { setSelectedId(null); setEditing(i); };

  const ttc = selected ? timeToClosureDays(selected) : null;

  return (
    <>
      <PageHeader>
        <ImportExport spec={incidentIo} exportSource={filtered} existing={incidents} canImport={perms.create} canExport={perms.export} onImported={(items) => setIncidents(incidentRepo.bulkSave(items))} />
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ Report Incident</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample incidents and discards your changes.', () => { setIncidents(incidentRepo.reset()); setSelectedId(null); ui.toast('Demo data restored', 'bg-green-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        <IncidentFilters filter={filter} setFilter={setFilter} responsibleOptions={responsibleOptions} shown={filtered.length} total={incidents.length} />
        <IncidentsDashboard incidents={filtered} />
        <IncidentList incidents={filtered} canEdit={perms.edit} canRemove={perms.remove} onView={(i) => setSelectedId(i.id)} onEdit={openEdit} onDelete={del} />
      </div>

      {/* Detail drawer */}
      {selected && (
        <Drawer
          open
          onClose={() => setSelectedId(null)}
          title={`${selected.id} — ${selected.shortDesc}`}
          subtitle={`${categoryLabel(selected)} · ${selected.asset || 'No asset'}`}
          icon={<Icon name="bolt" size={22} />}
          footer={perms.edit ? <button onClick={() => openEdit(selected)} className="bg-blue-600 text-white w-full rounded px-3 py-2 text-sm font-semibold">Edit incident</button> : undefined}
        >
          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              <Pill text={selected.severity} k={severityColor(selected.severity)} />
              <Pill text={statusLabel(selected.status)} k={statusColor(selected.status)} />
            </div>
            <div>
              <DetailRow label="Time reported" value={fmtDateTime(selected.reportedAt)} />
              <DetailRow label="Incident time" value={fmtDateTime(selected.occurredAt)} />
              <DetailRow label="Reported by" value={selected.reportedBy} />
              <DetailRow label="Category" value={categoryLabel(selected)} />
              <DetailRow label="Affected asset" value={selected.asset} />
              <DetailRow label="Responsible" value={selected.responsible || 'Unassigned'} />
              <DetailRow label="Closure date" value={fmtDate(selected.closedAt)} />
              <DetailRow label="Time to closure" value={ttc == null ? 'Not closed' : `${ttc} day${ttc === 1 ? '' : 's'}`} />
            </div>
            <div>
              <div className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text3)' }}>Description</div>
              <p className="text-sm" style={{ color: 'var(--text)' }}>{selected.description || 'No description provided.'}</p>
            </div>
            <div>
              <div className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text3)' }}>Root cause</div>
              <p className="text-sm" style={{ color: 'var(--text)' }}>{selected.rootCause || 'Not determined yet.'}</p>
            </div>
            <div>
              <div className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text3)' }}>Corrective action</div>
              <p className="text-sm" style={{ color: 'var(--text)' }}>{selected.correctiveAction || 'None recorded yet.'}</p>
            </div>
            {perms.remove && (
              <button onClick={() => del(selected)} className="text-red-500 text-xs hover:underline">Delete incident</button>
            )}
          </div>
        </Drawer>
      )}

      {editing && <IncidentModal incident={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
