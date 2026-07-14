import type { Asset, Risk, Treatment } from '../data/models';
import { assetValue, criticality, riskLevel, residualScore, riskStatus, treatmentStatus, today } from '../domain/scoring';

// CSV export — ported from New Version.html L560-591.

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  // Neutralize spreadsheet formula injection (cells starting = + - @ / tab / CR
  // execute in Excel/Sheets): prefix with ' to force text. Output changes only
  // for hostile-shaped input.
  const esc = (v: string | number) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportAssetsCsv(assets: Asset[]): void {
  const rows: (string | number)[][] = [
    [
      'Asset ID', 'Name', 'Process', 'Department', 'Business Owner', 'IT Owner', 'Applicant',
      'C', 'I', 'A', 'Value', 'Criticality', 'Data Class', 'PCI', 'Critical Process',
      'Internet Facing', 'Third Party', 'Cloud', 'Status', 'Review Date', 'Submitted At', 'Notes',
    ],
  ];
  assets.forEach((a) => {
    const v = assetValue(a);
    rows.push([
      a.id, a.name, a.process, a.department, a.busOwner, a.itOwner, a.applicantName,
      a.c, a.i, a.a, v, criticality(v)[0], a.dataClass, a.pci, a.criticalProcess,
      a.internet, a.thirdParty, a.cloud, a.status, a.reviewDate, a.submittedAt, a.notes,
    ]);
  });
  downloadCsv(`rcsa-assets-${today()}.csv`, rows);
}

export function exportRisksCsv(risks: Risk[], assets: Asset[], treatments: Treatment[]): void {
  const rows: (string | number)[][] = [
    [
      'Risk ID', 'Asset ID', 'Asset Name', 'Threat', 'Vulnerability', 'Owner',
      'Inherent Score', 'Inherent Level', 'Residual Score', 'Residual Level', 'Decision',
      'Treatment Status', 'Treatments', 'Controls', 'Acceptance Expiry', 'Submitted At',
    ],
  ];
  risks.forEach((r) => {
    const linked = r.assetIds.map((id) => assets.find((x) => x.id === id)).filter(Boolean) as typeof assets;
    const assetIdCell = r.assetIds.join('; ');
    const assetNameCell = linked.map((a) => a.name).join('; ');
    const trtIds = treatments.filter((t) => t.riskIds.includes(r.id)).map((t) => t.id).join('; ');
    const inherent = r.impact * r.likelihood;
    const residual = residualScore(r);
    rows.push([
      r.id, assetIdCell, assetNameCell, r.threat, r.vuln, r.owner,
      inherent, riskLevel(inherent)[0], residual ?? '', residual == null ? '' : riskLevel(residual)[0], r.assessment,
      riskStatus(r, treatments), trtIds, (r.controls || []).join('; '),
      r.acceptanceExpiry, r.submittedAt,
    ]);
  });
  downloadCsv(`rcsa-risks-${today()}.csv`, rows);
}

export function exportTreatmentsCsv(treatments: Treatment[]): void {
  const rows: (string | number)[][] = [
    [
      'Treatment ID', 'Title', 'Risk IDs', 'Owner', 'Due Date', 'Status',
      'Description', 'Evidence', 'Comments', 'Submitted At',
    ],
  ];
  treatments.forEach((t) => {
    rows.push([
      t.id, t.title, t.riskIds.join('; '), t.owner, t.dueDate, treatmentStatus(t),
      t.description, (t.evidence || []).join('; '), (t.comments || []).join(' | '), t.submittedAt,
    ]);
  });
  downloadCsv(`rcsa-treatments-${today()}.csv`, rows);
}
