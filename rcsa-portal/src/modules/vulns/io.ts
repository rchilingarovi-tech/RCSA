import { parseEnum, parseNumIn, type IoSpec } from '../../lib/tableIo';
import { VULN_SEVERITIES, VULN_SOURCES, VULN_STATUSES, slaDaysLeft, slaDeadline, type Vuln } from './types';

export const vulnIo: IoSpec<Vuln> = {
  entity: 'Vulnerability',
  filePrefix: 'vulnerabilities',
  idPrefix: 'VUL',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Vulnerability ID'], value: (v) => v.id },
    { header: 'Title', required: true, value: (v) => v.title, apply: (raw, d) => { d.title = raw; } },
    { header: 'Source', value: (v) => v.source, apply: (raw, d, bad) => { const e = parseEnum(raw, VULN_SOURCES); if (!e) bad(`"${raw}" must be: ${VULN_SOURCES.join(', ')}`); else d.source = e; } },
    { header: 'Reference', aliases: ['Ref', 'CVE'], value: (v) => v.ref, apply: (raw, d) => { d.ref = raw; } },
    { header: 'Asset', value: (v) => v.asset, apply: (raw, d) => { d.asset = raw; } },
    { header: 'Severity', value: (v) => v.severity, apply: (raw, d, bad) => { const e = parseEnum(raw, VULN_SEVERITIES); if (!e) bad(`"${raw}" must be: ${VULN_SEVERITIES.join(', ')}`); else d.severity = e; } },
    { header: 'CVSS', value: (v) => v.cvss, apply: (raw, d, bad) => { const n = parseNumIn(raw, 0, 10); if (n === null) bad(`"${raw}" must be 0–10`); else d.cvss = raw; } },
    { header: 'Discovered', value: (v) => v.discovered, apply: (raw, d) => { d.discovered = raw; } },
    { header: 'SLA Deadline', value: (v) => slaDeadline(v) }, // derived, export-only
    { header: 'Days Left', value: (v) => slaDaysLeft(v) ?? '' }, // derived, export-only
    { header: 'Owner', value: (v) => v.owner, apply: (raw, d) => { d.owner = raw; } },
    { header: 'Status', value: (v) => v.status, apply: (raw, d, bad) => { const e = parseEnum(raw, VULN_STATUSES); if (!e) bad(`"${raw}" must be: ${VULN_STATUSES.join(', ')}`); else d.status = e; } },
    { header: 'Description', value: (v) => v.description, apply: (raw, d) => { d.description = raw; } },
    { header: 'Remediation', value: (v) => v.remediation, apply: (raw, d) => { d.remediation = raw; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    title: d.title ?? prev?.title ?? '',
    source: d.source ?? prev?.source ?? 'Vulnerability Scan',
    ref: d.ref ?? prev?.ref ?? '',
    asset: d.asset ?? prev?.asset ?? '',
    severity: d.severity ?? prev?.severity ?? 'Medium',
    cvss: d.cvss ?? prev?.cvss ?? '',
    discovered: d.discovered ?? prev?.discovered ?? '',
    owner: d.owner ?? prev?.owner ?? '',
    status: d.status ?? prev?.status ?? 'Open',
    description: d.description ?? prev?.description ?? '',
    remediation: d.remediation ?? prev?.remediation ?? '',
  }),
};
