import { parseNumIn, type IoSpec } from '../../lib/tableIo';
import type { AccessReview } from './types';

export const accessIo: IoSpec<AccessReview> = {
  entity: 'Access review',
  filePrefix: 'access-reviews',
  idPrefix: 'ACR',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Campaign ID'], value: (r) => r.id },
    { header: 'Campaign', required: true, value: (r) => r.campaign, apply: (raw, d) => { d.campaign = raw; } },
    { header: 'Scope', value: (r) => r.scope, apply: (raw, d) => { d.scope = raw; } },
    { header: 'Period', value: (r) => r.period, apply: (raw, d) => { d.period = raw; } },
    { header: 'Reviewer', value: (r) => r.reviewer, apply: (raw, d) => { d.reviewer = raw; } },
    { header: 'Due', aliases: ['Due Date'], value: (r) => r.due, apply: (raw, d) => { d.due = raw; } },
    { header: 'Progress %', aliases: ['Progress'], value: (r) => r.progress, apply: (raw, d, bad) => { const n = parseNumIn(raw, 0, 100); if (n === null) bad(`"${raw}" must be 0–100`); else d.progress = n; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    campaign: d.campaign ?? prev?.campaign ?? '',
    scope: d.scope ?? prev?.scope ?? '',
    period: d.period ?? prev?.period ?? '',
    reviewer: d.reviewer ?? prev?.reviewer ?? '',
    due: d.due ?? prev?.due ?? '',
    progress: d.progress ?? prev?.progress ?? 0,
  }),
};
