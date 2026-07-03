import type { StoredUser } from './types';
import { hashPassword } from './passwordPolicy';

// Shared demo password for all seeded accounts (shown on the login page so the
// demo is easy to present). Meets the password policy.
export const DEMO_PASSWORD = 'Demo@Pass123';
const pw = hashPassword(DEMO_PASSWORD);

// Mock AD-shaped users. Per-module roles vary so RBAC has something real to gate.
// Sanitized/fake.
export const SEED_USERS: StoredUser[] = [
  {
    id: 'u-admin',
    upn: 'n.gelashvili@lb.ge',
    sAMAccountName: 'ngelashvili',
    displayName: 'Nino Gelashvili',
    title: 'CISO · Administrator',
    email: 'n.gelashvili@lb.ge',
    groups: ['InfoSec-Admins'],
    isAdmin: true,
    active: true,
    defaultRole: 'admin', // full access everywhere
    overrides: {},
    passwordHash: pw,
  },
  {
    id: 'u-grc',
    upn: 't.kvirikashvili@lb.ge',
    sAMAccountName: 'tkvirikashvili',
    displayName: 'Tamar Kvirikashvili',
    title: 'Security Architect · GRC Editor',
    email: 't.kvirikashvili@lb.ge',
    groups: ['GRC-Editors', 'Risk-Contributors'],
    isAdmin: false,
    active: true,
    defaultRole: 'editor', // edits most things…
    overrides: { committee: 'viewer', kpis: 'viewer', awareness: 'viewer' }, // …read-only on these
    passwordHash: pw,
  },
  {
    id: 'u-iam',
    upn: 'g.beridze@lb.ge',
    sAMAccountName: 'gberidze',
    displayName: 'Giorgi Beridze',
    title: 'Identity & Access Lead',
    email: 'g.beridze@lb.ge',
    groups: ['AccessReview-Owners', 'Vendor-Managers'],
    isAdmin: false,
    active: true,
    defaultRole: null, // no access unless explicitly granted
    overrides: {
      'access-reviews': 'editor',
      vendors: 'editor',
      'rcsa-dashboard': 'viewer',
      'risk-catalogue': 'viewer',
      'asset-catalogue': 'viewer',
      compliance: 'viewer',
    },
    passwordHash: pw,
  },
  {
    id: 'u-audit',
    upn: 's.tsiklauri@lb.ge',
    sAMAccountName: 'stsiklauri',
    displayName: 'Salome Tsiklauri',
    title: 'Internal Auditor',
    email: 's.tsiklauri@lb.ge',
    groups: ['Audit-ReadOnly'],
    isAdmin: false,
    active: true,
    defaultRole: 'viewer', // read-only everywhere
    overrides: {},
    passwordHash: pw,
  },
];
