// Awareness Training — standalone module. Own model + storage.
// Model ported from the SentinelGRC reference (overdue derived from completion + due).

export const COURSE_TYPES = ['Course', 'Phishing simulation'] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

export const METHODS = ['E-learning', 'Workshop', 'Simulated email'] as const;
export type Method = (typeof METHODS)[number];

export interface Course {
  id: string; // TRN-##
  course: string;
  type: CourseType;
  audience: string;
  method: Method;
  due: string; // YYYY-MM-DD
  completion: number; // 0–100
}

export const typeToken: Record<CourseType, string> = { Course: 'info', 'Phishing simulation': 'purple' };

/** Overdue = not complete and past due. Also used by the header bell. */
export function overdue(c: Course): boolean {
  return c.completion < 100 && !!c.due && new Date(c.due).getTime() < Date.now();
}
