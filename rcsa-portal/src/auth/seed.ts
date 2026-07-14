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
    upn: 'r.chilingarovi@lb.ge',
    sAMAccountName: 'rchilingarovi',
    displayName: 'Roberti Chilingarovi',
    title: 'CISO · Administrator',
    email: 'r.chilingarovi@lb.ge',
    groups: ['InfoSec-Admins'],
    isAdmin: true,
    active: true,
    defaultRole: 'admin', // full access everywhere
    overrides: {},
    passwordHash: pw,
  },
  {
    id: 'u-grc',
    upn: 'n.maglakelidze@lb.ge',
    sAMAccountName: 'nmaglakelidze',
    displayName: 'Nata Maglakelidze',
    title: 'Security Architect · GRC Editor',
    email: 'n.maglakelidze@lb.ge',
    groups: ['GRC-Editors', 'Risk-Contributors'],
    isAdmin: false,
    active: true,
    defaultRole: 'editor', // edits most things…
    overrides: { committee: 'viewer', kpis: 'viewer', awareness: 'viewer' }, // …read-only on these
    passwordHash: pw,
  },
  {
    id: 'u-iam',
    upn: 't.natroshvili@lb.ge',
    sAMAccountName: 'tnatroshvili',
    displayName: 'Tamar Natroshvili',
    title: 'Identity & Access Lead',
    email: 't.natroshvili@lb.ge',
    groups: ['AccessReview-Owners', 'Vendor-Managers'],
    isAdmin: false,
    active: true,
    defaultRole: null, // no access unless explicitly granted
    overrides: {
      overview: 'viewer', // executive dashboard is visible to everyone with a login
      'master-calendar': 'viewer', // the shared calendar is visible to everyone with a login
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
    upn: 'n.lomadze@lb.ge',
    sAMAccountName: 'nlomadze',
    displayName: 'Nika Lomadze',
    title: 'Internal Auditor',
    email: 'n.lomadze@lb.ge',
    groups: ['Audit-ReadOnly'],
    isAdmin: false,
    active: true,
    defaultRole: 'viewer', // read-only everywhere
    overrides: {},
    passwordHash: pw,
  },
];
