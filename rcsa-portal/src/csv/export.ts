import type { Asset, Risk } from '../data/models';
import { assetValue, criticality, riskLevel, isOverdue, today } from '../domain/scoring';

// CSV export — ported from New Version.html L560-591.

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
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
  downloadCsv(`rcsa-assets-${today}.csv`, rows);
}

export function exportRisksCsv(risks: Risk[], assets: Asset[]): void {
  const rows: (string | number)[][] = [
    [
      'Risk ID', 'Asset ID', 'Asset Name', 'Threat', 'Vulnerability', 'Owner',
      'Inherent Score', 'Inherent Level', 'Residual Score', 'Residual Level', 'Decision',
      'Treatment Status', 'Responsible', 'Deadline', 'Overdue', 'Controls', 'Action Plan',
      'Acceptance Expiry', 'Submitted At',
    ],
  ];
  risks.forEach((r) => {
    const a = assets.find((x) => x.id === r.assetId);
    const inherent = r.impact * r.likelihood;
    const residual = r.resImpact * r.resLikelihood;
    rows.push([
      r.id, r.assetId, a?.name || '', r.threat, r.vuln, r.owner,
      inherent, riskLevel(inherent)[0], residual, riskLevel(residual)[0], r.assessment,
      isOverdue(r) ? 'Overdue' : r.treatmentStatus, r.responsible, r.deadline,
      isOverdue(r) ? 'Yes' : 'No', (r.controls || []).join('; '), r.actionPlan,
      r.acceptanceExpiry, r.submittedAt,
    ]);
  });
  downloadCsv(`rcsa-risks-${today}.csv`, rows);
}
