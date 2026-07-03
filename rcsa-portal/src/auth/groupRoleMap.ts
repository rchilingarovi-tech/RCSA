// Directory group → platform access mapping (Phase 3, AD readiness).
// This is the single place IT configures after migration: each Active Directory
// security group maps to a platform role/scope. The demo resolves access from the
// seeded users directly; in production the server reads a user's `memberOf` groups
// and applies this map to build their Session. Shown read-only in the Directory.

export interface GroupMapping {
  group: string; // AD group CN
  access: string; // human-readable resulting access (the documented intent)
}

export const GROUP_ROLE_MAP: GroupMapping[] = [
  { group: 'InfoSec-Admins', access: 'Administrator — full access to every module + access administration' },
  { group: 'GRC-Editors', access: 'Editor — Compliance, Policy & Document Control, Vendors, KPIs, Yearly Plan' },
  { group: 'Risk-Contributors', access: 'Editor — RCSA (Assets, Risks, Treatments)' },
  { group: 'AccessReview-Owners', access: 'Editor — Access Reviews' },
  { group: 'Vendor-Managers', access: 'Editor — Third-Party Vendors' },
  { group: 'Audit-ReadOnly', access: 'Viewer — all modules + Audit Log (read-only)' },
];
