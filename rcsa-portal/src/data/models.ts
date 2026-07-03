export type CIA = 1 | 2 | 3;
export type Score5 = 1 | 2 | 3 | 4 | 5;
export type YesNo = 'Yes' | 'No';

export type DataClass =
  | 'Public'
  | 'Internal'
  | 'Confidential'
  | 'Personal Data'
  | 'Payment Data';

export type AssetStatus =
  | 'Draft'
  | 'Submitted'
  | 'Reviewed by InfoSec'
  | 'Approved'
  | 'Needs Update';

export type Assessment = 'Mitigate' | 'Accept' | 'Transfer' | 'Avoid';
export type TreatmentStatus = 'Open' | 'In Progress' | 'Completed';

export interface Asset {
  id: string;
  name: string;
  process: string;
  department: string;
  busOwner: string;
  itOwner: string;
  applicantName: string;
  c: CIA;
  i: CIA;
  a: CIA;
  dataClass: DataClass;
  pci: YesNo;
  criticalProcess: YesNo;
  internet: YesNo;
  thirdParty: YesNo;
  cloud: YesNo;
  status: AssetStatus;
  reviewDate: string;
  evidence: string[];
  notes: string;
  submittedAt: string;
}

export interface Risk {
  id: string;
  /** Assets this risk applies to (one risk can span several assets). */
  assetIds: string[];
  threat: string;
  customThreat: boolean;
  vuln: string;
  owner: string;
  impact: Score5;
  likelihood: Score5;
  /** Residual scoring is OPTIONAL — both set = assessed; both absent = not assessed. */
  resImpact?: Score5;
  resLikelihood?: Score5;
  /** The risk decision. Concrete mitigation actions live in Treatment entities. */
  assessment: Assessment;
  controls: string[];
  /** Set when assessment is 'Accept' — the residual-risk acceptance expiry. */
  acceptanceExpiry: string;
  evidence: string[];
  comments: string[];
  submittedAt: string;
}

/**
 * A concrete action/project that treats one or more risks. Split out of Risk so
 * the same treatment (e.g. "Deploy EDR") can address several risks and carry its
 * own lifecycle. Chain: Asset → Risk → Treatment.
 */
export interface Treatment {
  id: string;
  /** The risk(s) this treatment addresses. */
  riskIds: string[];
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  status: TreatmentStatus;
  evidence: string[];
  comments: string[];
  submittedAt: string;
}
