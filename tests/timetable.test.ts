import { describe, expect, it } from 'vitest';
import {
  dayIndex,
  findConflicts,
  formatSession,
  staffOf,
  toMinutes,
  totalCredits,
} from '@/lib/polyu/timetable';
import type { ClassSession, SelectedCourse } from '@/lib/types';

function session(partial: Partial<ClassSession> = {}): ClassSession {
  return {
    componentCode: 'LEC001',
    everyWeeks: 1,
    startWeek: 1,
    endWeek: 13,
    dayOfWeek: 'Mon',
    startTime: '09:30',
    endTime: '10:20',
    venue: 'TU101',
    teachingStaff: 'TAYYAB, Muhammad',
    remark: '',
    ...partial,
  };
}

function course(
  id: string,
  sessions: ClassSession[],
  credits = '3.0',
): SelectedCourse {
  return {
    id,
    subjectCode: id,
    subjectTitle: id,
    groupCode: '1011',
    credits,
    offeringDepartment: '',
    sessions,
    source: 'local',
    addedAt: 0,
  };
}

describe('time helpers', () => {
  it('parses HH:mm into minutes', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('18:20')).toBe(1100);
    expect(toMinutes('')).toBeNaN();
    expect(toMinutes('n/a')).toBeNaN();
  });

  it('maps PolyU day abbreviations to an index', () => {
    expect(dayIndex('Mon')).toBe(0);
    expect(dayIndex('Fri')).toBe(4);
    expect(dayIndex('Sunday')).toBe(6);
    expect(dayIndex('TBC')).toBe(-1);
  });

  it('formats a session for the course card', () => {
    expect(formatSession(session())).toBe('Mon 09:30-10:20 @ TU101');
    expect(formatSession(session({ venue: '' }))).toBe('Mon 09:30-10:20');
  });
});

describe('staffOf', () => {
  it('keeps "SURNAME, Given" intact while splitting multiple lecturers', () => {
    expect(staffOf([session({ teachingStaff: 'LYU, Mingsong, XIA, Xianjin' })]))
      .toEqual(['LYU, Mingsong', 'XIA, Xianjin']);
  });

  it('does not split a single name on its own comma', () => {
    expect(staffOf([session({ teachingStaff: 'LAM, Alexander A' })])).toEqual([
      'LAM, Alexander A',
    ]);
  });

  it('de-duplicates across sessions and skips blanks', () => {
    expect(
      staffOf([
        session({ teachingStaff: 'TAYYAB, Muhammad' }),
        session({ componentCode: 'LAB001', teachingStaff: 'TAYYAB, Muhammad' }),
        session({ componentCode: 'LAB002', teachingStaff: '' }),
      ]),
    ).toEqual(['TAYYAB, Muhammad']);
  });
});

describe('findConflicts', () => {
  it('flags two courses overlapping on the same day', () => {
    const conflicts = findConflicts([
      course('A', [session({ startTime: '09:30', endTime: '11:20' })]),
      course('B', [session({ startTime: '10:30', endTime: '12:20' })]),
    ]);
    expect(conflicts.get('A')).toEqual(new Set(['B']));
    expect(conflicts.get('B')).toEqual(new Set(['A']));
  });

  it('treats back-to-back classes as compatible', () => {
    const conflicts = findConflicts([
      course('A', [session({ startTime: '09:30', endTime: '10:20' })]),
      course('B', [session({ startTime: '10:20', endTime: '11:20' })]),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it('ignores an overlap on different days', () => {
    const conflicts = findConflicts([
      course('A', [session({ dayOfWeek: 'Mon' })]),
      course('B', [session({ dayOfWeek: 'Tue' })]),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it('ignores an overlap in non-overlapping teaching weeks', () => {
    const conflicts = findConflicts([
      course('A', [session({ startWeek: 1, endWeek: 6 })]),
      course('B', [session({ startWeek: 7, endWeek: 13 })]),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it('catches a clash in only one of several sessions', () => {
    const conflicts = findConflicts([
      course('A', [
        session({ dayOfWeek: 'Mon' }),
        session({ dayOfWeek: 'Wed', componentCode: 'LAB001' }),
      ]),
      course('B', [session({ dayOfWeek: 'Wed' })]),
    ]);
    expect(conflicts.get('A')).toEqual(new Set(['B']));
  });

  it('skips sessions with no usable time', () => {
    const conflicts = findConflicts([
      course('A', [session({ dayOfWeek: 'TBC', startTime: '', endTime: '' })]),
      course('B', [session({ dayOfWeek: 'TBC', startTime: '', endTime: '' })]),
    ]);
    expect(conflicts.size).toBe(0);
  });
});

describe('totalCredits', () => {
  it('sums numeric credits and ignores unparseable ones', () => {
    expect(
      totalCredits([
        course('A', [], '3.0'),
        course('B', [], '1.5'),
        course('C', [], ''),
      ]),
    ).toBe(4.5);
  });
});
