// Committee Meetings — standalone module. Own model + storage.
// Model ported from the SentinelGRC reference.

export const MEETING_STATUSES = ['Scheduled', 'Held', 'Minutes Issued'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export interface Meeting {
  id: string; // MTG-##
  title: string;
  date: string; // YYYY-MM-DD
  attendance: string;
  decisions: string;
  openActions: number;
  status: MeetingStatus;
}

export const statusToken: Record<MeetingStatus, string> = { Scheduled: 'info', Held: 'med', 'Minutes Issued': 'low' };
