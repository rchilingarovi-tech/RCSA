import { parseEnum, type IoSpec } from '../../lib/tableIo';
import { DIRECTIONS, rag, ragLabel, type Kpi } from './types';

export const kpiIo: IoSpec<Kpi> = {
  entity: 'KPI',
  filePrefix: 'kpis',
  idPrefix: 'KPI',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['KPI ID'], value: (k) => k.id },
    { header: 'Name', required: true, value: (k) => k.name, apply: (raw, d) => { d.name = raw; } },
    { header: 'Target', value: (k) => k.target, apply: (raw, d, bad) => { const n = Number(raw); if (!Number.isFinite(n)) bad(`"${raw}" must be a number`); else d.target = n; } },
    { header: 'Current', value: (k) => k.current, apply: (raw, d, bad) => { const n = Number(raw); if (!Number.isFinite(n)) bad(`"${raw}" must be a number`); else d.current = n; } },
    { header: 'Unit', value: (k) => k.unit, apply: (raw, d) => { d.unit = raw; } },
    { header: 'Direction', value: (k) => k.direction, apply: (raw, d, bad) => { const e = parseEnum(raw, DIRECTIONS); if (!e) bad(`"${raw}" must be: ${DIRECTIONS.join(', ')}`); else d.direction = e; } },
    { header: 'RAG', value: (k) => ragLabel(rag(k)) }, // computed, export-only
    { header: 'History', value: (k) => k.history, apply: (raw, d) => { d.history = raw; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    name: d.name ?? prev?.name ?? '',
    target: d.target ?? prev?.target ?? 0,
    current: d.current ?? prev?.current ?? 0,
    unit: d.unit ?? prev?.unit ?? '',
    direction: d.direction ?? prev?.direction ?? 'Higher is better',
    history: d.history ?? prev?.history ?? '',
  }),
};
