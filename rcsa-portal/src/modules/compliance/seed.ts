import type { ComplianceControl, ControlStatus, Framework } from './types';

// Deterministic demo data (sanitized/fake). One row per control across 5 frameworks.
type Row = [Framework, string, string, string, ControlStatus, boolean, string, string];

const ROWS: Row[] = [
  // ── ISO 27001 ──
  ['ISO 27001', 'A.5.1', 'Information security policies', 'Organizational', 'Implemented', true, 'Nino Gelashvili', '2025-03-10'],
  ['ISO 27001', 'A.5.20', 'Security in supplier agreements', 'Organizational', 'In Progress', false, 'Tamar Kvirikashvili', '2025-04-02'],
  ['ISO 27001', 'A.5.30', 'ICT readiness for continuity', 'Organizational', 'Not Started', false, 'Levan Robakidze', '2025-01-15'],
  ['ISO 27001', 'A.6.3', 'Security awareness & training', 'People', 'In Progress', true, 'Nino Gelashvili', '2025-04-18'],
  ['ISO 27001', 'A.8.1', 'User endpoint devices', 'Technological', 'Implemented', true, 'Tamar Kvirikashvili', '2025-03-22'],
  ['ISO 27001', 'A.8.5', 'Secure authentication', 'Technological', 'Implemented', true, 'Giorgi Beridze', '2025-04-05'],
  ['ISO 27001', 'A.8.7', 'Protection against malware', 'Technological', 'In Progress', true, 'Giorgi Beridze', '2025-05-01'],
  ['ISO 27001', 'A.8.8', 'Management of technical vulnerabilities', 'Technological', 'In Progress', false, 'Tamar Kvirikashvili', '2025-04-29'],
  ['ISO 27001', 'A.8.12', 'Data leakage prevention', 'Technological', 'In Progress', false, 'Salome Tsiklauri', '2025-04-11'],
  ['ISO 27001', 'A.8.15', 'Logging', 'Technological', 'Implemented', true, 'Tamar Kvirikashvili', '2025-03-30'],
  ['ISO 27001', 'A.8.16', 'Monitoring activities', 'Technological', 'Not Started', false, 'Tamar Kvirikashvili', '2025-02-08'],
  ['ISO 27001', 'A.8.24', 'Use of cryptography', 'Technological', 'Implemented', true, 'Davit Maisuradze', '2025-04-15'],
  // ── NIST CSF ──
  ['NIST CSF', 'GV.PO-1', 'Policy established & communicated', 'Govern', 'Implemented', true, 'Elene Kapanadze', '2025-03-12'],
  ['NIST CSF', 'ID.AM-1', 'Hardware/software asset inventory', 'Identify', 'Implemented', true, 'Tamar Kvirikashvili', '2025-03-20'],
  ['NIST CSF', 'PR.AC-1', 'Identities & credentials managed', 'Protect', 'In Progress', true, 'Giorgi Beridze', '2025-04-08'],
  ['NIST CSF', 'PR.DS-1', 'Data-at-rest protected', 'Protect', 'Implemented', true, 'Davit Maisuradze', '2025-04-16'],
  ['NIST CSF', 'DE.CM-1', 'Network monitored for events', 'Detect', 'In Progress', false, 'Tamar Kvirikashvili', '2025-04-25'],
  ['NIST CSF', 'RS.RP-1', 'Response plan executed', 'Respond', 'Not Started', false, 'Giorgi Beridze', '2025-02-01'],
  ['NIST CSF', 'RC.RP-1', 'Recovery plan executed', 'Recover', 'Not Started', false, 'Levan Robakidze', '2025-01-28'],
  // ── PCI-DSS ──
  ['PCI-DSS', 'Req 1', 'Install & maintain firewalls', 'Network', 'Implemented', true, 'Tamar Kvirikashvili', '2025-04-01'],
  ['PCI-DSS', 'Req 2', 'No vendor-supplied defaults', 'Config', 'Implemented', true, 'Tamar Kvirikashvili', '2025-04-01'],
  ['PCI-DSS', 'Req 3', 'Protect stored cardholder data', 'Data', 'In Progress', false, 'Davit Maisuradze', '2025-04-20'],
  ['PCI-DSS', 'Req 4', 'Encrypt transmission of CHD', 'Data', 'Implemented', true, 'Giorgi Beridze', '2025-04-10'],
  ['PCI-DSS', 'Req 6', 'Develop secure systems', 'AppSec', 'In Progress', false, 'Davit Maisuradze', '2025-04-22'],
  ['PCI-DSS', 'Req 8', 'Identify & authenticate access', 'Access', 'Implemented', true, 'Giorgi Beridze', '2025-04-12'],
  ['PCI-DSS', 'Req 10', 'Track & monitor access', 'Logging', 'In Progress', false, 'Tamar Kvirikashvili', '2025-04-28'],
  ['PCI-DSS', 'Req 11', 'Regularly test security', 'Testing', 'Not Started', false, 'Tamar Kvirikashvili', '2025-02-15'],
  // ── SOC 2 ──
  ['SOC 2', 'CC1', 'Control environment', 'Governance', 'Implemented', true, 'Elene Kapanadze', '2025-03-08'],
  ['SOC 2', 'CC2', 'Communication & information', 'Governance', 'Implemented', true, 'Elene Kapanadze', '2025-03-08'],
  ['SOC 2', 'CC5', 'Control activities', 'Operations', 'In Progress', false, 'Tamar Kvirikashvili', '2025-04-14'],
  ['SOC 2', 'CC6', 'Logical & physical access', 'Security', 'In Progress', true, 'Giorgi Beridze', '2025-04-18'],
  ['SOC 2', 'CC7', 'System operations', 'Operations', 'In Progress', false, 'Tamar Kvirikashvili', '2025-04-21'],
  ['SOC 2', 'CC8', 'Change management', 'Operations', 'Not Started', false, 'Davit Maisuradze', '2025-02-10'],
  // ── GDPR ──
  ['GDPR', 'Art.5', 'Principles of processing', 'Principles', 'In Progress', false, 'Salome Tsiklauri', '2025-03-15'],
  ['GDPR', 'Art.6', 'Lawfulness of processing', 'Legal', 'Implemented', true, 'Salome Tsiklauri', '2025-03-15'],
  ['GDPR', 'Art.30', 'Records of processing', 'Accountability', 'In Progress', false, 'Salome Tsiklauri', '2025-04-02'],
  ['GDPR', 'Art.32', 'Security of processing', 'Security', 'In Progress', true, 'Tamar Kvirikashvili', '2025-04-19'],
  ['GDPR', 'Art.33', 'Breach notification', 'Response', 'Not Started', false, 'Giorgi Beridze', '2025-02-20'],
  ['GDPR', 'Art.35', 'Data protection impact assessment', 'Privacy', 'Not Started', false, 'Salome Tsiklauri', '2025-01-30'],
];

export const SEED_CONTROLS: ComplianceControl[] = ROWS.map((r, i) => ({
  id: `CTL-${String(i + 1).padStart(3, '0')}`,
  framework: r[0],
  ref: r[1],
  title: r[2],
  domain: r[3],
  status: r[4],
  evidence: r[5],
  owner: r[6],
  assessed: r[7],
}));
