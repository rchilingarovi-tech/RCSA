// Yearly Plan — standalone module. Own model + storage.

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PLAN_STATUSES = ['Planned', 'In Progress', 'Completed', 'Cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export interface Initiative {
  id: string; // INI-###
  name: string;
  category: string;
  quarter: string; // e.g. "Q1–Q3"
  owner: string;
  priority: Priority;
  status: PlanStatus;
  progress: number; // 0–100
}

export function priorityColor(p: Priority): string {
  return p === 'Critical' ? 'crit' : p === 'High' ? 'high' : p === 'Medium' ? 'med' : 'low';
}

export function statusColor(s: PlanStatus): string {
  return s === 'Completed' ? 'low' : s === 'In Progress' ? 'info' : s === 'Planned' ? 'med' : 'mut';
}
