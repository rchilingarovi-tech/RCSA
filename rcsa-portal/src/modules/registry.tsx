import type { ComponentType } from 'react';
import { OverviewPage } from './overview/OverviewPage';
import { MasterCalendarPage } from './calendar/MasterCalendarPage';
import { RcsaDashboard } from './rcsa/RcsaDashboard';
import { AssetCataloguePage } from './rcsa/AssetCataloguePage';
import { RiskCataloguePage } from './rcsa/RiskCataloguePage';
import { TreatmentCataloguePage } from './rcsa/TreatmentCataloguePage';
import { CompliancePage } from './compliance/CompliancePage';
import { FindingsPage } from './findings/FindingsPage';
import { KpisPage } from './kpis/KpisPage';
import { VendorsPage } from './vendors/VendorsPage';
import { PoliciesPage } from './policies/PoliciesPage';
import { AccessPage } from './access/AccessPage';
import { CommitteePage } from './committee/CommitteePage';
import { PlanPage } from './plan/PlanPage';
import { AwarenessPage } from './awareness/AwarenessPage';
import { SettingsPage } from './settings/SettingsPage';
import { AuditPage } from './audit/AuditPage';
import { DirectoryPage } from './directory/DirectoryPage';
import { IncidentsPage } from './incidents/IncidentsPage';
import { VulnsPage } from './vulns/VulnsPage';

// Single source of truth for the left-hand menu. Each module is either `active`
// (renders its own Component) or `planned` (renders the ComingSoon placeholder).
// Adding a module later = one entry here + its Component.

export type ModuleStatus = 'active' | 'planned';

// Placeholder for the future mock-auth / RBAC layer. NOT enforced yet — real
// authorization is server-side. Listed here so the menu can be role-filtered
// without restructuring once auth lands.
export type Role = 'admin' | 'editor' | 'viewer';

export interface ModuleDef {
  id: string;
  label: string;
  icon: string; // Icon name (see components/common/Icon)
  group?: ModuleGroup; // omitted for footer-pinned items (e.g. Settings)
  footer?: boolean; // pinned to the bottom of the sidebar, separated
  status: ModuleStatus;
  description: string;
  roles?: Role[];
  Component?: ComponentType;
}

export const MODULE_GROUPS = ['Overview', 'RCSA', 'Risk & Compliance', 'Security Operations', 'Governance', 'Planning & Performance', 'Administration'] as const;
export type ModuleGroup = (typeof MODULE_GROUPS)[number];

export const MODULES: ModuleDef[] = [
  {
    id: 'overview',
    label: 'Dashboard',
    icon: 'grid',
    group: 'Overview',
    status: 'active',
    description: 'Executive overview of security risk, compliance and performance.',
    Component: OverviewPage,
  },
  {
    id: 'master-calendar',
    label: 'Master Calendar',
    icon: 'calendar',
    group: 'Overview',
    status: 'active',
    description: 'Centralized schedule tracking all compliance deadlines, risk treatments, renewals, and overdues.',
    Component: MasterCalendarPage,
  },
  {
    id: 'rcsa-dashboard',
    label: 'RCSA Dashboard',
    icon: 'shield',
    group: 'RCSA',
    status: 'active',
    description: 'Risk & control overview with cross-filtering charts.',
    Component: RcsaDashboard,
  },
  {
    id: 'asset-catalogue',
    label: 'Asset Catalogue',
    icon: 'box',
    group: 'RCSA',
    status: 'active',
    description: 'Asset inventory with full CRUD and per-asset summary.',
    Component: AssetCataloguePage,
  },
  {
    id: 'risk-catalogue',
    label: 'Risk Catalogue',
    icon: 'alert',
    group: 'RCSA',
    status: 'active',
    description: 'All risks with scoring, decisions and treatment status.',
    Component: RiskCataloguePage,
  },
  {
    id: 'treatment-catalogue',
    label: 'Treatment Catalogue',
    icon: 'tool',
    group: 'RCSA',
    status: 'active',
    description: 'Treatment plans that address one or more risks across assets.',
    Component: TreatmentCataloguePage,
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: 'check',
    group: 'Risk & Compliance',
    status: 'active',
    description: 'Multi-framework control assessment with coverage and gap analysis.',
    Component: CompliancePage,
  },
  {
    id: 'findings',
    label: 'Audit Findings',
    icon: 'edit',
    group: 'Risk & Compliance',
    status: 'active',
    description: 'Regulator / audit findings register with remediation owners and deadlines.',
    Component: FindingsPage,
  },
  {
    id: 'vendors',
    label: 'Third-Party Vendors',
    icon: 'building',
    group: 'Risk & Compliance',
    status: 'active',
    description: 'Vendor risk registry with assessments, renewals and detail review.',
    Component: VendorsPage,
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: 'bolt',
    group: 'Security Operations',
    status: 'active',
    description: 'Information-security / cyber incident tracking — dashboard and register.',
    Component: IncidentsPage,
  },
  {
    id: 'vulns',
    label: 'Vulnerabilities',
    icon: 'alert',
    group: 'Security Operations',
    status: 'active',
    description: 'Scan / pentest findings with severity-based remediation SLAs and breach flags.',
    Component: VulnsPage,
  },
  {
    id: 'policies',
    label: 'Policy & Document Control',
    icon: 'doc',
    group: 'Governance',
    status: 'active',
    description: 'Document library with version, status, owner and review cadence.',
    Component: PoliciesPage,
  },
  {
    id: 'committee',
    label: 'Committee Meetings',
    icon: 'users',
    group: 'Governance',
    status: 'active',
    description: 'Log of committee meetings, attendance, decisions and open actions.',
    Component: CommitteePage,
  },
  {
    id: 'access-reviews',
    label: 'Access Reviews',
    icon: 'key',
    group: 'Governance',
    status: 'active',
    description: 'Periodic entitlement / access review campaigns with progress tracking.',
    Component: AccessPage,
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    icon: 'clock',
    group: 'Administration',
    status: 'active',
    description: 'Chronological record of who changed what across the platform.',
    Component: AuditPage,
  },
  {
    id: 'directory',
    label: 'Directory',
    icon: 'shield',
    group: 'Administration',
    status: 'active',
    description: 'Active Directory–shaped identities, group→role mapping and the AD integration model.',
    Component: DirectoryPage,
  },
  {
    id: 'kpis',
    label: 'Department KPIs',
    icon: 'chart',
    group: 'Planning & Performance',
    status: 'active',
    description: 'Track each KPI with RAG status and a trend over time.',
    Component: KpisPage,
  },
  {
    id: 'yearly-plan',
    label: 'Yearly Plan',
    icon: 'calendar',
    group: 'Planning & Performance',
    status: 'active',
    description: 'Annual InfoSec roadmap of initiatives with priority and progress.',
    Component: PlanPage,
  },
  {
    id: 'awareness',
    label: 'Awareness Training',
    icon: 'grad',
    group: 'Planning & Performance',
    status: 'active',
    description: 'Security-awareness courses and phishing campaigns with completion tracking.',
    Component: AwarenessPage,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'gear',
    footer: true,
    status: 'active',
    description: 'Profile and per-module access-rights administration.',
    Component: SettingsPage,
  },
];

export const DEFAULT_MODULE_ID = 'overview';

/** Gateable module ids — used by the auth layer to resolve per-module access.
 * Footer-pinned items (e.g. Settings) are always reachable and gated internally,
 * so they are NOT part of the per-module access map. */
export const MODULE_IDS = MODULES.filter((m) => !m.footer).map((m) => m.id);

export function getModule(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}
