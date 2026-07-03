import type {
  Asset, Risk, Treatment, CIA, Score5, YesNo, DataClass, AssetStatus, Assessment, TreatmentStatus,
} from './models';
import { THREAT_CATALOGUE, CONTROL_CATALOGUE } from '../domain/constants';

// ── Demo data generator ─────────────────────────────────────────────────────
// 100 assets + their risks (with full treatment fields), built deterministically
// so IDs/values are stable across reloads. Dates are relative to "now" so the
// overdue / acceptance-expiry stats stay realistic. Reset demo data regenerates.

// Deterministic PRNG (mulberry32) — stable selections every run.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x5f3759df);
const rint = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
const isoOffset = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(3, '0');

function subset<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let k = 0; k < n && copy.length; k++) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
}

const DEPARTMENTS = [
  'Retail Banking', 'Treasury', 'IT Operations', 'Digital Channels', 'Card Center', 'Human Resources',
  'Marketing', 'Compliance', 'Legal', 'Self-Service', 'Operations', 'Finance', 'Procurement',
  'Risk Management', 'Corporate Banking', 'Customer Support',
];
const IT_OWNERS = [
  'IT Division', 'Network Admin', 'SysAdmin', 'App Dev Team', 'IT Applications', 'Infrastructure Team',
  'Cloud Team', 'Security Operations', 'Database Team',
];
const NAMES = [
  'Nino', 'Giorgi', 'Mariam', 'Lasha', 'Tamar', 'Davit', 'Levan', 'Salome', 'Keti', 'Irakli',
  'Ana', 'Nika', 'Tea', 'Vakhtang', 'Sopo', 'Zura', 'Mari', 'Gio', 'Eka', 'Beka',
];
const SYSTEMS = [
  'Core Banking Database', 'SWIFT Messaging Gateway', 'Mobile Banking App API', 'ATM Network Controller',
  'Corporate VPN Gateway', 'Card Personalization System', 'Active Directory Servers', 'HR Information System',
  'Treasury Trading Platform', 'Loan Origination System', 'Internet Banking Portal', 'Payment Switch',
  'Fraud Detection Engine', 'Data Warehouse', 'Email Gateway', 'CRM Platform', 'Document Management System',
  'Backup Storage Array', 'Branch Network Switches', 'Web Application Firewall', 'Identity Provider',
  'Call Center System', 'KYC/AML Platform', 'General Ledger System', 'Procurement Portal', 'File Server',
  'SIEM Platform', 'Endpoint Management Console', 'Wire Transfer System', 'Customer Statements Service',
  'POS Acquiring Gateway', 'Reconciliation Tool', 'Reporting Portal', 'Intranet Portal',
  'Time & Attendance System', 'Asset Management DB', 'Currency Exchange Service', 'Mobile MDM Server',
  'Privileged Access Vault', 'Loan Servicing Platform', 'Credit Scoring Engine', 'Branch CCTV System',
  'Cash Management Portal', 'Vendor Portal', 'Audit Log Archive',
];
const PROCESSES = [
  'Account Management', 'International Transfers', 'Digital Banking', 'Cash Dispensing', 'Remote Access',
  'Card Issuing', 'Identity Management', 'Employee Management', 'FX Trading', 'Lending', 'Payments',
  'Fraud Management', 'Analytics', 'Communications', 'Customer Relationship', 'Records Management',
  'Disaster Recovery', 'Network Infrastructure', 'Compliance Screening', 'Financial Reporting', 'Procurement',
];
const VULNS = [
  'Unpatched software', 'Weak authentication', 'Excessive admin privileges', 'Server misconfiguration',
  'Missing encryption', 'Open network ports', 'Outdated firmware', 'Lack of monitoring', 'No network segmentation',
  'Default credentials', 'Insecure API endpoint', 'Phishing exposure', 'Single point of failure',
  'Unrestricted USB ports', 'Legacy protocol in use', 'No MFA enforced', 'Insufficient logging', 'Shared accounts',
];
const ACTIONS = [
  'Patch and harden the system.', 'Implement MFA.', 'Conduct quarterly access review.',
  'Apply network segmentation.', 'Enable encryption at rest.', 'Deploy SIEM monitoring rules.',
  'Establish backup and DR plan.', 'Review vendor SLA and contract.', 'Run vulnerability scan and remediate.',
  'Mandatory security awareness training.', 'Decommission legacy component.', 'Implement WAF protection.',
];
const RESPONSIBLES = [
  'IT Security', 'App Dev Team', 'Network Admin', 'SysAdmin', 'InfoSec', 'Database Team', 'IT Operations',
  'Compliance', 'Facilities', 'Cloud Team', 'Legal',
];
const DATA_CLASS_POOL: DataClass[] = [
  'Public', 'Internal', 'Internal', 'Confidential', 'Confidential', 'Personal Data', 'Payment Data',
];
const STATUS_POOL: AssetStatus[] = [
  'Draft', 'Submitted', 'Submitted', 'Reviewed by InfoSec', 'Approved', 'Approved', 'Needs Update',
];
const ASSESS_POOL: Assessment[] = ['Mitigate', 'Mitigate', 'Mitigate', 'Accept', 'Accept', 'Transfer', 'Avoid'];
const STATUS_RISK_POOL: TreatmentStatus[] = ['Open', 'Open', 'In Progress', 'In Progress', 'Completed'];
const SCORE_POOL = [1, 2, 2, 3, 3, 4, 4, 5];
const CIA_POOL = [1, 2, 2, 3, 3];
const RISK_COUNT_POOL = [0, 1, 1, 2, 2, 3, 3, 4];
const yn = (p: number): YesNo => (chance(p) ? 'Yes' : 'No');

function build(): { assets: Asset[]; risks: Risk[]; treatments: Treatment[] } {
  const assets: Asset[] = [];
  const risks: Risk[] = [];
  const treatments: Treatment[] = [];
  let riskNo = 0;
  let trtNo = 0;

  for (let i = 1; i <= 100; i++) {
    const department = pick(DEPARTMENTS);
    const asset: Asset = {
      id: `AST-${pad(i)}`,
      name: pick(SYSTEMS),
      process: pick(PROCESSES),
      department,
      busOwner: `${department} Head`,
      itOwner: pick(IT_OWNERS),
      applicantName: pick(NAMES),
      c: pick(CIA_POOL) as CIA,
      i: pick(CIA_POOL) as CIA,
      a: pick(CIA_POOL) as CIA,
      dataClass: pick(DATA_CLASS_POOL),
      pci: yn(0.3),
      criticalProcess: yn(0.4),
      internet: yn(0.45),
      thirdParty: yn(0.4),
      cloud: yn(0.5),
      status: pick(STATUS_POOL),
      reviewDate: isoOffset(rint(20, 400)),
      evidence: chance(0.4) ? subset(['architecture.pdf', 'risk-assessment.xlsx', 'dpa-signed.pdf', 'pentest-report.pdf'], rint(1, 2)) : [],
      notes: chance(0.25) ? 'Reviewed during annual RCSA cycle.' : '',
      submittedAt: isoOffset(-rint(10, 500)),
    };
    assets.push(asset);

    const n = pick(RISK_COUNT_POOL);
    for (let j = 0; j < n; j++) {
      riskNo += 1;
      const impact = pick(SCORE_POOL) as Score5;
      const likelihood = pick(SCORE_POOL) as Score5;
      const resImpact = Math.max(1, impact - rint(0, 2)) as Score5;
      const resLikelihood = Math.max(1, likelihood - rint(0, 2)) as Score5;
      const custom = chance(0.08);
      const threat = custom ? pick(['Supply chain compromise', 'Insider threat', 'Zero-day exploit', 'Cloud misconfiguration']) : pick(THREAT_CATALOGUE);
      const assessment = pick(ASSESS_POOL);
      const riskId = `RSK-${pad(riskNo)}`;
      risks.push({
        id: riskId,
        assetIds: [asset.id],
        threat,
        customThreat: custom,
        vuln: pick(VULNS),
        owner: chance(0.5) ? asset.busOwner : pick(RESPONSIBLES),
        impact,
        likelihood,
        resImpact,
        resLikelihood,
        assessment,
        controls: subset(CONTROL_CATALOGUE, rint(0, 4)),
        acceptanceExpiry: assessment === 'Accept' ? isoOffset(rint(-90, 400)) : '',
        evidence: chance(0.3) ? subset(['evidence.pdf', 'scan-result.csv', 'ticket-link.txt'], 1) : [],
        comments: chance(0.25) ? [`[${isoOffset(-rint(1, 60))} 09:00] Reviewed by InfoSec.`] : [],
        submittedAt: isoOffset(-rint(5, 400)),
      });

      // Treatments addressing this risk. Accepted risks usually have none
      // (acceptance isn't a mitigation action); mitigated risks get 1–2.
      const trtCount = assessment === 'Accept' ? (chance(0.3) ? 1 : 0) : pick([1, 1, 1, 2]);
      for (let k = 0; k < trtCount; k++) {
        trtNo += 1;
        const action = pick(ACTIONS);
        // Occasionally a treatment also addresses an earlier risk (shared action).
        const riskIds = [riskId];
        if (risks.length > 1 && chance(0.1)) {
          const other = risks[rint(0, risks.length - 2)].id;
          if (other !== riskId) riskIds.push(other);
        }
        treatments.push({
          id: `TRT-${pad(trtNo)}`,
          riskIds,
          title: action,
          description: `${action} Addresses ${threat.toLowerCase()} on ${asset.name}.`,
          owner: pick(RESPONSIBLES),
          dueDate: isoOffset(rint(-300, 400)),
          status: pick(STATUS_RISK_POOL),
          evidence: chance(0.3) ? subset(['evidence.pdf', 'change-ticket.txt', 'scan-result.csv'], 1) : [],
          comments: [],
          submittedAt: isoOffset(-rint(5, 300)),
        });
      }
    }
  }
  return { assets, risks, treatments };
}

const seeded = build();
export const SEED_ASSETS: Asset[] = seeded.assets;
export const SEED_RISKS: Risk[] = seeded.risks;
export const SEED_TREATMENTS: Treatment[] = seeded.treatments;
