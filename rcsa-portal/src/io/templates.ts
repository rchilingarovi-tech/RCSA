import { today } from '../domain/scoring';

// Pre-drafted CSV templates the user fills in and imports. Each file has a header
// row + one example row (delete it before importing). No third-party library —
// the previous `xlsx` dependency was dropped because it carried known CVEs.
// Allowed values for constrained columns are enforced (and explained) by the
// importer's row-level error messages.

function downloadCsv(filename: string, headers: string[], example: Record<string, string | number>): void {
  const cell = (v: string | number) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const rows = [headers.map(cell).join(','), headers.map((h) => cell(example[h] ?? '')).join(',')];
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ASSET_HEADERS = [
  'Asset ID', 'Name', 'Process', 'Department', 'Business Owner', 'IT Owner', 'Applicant',
  'C', 'I', 'A', 'Data Class', 'PCI', 'Critical Process', 'Internet Facing', 'Third Party',
  'Cloud', 'Status', 'Review Date', 'Evidence', 'Notes',
];

export function downloadAssetTemplate(): void {
  downloadCsv(`rcsa-assets-template-${today}.csv`, ASSET_HEADERS, {
    'Asset ID': '', // leave blank to auto-generate (AST-###); an existing ID updates that asset
    Name: 'Example Payroll Server',
    Process: 'Payroll',
    Department: 'Human Resources',
    'Business Owner': 'HR Director',
    'IT Owner': 'IT Applications',
    Applicant: 'Jane Doe',
    C: 3, I: 2, A: 2, // 1 (Low), 2 (Med), 3 (High)
    'Data Class': 'Personal Data',
    PCI: 'No',
    'Critical Process': 'No',
    'Internet Facing': 'No',
    'Third Party': 'Yes',
    Cloud: 'Yes',
    Status: 'Draft',
    'Review Date': '2026-12-31', // YYYY-MM-DD
    Evidence: 'Architecture diagram; DPA signed', // separate items with ;
    Notes: 'One row per asset. Delete this example row before importing.',
  });
}

const RISK_HEADERS = [
  'Risk ID', 'Asset ID', 'Threat', 'Vulnerability', 'Owner',
  'Impact', 'Likelihood', 'Residual Impact', 'Residual Likelihood',
  'Decision', 'Controls', 'Acceptance Expiry', 'Evidence', 'Comments',
];

export function downloadRiskTemplate(): void {
  downloadCsv(`rcsa-risks-template-${today}.csv`, RISK_HEADERS, {
    'Risk ID': '', // blank = auto-generate (RSK-###)
    'Asset ID': 'AST-001; AST-002', // one or more existing asset IDs, separated by ;
    Threat: 'Malware infection',
    Vulnerability: 'Unpatched DB engine',
    Owner: 'IT Division',
    Impact: 5, Likelihood: 3, 'Residual Impact': 3, 'Residual Likelihood': 2, // 1-5
    Decision: 'Mitigate', // Mitigate / Accept
    Controls: 'Backup exists; Antivirus/EDR installed', // separate with ;
    'Acceptance Expiry': '', // YYYY-MM-DD, used when Decision = Accept
    Evidence: '',
    Comments: 'One row per risk. Treatment plans go in the Treatments template. Delete this row before importing.',
  });
}

const TREATMENT_HEADERS = [
  'Treatment ID', 'Title', 'Risk ID', 'Owner', 'Due Date', 'Status',
  'Description', 'Evidence', 'Comments',
];

export function downloadTreatmentTemplate(): void {
  downloadCsv(`rcsa-treatments-template-${today}.csv`, TREATMENT_HEADERS, {
    'Treatment ID': '', // blank = auto-generate (TRT-###)
    Title: 'Patch and harden DB engine',
    'Risk ID': 'RSK-001; RSK-002', // one or more existing risk IDs, separated by ;
    Owner: 'DB Team',
    'Due Date': '2026-08-15', // YYYY-MM-DD
    Status: 'In Progress', // Open / In Progress / Completed / Overdue
    Description: 'Apply latest patches, disable legacy protocols, re-scan.',
    Evidence: '',
    Comments: 'One row per treatment. Delete this example row before importing.',
  });
}
