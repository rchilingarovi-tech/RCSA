import type { AccessReview } from './types';

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const SEED_ACCESS: AccessReview[] = [
  { id: 'ACR-01', campaign: 'Q2 privileged access review', scope: 'All P4/P5 personas + domain admins', period: '2026-Q2', reviewer: 'Internal Audit', due: iso(10), progress: 78 },
  { id: 'ACR-02', campaign: 'Core Banking entitlements', scope: 'CBS application roles', period: '2026-Q2', reviewer: 'Business Owners', due: iso(-4), progress: 55 },
  { id: 'ACR-03', campaign: 'Exception group expiry check', scope: 'All exception security groups', period: '2026-06', reviewer: 'Identity Team', due: iso(-1), progress: 92 },
  { id: 'ACR-04', campaign: 'Vendor remote access', scope: 'Third-party VPN accounts', period: '2026-H1', reviewer: 'SecOps', due: iso(30), progress: 20 },
];
