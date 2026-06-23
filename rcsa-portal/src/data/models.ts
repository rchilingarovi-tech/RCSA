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
  assetId: string;
  threat: string;
  customThreat: boolean;
  vuln: string;
  owner: string;
  impact: Score5;
  likelihood: Score5;
  resImpact: Score5;
  resLikelihood: Score5;
  assessment: Assessment;
  controls: string[];
  actionPlan: string;
  responsible: string;
  deadline: string;
  treatmentStatus: TreatmentStatus;
  acceptanceExpiry: string;
  evidence: string[];
  comments: string[];
  submittedAt: string;
}
