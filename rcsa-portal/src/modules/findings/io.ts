import { parseEnum, type IoSpec } from '../../lib/tableIo';
import { FINDING_SEVERITIES, FINDING_SOURCES, FINDING_STATUSES, overdueDays, type Finding } from './types';

export const findingIo: IoSpec<Finding> = {
  entity: 'Finding',
  filePrefix: 'audit-findings',
  idPrefix: 'FND',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Finding ID'], value: (f) => f.id },
    { header: 'Title', required: true, value: (f) => f.title, apply: (raw, d) => { d.title = raw; } },
    { header: 'Source', value: (f) => f.source, apply: (raw, d, bad) => { const e = parseEnum(raw, FINDING_SOURCES); if (!e) bad(`"${raw}" must be: ${FINDING_SOURCES.join(', ')}`); else d.source = e; } },
    { header: 'Reference', aliases: ['Ref'], value: (f) => f.ref, apply: (raw, d) => { d.ref = raw; } },
    { header: 'Severity', value: (f) => f.severity, apply: (raw, d, bad) => { const e = parseEnum(raw, FINDING_SEVERITIES); if (!e) bad(`"${raw}" must be: ${FINDING_SEVERITIES.join(', ')}`); else d.severity = e; } },
    { header: 'Owner', value: (f) => f.owner, apply: (raw, d) => { d.owner = raw; } },
    { header: 'Due Date', aliases: ['Due'], value: (f) => f.dueDate, apply: (raw, d) => { d.dueDate = raw; } },
    { header: 'Status', value: (f) => f.status, apply: (raw, d, bad) => { const e = parseEnum(raw, FINDING_STATUSES); if (!e) bad(`"${raw}" must be: ${FINDING_STATUSES.join(', ')}`); else d.status = e; } },
    { header: 'Overdue Days', value: (f) => overdueDays(f) }, // computed, export-only
    { header: 'Description', value: (f) => f.description, apply: (raw, d) => { d.description = raw; } },
    { header: 'Action Plan', value: (f) => f.actionPlan, apply: (raw, d) => { d.actionPlan = raw; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    title: d.title ?? prev?.title ?? '',
    source: d.source ?? prev?.source ?? 'Internal Audit',
    ref: d.ref ?? prev?.ref ?? '',
    severity: d.severity ?? prev?.severity ?? 'Medium',
    owner: d.owner ?? prev?.owner ?? '',
    dueDate: d.dueDate ?? prev?.dueDate ?? '',
    status: d.status ?? prev?.status ?? 'Open',
    description: d.description ?? prev?.description ?? '',
    actionPlan: d.actionPlan ?? prev?.actionPlan ?? '',
  }),
};
