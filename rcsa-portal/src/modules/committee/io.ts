import { parseEnum, parseNumIn, type IoSpec } from '../../lib/tableIo';
import { MEETING_STATUSES, type Meeting } from './types';

export const meetingIo: IoSpec<Meeting> = {
  entity: 'Meeting',
  filePrefix: 'committee-meetings',
  idPrefix: 'MTG',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Meeting ID'], value: (m) => m.id },
    { header: 'Title', required: true, value: (m) => m.title, apply: (raw, d) => { d.title = raw; } },
    { header: 'Date', value: (m) => m.date, apply: (raw, d) => { d.date = raw; } },
    { header: 'Status', value: (m) => m.status, apply: (raw, d, bad) => { const e = parseEnum(raw, MEETING_STATUSES); if (!e) bad(`"${raw}" must be: ${MEETING_STATUSES.join(', ')}`); else d.status = e; } },
    { header: 'Open actions', value: (m) => m.openActions, apply: (raw, d, bad) => { const n = parseNumIn(raw, 0, 10000); if (n === null) bad(`"${raw}" must be a number ≥ 0`); else d.openActions = n; } },
    { header: 'Attendance', value: (m) => m.attendance, apply: (raw, d) => { d.attendance = raw; } },
    { header: 'Decisions', value: (m) => m.decisions, apply: (raw, d) => { d.decisions = raw; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    title: d.title ?? prev?.title ?? '',
    date: d.date ?? prev?.date ?? '',
    status: d.status ?? prev?.status ?? 'Scheduled',
    openActions: d.openActions ?? prev?.openActions ?? 0,
    attendance: d.attendance ?? prev?.attendance ?? '',
    decisions: d.decisions ?? prev?.decisions ?? '',
  }),
};
