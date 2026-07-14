import { parseEnum, parseNumIn, type IoSpec } from '../../lib/tableIo';
import { COURSE_TYPES, METHODS, type Course } from './types';

export const courseIo: IoSpec<Course> = {
  entity: 'Course',
  filePrefix: 'awareness',
  idPrefix: 'TRN',
  pad: 2,
  cols: [
    { header: 'ID', aliases: ['Course ID'], value: (c) => c.id },
    { header: 'Course', aliases: ['Title', 'Name'], required: true, value: (c) => c.course, apply: (raw, d) => { d.course = raw; } },
    { header: 'Type', value: (c) => c.type, apply: (raw, d, bad) => { const e = parseEnum(raw, COURSE_TYPES); if (!e) bad(`"${raw}" must be: ${COURSE_TYPES.join(', ')}`); else d.type = e; } },
    { header: 'Audience', value: (c) => c.audience, apply: (raw, d) => { d.audience = raw; } },
    { header: 'Method', value: (c) => c.method, apply: (raw, d, bad) => { const e = parseEnum(raw, METHODS); if (!e) bad(`"${raw}" must be: ${METHODS.join(', ')}`); else d.method = e; } },
    { header: 'Due', aliases: ['Due Date'], value: (c) => c.due, apply: (raw, d) => { d.due = raw; } },
    { header: 'Completion %', aliases: ['Completion'], value: (c) => c.completion, apply: (raw, d, bad) => { const n = parseNumIn(raw, 0, 100); if (n === null) bad(`"${raw}" must be 0–100`); else d.completion = n; } },
  ],
  build: (d, prev) => ({
    id: d.id,
    course: d.course ?? prev?.course ?? '',
    type: d.type ?? prev?.type ?? 'Course',
    audience: d.audience ?? prev?.audience ?? '',
    method: d.method ?? prev?.method ?? 'E-learning',
    due: d.due ?? prev?.due ?? '',
    completion: d.completion ?? prev?.completion ?? 0,
  }),
};
