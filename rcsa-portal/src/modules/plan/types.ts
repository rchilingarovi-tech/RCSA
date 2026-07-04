// Yearly Plan — standalone module. Own model + storage.
// Model ported from the SentinelGRC reference.

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type Quarter = (typeof QUARTERS)[number];

export const CATEGORIES = ['Identity & Access', 'Security Operations', 'Compliance', 'Third-Party Risk', 'Infrastructure', 'Resilience', 'People'] as const;
export type PlanCategory = (typeof CATEGORIES)[number];

export interface Initiative {
  id: string; // INI-##
  initiative: string;
  category: PlanCategory;
  quarter: Quarter;
  owner: string;
  priority: Priority;
  progress: number; // 0–100
}

export const priorityToken: Record<Priority, string> = { High: 'crit', Medium: 'med', Low: 'mut' };
