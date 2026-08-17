import type { ClassSession, SelectedCourse } from '@/lib/types';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

export function dayIndex(day: string): number {
  return DAYS.indexOf(day.slice(0, 3) as Day);
}

/** `"09:30"` → `570`. Returns `NaN` for anything unparseable. */
export function toMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatSession(session: ClassSession): string {
  const when = `${session.dayOfWeek} ${session.startTime}-${session.endTime}`;
  return session.venue ? `${when} @ ${session.venue}` : when;
}

/** The distinct teaching staff of a group, in first-seen order. */
export function staffOf(sessions: ClassSession[]): string[] {
  const seen = new Set<string>();
  for (const s of sessions) {
    for (const name of s.teachingStaff.split(/\s*[;,]\s*(?=[A-Z]{2})/)) {
      const trimmed = name.trim();
      if (trimmed) seen.add(trimmed);
    }
  }
  return [...seen];
}

function overlaps(a: ClassSession, b: ClassSession): boolean {
  if (dayIndex(a.dayOfWeek) !== dayIndex(b.dayOfWeek)) return false;
  if (dayIndex(a.dayOfWeek) < 0) return false;

  // Week ranges have to intersect too — a Wk 1-6 lecture and a Wk 7-13 lab in
  // the same slot are not a clash.
  const weekStart = Math.max(a.startWeek, b.startWeek);
  const weekEnd = Math.min(a.endWeek, b.endWeek);
  if (a.startWeek && b.startWeek && weekStart > weekEnd) return false;

  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns course id → ids of the courses it clashes with. Only courses that
 * actually clash appear as keys.
 */
export function findConflicts(
  courses: SelectedCourse[],
): Map<string, Set<string>> {
  const conflicts = new Map<string, Set<string>>();
  const record = (a: string, b: string) => {
    if (!conflicts.has(a)) conflicts.set(a, new Set());
    conflicts.get(a)!.add(b);
  };

  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i]!;
      const b = courses[j]!;
      const clash = a.sessions.some((sa) =>
        b.sessions.some((sb) => overlaps(sa, sb)),
      );
      if (clash) {
        record(a.id, b.id);
        record(b.id, a.id);
      }
    }
  }
  return conflicts;
}

export function totalCredits(courses: SelectedCourse[]): number {
  return courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
}

/** A session laid out on the weekly grid. */
export interface GridEntry {
  course: SelectedCourse;
  session: ClassSession;
  day: number;
  startMin: number;
  endMin: number;
}

export function buildGrid(courses: SelectedCourse[]): GridEntry[] {
  const entries: GridEntry[] = [];
  for (const course of courses) {
    for (const session of course.sessions) {
      const day = dayIndex(session.dayOfWeek);
      const startMin = toMinutes(session.startTime);
      const endMin = toMinutes(session.endTime);
      if (day < 0 || Number.isNaN(startMin) || Number.isNaN(endMin)) continue;
      entries.push({ course, session, day, startMin, endMin });
    }
  }
  return entries;
}
