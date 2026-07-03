// Awareness Training — standalone module. Own model + storage.

export const DELIVERIES = ['E-learning', 'Workshop', 'Classroom', 'Phishing Simulation'] as const;
export type Delivery = (typeof DELIVERIES)[number];

export const TRAINING_STATUSES = ['Assigned', 'In Progress', 'Completed', 'Overdue'] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export interface Course {
  id: string; // TRN-###
  name: string;
  audience: string;
  delivery: Delivery;
  due: string; // YYYY-MM-DD
  completion: number; // 0–100
  status: TrainingStatus;
}

export function statusColor(s: TrainingStatus): string {
  return s === 'Completed' ? 'low' : s === 'In Progress' ? 'info' : s === 'Overdue' ? 'crit' : 'med';
}

export function deliveryColor(d: Delivery): string {
  return d === 'Phishing Simulation' ? 'high' : d === 'E-learning' ? 'info' : 'mut';
}
