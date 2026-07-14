import { parseEnum, type IoSpec } from '../../lib/tableIo';
import { DOC_STATUSES, DOC_TYPES, type PolicyDoc } from './types';

export const policyIo: IoSpec<PolicyDoc> = {
  entity: 'Document',
  filePrefix: 'documents',
  idPrefix: 'POL',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Document ID'], value: (d) => d.id },
    { header: 'Title', required: true, value: (d) => d.title, apply: (raw, x) => { x.title = raw; } },
    { header: 'Type', value: (d) => d.type, apply: (raw, x, bad) => { const e = parseEnum(raw, DOC_TYPES); if (!e) bad(`"${raw}" must be: ${DOC_TYPES.join(', ')}`); else x.type = e; } },
    { header: 'Version', value: (d) => d.version, apply: (raw, x) => { x.version = raw; } },
    { header: 'Status', value: (d) => d.status, apply: (raw, x, bad) => { const e = parseEnum(raw, DOC_STATUSES); if (!e) bad(`"${raw}" must be: ${DOC_STATUSES.join(', ')}`); else x.status = e; } },
    { header: 'Owner', value: (d) => d.owner, apply: (raw, x) => { x.owner = raw; } },
    { header: 'Next review', aliases: ['Next Review Date'], value: (d) => d.nextReview, apply: (raw, x) => { x.nextReview = raw; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    title: d.title ?? prev?.title ?? '',
    type: d.type ?? prev?.type ?? 'Policy',
    version: d.version ?? prev?.version ?? '1.0',
    status: d.status ?? prev?.status ?? 'Draft',
    owner: d.owner ?? prev?.owner ?? '',
    nextReview: d.nextReview ?? prev?.nextReview ?? '',
  }),
};
