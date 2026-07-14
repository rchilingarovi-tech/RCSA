import { parseEnum, parseList, parseNumIn, type IoSpec } from '../../lib/tableIo';
import { CRITICALITIES, DATA_ACCESS, scoreBand, type Vendor } from './types';

export const vendorIo: IoSpec<Vendor> = {
  entity: 'Vendor',
  filePrefix: 'vendors',
  idPrefix: 'VEN',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Vendor ID'], value: (v) => v.id },
    { header: 'Name', required: true, value: (v) => v.name, apply: (raw, d) => { d.name = raw; } },
    { header: 'Criticality', value: (v) => v.criticality, apply: (raw, d, bad) => { const e = parseEnum(raw, CRITICALITIES); if (!e) bad(`"${raw}" must be: ${CRITICALITIES.join(', ')}`); else d.criticality = e; } },
    { header: 'Data access', value: (v) => v.dataAccess, apply: (raw, d, bad) => { const e = parseEnum(raw, DATA_ACCESS); if (!e) bad(`"${raw}" must be: ${DATA_ACCESS.join(', ')}`); else d.dataAccess = e; } },
    { header: 'Residual score', aliases: ['Score'], value: (v) => v.score, apply: (raw, d, bad) => { const n = parseNumIn(raw, 0, 100); if (n === null) bad(`"${raw}" must be 0–100`); else d.score = n; } },
    { header: 'Band', value: (v) => scoreBand(v.score).label }, // computed, export-only
    { header: 'Contract expiry', value: (v) => v.contractExpiry, apply: (raw, d) => { d.contractExpiry = raw; } },
    { header: 'Certifications', aliases: ['Certs'], value: (v) => v.certs.join('; '), apply: (raw, d) => { d.certs = parseList(raw); } },
  ],
  build: (d, prev) => ({
    id: d.id,
    name: d.name ?? prev?.name ?? '',
    criticality: d.criticality ?? prev?.criticality ?? 'Medium',
    dataAccess: d.dataAccess ?? prev?.dataAccess ?? 'None',
    score: d.score ?? prev?.score ?? 0,
    contractExpiry: d.contractExpiry ?? prev?.contractExpiry ?? '',
    certs: d.certs ?? prev?.certs ?? [],
  }),
};
