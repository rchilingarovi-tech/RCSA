import type { Criticality, Vendor, VendorStatus } from './types';

// Deterministic demo data (sanitized/fake). Dates are relative to "now" so the
// renewal / expired states stay realistic regardless of when the demo is opened.
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

type Row = [
  string, string, string, Criticality, boolean, number,
  number, number, VendorStatus, string[], string, string, string, string,
];

const ROWS: Row[] = [
  ['VEN-01', 'Amazon Web Services', 'Cloud Infrastructure', 'Critical', true, 18, 280, -135, 'Active', ['ISO 27001', 'SOC 2 Type II', 'PCI-DSS'], '4 hrs', 'Passed (latest cycle)', 'Tested annually', 'Encrypted at rest & transit; EU region'],
  ['VEN-02', 'Microsoft 365', 'Productivity Suite', 'Critical', true, 22, 95, -160, 'Active', ['ISO 27001', 'SOC 2 Type II'], '8 hrs', 'Passed (latest cycle)', 'Documented', 'Encrypted; data residency configurable'],
  ['VEN-03', 'Temenos (Core Banking)', 'Banking Software', 'Critical', true, 38, 40, -230, 'Active', ['ISO 27001'], '24 hrs', 'Remediation pending', 'Partial', 'On-prem + hosted; CHD in scope'],
  ['VEN-04', 'Cloudflare', 'Network Security', 'High', false, 16, 200, -110, 'Active', ['ISO 27001', 'SOC 2 Type II'], '2 hrs', 'Passed (latest cycle)', 'Tested', 'No customer data stored'],
  ['VEN-05', 'Visa / Mastercard Gateway', 'Payment Processing', 'Critical', true, 28, 370, -130, 'Active', ['PCI-DSS Level 1'], '4 hrs', 'Passed (latest cycle)', 'Tested annually', 'Tokenized cardholder data'],
  ['VEN-06', 'Salesforce', 'CRM', 'Medium', true, 31, 70, -260, 'Active', ['ISO 27001', 'SOC 2 Type II'], '12 hrs', 'Passed (latest cycle)', 'Documented', 'Customer & sales PII'],
  ['VEN-07', 'LocalTech Managed Services', 'Managed IT', 'Medium', true, 52, 25, -200, 'Active', ['ISO 27001 (in progress)'], '48 hrs', 'Not provided', 'Not documented', 'Privileged access to systems'],
  ['VEN-08', 'Iron Mountain', 'Records Storage', 'Low', false, 20, 240, -150, 'Active', ['ISO 27001'], '72 hrs', 'N/A', 'Documented', 'Physical records only'],
  ['VEN-09', 'SendGrid', 'Email Delivery', 'Medium', true, 27, 110, -240, 'Active', ['SOC 2 Type II'], '8 hrs', 'Passed (latest cycle)', 'Documented', 'Email metadata & content'],
  ['VEN-10', 'PrintWorks Ltd.', 'Document Printing', 'Low', false, 58, -10, -315, 'Offboarded', [], 'No SLA', 'Not provided', 'Not documented', 'Printed documents (PII)'],
];

export const SEED_VENDORS: Vendor[] = ROWS.map((r) => {
  const assessed = iso(r[7]);
  return {
    id: r[0],
    name: r[1],
    category: r[2],
    criticality: r[3],
    dataAccess: r[4],
    score: r[5],
    expiry: iso(r[6]),
    assessed,
    status: r[8],
    certs: r[9],
    sla: r[10],
    pentest: r[11],
    bcp: r[12],
    dataNote: r[13],
    history: [
      { date: assessed, note: 'Annual security assessment completed' },
      { date: iso(r[7] - 200), note: 'Initial onboarding review' },
    ],
  };
});
