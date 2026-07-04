import type { Course } from './types';

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const SEED_COURSES: Course[] = [
  { id: 'TRN-01', course: 'Annual security awareness 2026', type: 'Course', audience: 'All staff (5,500)', method: 'E-learning', due: iso(60), completion: 93 },
  { id: 'TRN-02', course: 'Phishing simulation — wave 6', type: 'Phishing simulation', audience: 'All staff', method: 'Simulated email', due: iso(-7), completion: 100 },
  { id: 'TRN-03', course: 'Secure coding for developers', type: 'Course', audience: 'Development teams (120)', method: 'Workshop', due: iso(40), completion: 58 },
  { id: 'TRN-04', course: 'Privileged user responsibilities', type: 'Course', audience: 'P4/P5 personas (300)', method: 'E-learning', due: iso(21), completion: 74 },
  { id: 'TRN-05', course: 'Branch fraud red flags', type: 'Course', audience: 'Branch staff (3,500)', method: 'E-learning', due: iso(90), completion: 31 },
  { id: 'TRN-06', course: 'Phishing simulation — executives', type: 'Phishing simulation', audience: 'ExCo + PAs', method: 'Simulated email', due: iso(14), completion: 60 },
];
