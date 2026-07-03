// Committee Meetings — standalone module. Own model + storage.

export const MEETING_STATUSES = ['Scheduled', 'Completed', 'Cancelled'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export interface Meeting {
  id: string; // MTG-###
  title: string;
  date: string; // YYYY-MM-DD
  attendees: number;
  openActions: number;
  status: MeetingStatus;
  notes: string; // minutes / decisions summary
}

export function statusColor(s: MeetingStatus): string {
  return s === 'Completed' ? 'low' : s === 'Scheduled' ? 'info' : 'mut';
}
