import { parseEnum, type IoSpec } from '../../lib/tableIo';
import { CATEGORIES, INCIDENT_STATUSES, SEVERITIES, type Incident } from './types';

export const incidentIo: IoSpec<Incident> = {
  entity: 'Incident',
  filePrefix: 'incidents',
  idPrefix: 'INC',
  pad: 3,
  cols: [
    { header: 'ID', aliases: ['Incident ID'], value: (i) => i.id },
    { header: 'Short Description', aliases: ['Title'], required: true, value: (i) => i.shortDesc, apply: (raw, d) => { d.shortDesc = raw; } },
    { header: 'Reported At', aliases: ['Time Reported'], value: (i) => i.reportedAt, apply: (raw, d) => { d.reportedAt = raw; } },
    { header: 'Occurred At', aliases: ['Incident Time'], value: (i) => i.occurredAt, apply: (raw, d) => { d.occurredAt = raw; } },
    { header: 'Reported By', value: (i) => i.reportedBy, apply: (raw, d) => { d.reportedBy = raw; } },
    { header: 'Category', value: (i) => i.category, apply: (raw, d, bad) => { const e = parseEnum(raw, CATEGORIES); if (!e) bad(`"${raw}" must be: ${CATEGORIES.join(', ')}`); else d.category = e; } },
    { header: 'Category Other', value: (i) => i.categoryOther, apply: (raw, d) => { d.categoryOther = raw; } },
    { header: 'Severity', value: (i) => i.severity, apply: (raw, d, bad) => { const e = parseEnum(raw, SEVERITIES); if (!e) bad(`"${raw}" must be: ${SEVERITIES.join(', ')}`); else d.severity = e; } },
    { header: 'Asset', aliases: ['Affected Asset'], value: (i) => i.asset, apply: (raw, d) => { d.asset = raw; } },
    { header: 'Status', value: (i) => i.status, apply: (raw, d, bad) => { const e = parseEnum(raw, INCIDENT_STATUSES); if (!e) bad(`"${raw}" must be: ${INCIDENT_STATUSES.join(', ')}`); else d.status = e; } },
    { header: 'Responsible', value: (i) => i.responsible, apply: (raw, d) => { d.responsible = raw; } },
    { header: 'Closed At', aliases: ['Closure Date'], value: (i) => i.closedAt, apply: (raw, d) => { d.closedAt = raw; } },
    { header: 'Description', value: (i) => i.description, apply: (raw, d) => { d.description = raw; } },
    { header: 'Root Cause', value: (i) => i.rootCause, apply: (raw, d) => { d.rootCause = raw; } },
    { header: 'Corrective Action', value: (i) => i.correctiveAction, apply: (raw, d) => { d.correctiveAction = raw; } },
  ],
  build: (d, prev) => {
    const status = d.status ?? prev?.status ?? 'Open';
    return {
      id: d.id,
      shortDesc: d.shortDesc ?? prev?.shortDesc ?? '',
      reportedAt: d.reportedAt ?? prev?.reportedAt ?? new Date().toISOString().slice(0, 16),
      occurredAt: d.occurredAt ?? prev?.occurredAt ?? '',
      reportedBy: d.reportedBy ?? prev?.reportedBy ?? '',
      category: d.category ?? prev?.category ?? 'Other',
      categoryOther: d.categoryOther ?? prev?.categoryOther ?? '',
      severity: d.severity ?? prev?.severity ?? 'Medium',
      asset: d.asset ?? prev?.asset ?? '',
      description: d.description ?? prev?.description ?? '',
      rootCause: d.rootCause ?? prev?.rootCause ?? '',
      correctiveAction: d.correctiveAction ?? prev?.correctiveAction ?? '',
      status,
      responsible: d.responsible ?? prev?.responsible ?? '',
      // Closure date only meaningful when Closed — mirrors the form's rule.
      closedAt: status === 'Closed' ? (d.closedAt ?? prev?.closedAt ?? '') : '',
    };
  },
};
