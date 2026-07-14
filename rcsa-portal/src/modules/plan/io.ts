import { parseEnum, parseNumIn, type IoSpec } from '../../lib/tableIo';
import { CATEGORIES, PRIORITIES, QUARTERS, type Initiative } from './types';

export const planIo: IoSpec<Initiative> = {
  entity: 'Initiative',
  filePrefix: 'yearly-plan',
  idPrefix: 'INI',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Initiative ID'], value: (i) => i.id },
    { header: 'Initiative', aliases: ['Title'], required: true, value: (i) => i.initiative, apply: (raw, d) => { d.initiative = raw; } },
    { header: 'Category', value: (i) => i.category, apply: (raw, d, bad) => { const e = parseEnum(raw, CATEGORIES); if (!e) bad(`"${raw}" must be: ${CATEGORIES.join(', ')}`); else d.category = e; } },
    { header: 'Quarter', value: (i) => i.quarter, apply: (raw, d, bad) => { const e = parseEnum(raw, QUARTERS); if (!e) bad(`"${raw}" must be: ${QUARTERS.join(', ')}`); else d.quarter = e; } },
    { header: 'Owner', value: (i) => i.owner, apply: (raw, d) => { d.owner = raw; } },
    { header: 'Priority', value: (i) => i.priority, apply: (raw, d, bad) => { const e = parseEnum(raw, PRIORITIES); if (!e) bad(`"${raw}" must be: ${PRIORITIES.join(', ')}`); else d.priority = e; } },
    { header: 'Progress %', aliases: ['Progress'], value: (i) => i.progress, apply: (raw, d, bad) => { const n = parseNumIn(raw, 0, 100); if (n === null) bad(`"${raw}" must be 0–100`); else d.progress = n; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    initiative: d.initiative ?? prev?.initiative ?? '',
    category: d.category ?? prev?.category ?? 'Security Operations',
    quarter: d.quarter ?? prev?.quarter ?? 'Q1',
    owner: d.owner ?? prev?.owner ?? '',
    priority: d.priority ?? prev?.priority ?? 'Medium',
    progress: d.progress ?? prev?.progress ?? 0,
  }),
};
