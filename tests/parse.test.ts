import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findSearchTable,
  headerIndex,
  parseExportTimetable,
  parseGroupDetails,
  parseSearchRow,
} from '@/lib/polyu/parse';

/**
 * Every fixture is a verbatim slice of a live PolyU response — captured from
 * `subject-search.jsf`, `subject-search-export-timetable.jsf` and
 * `subject-search-details.jsf` — so these tests pin the parsers to the markup
 * RichFaces actually emits: generated `j_id*` attributes, inline
 * `<script>`/`<style>` blocks and all.
 */
function fixture(name: string): string {
  // `import.meta.url` is not reliable here: happy-dom installs its own `URL`,
  // which drops the leading path segments when resolving a relative file URL.
  return readFileSync(join(process.cwd(), 'tests/fixtures', name), 'utf8');
}

function parseDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('parseExportTimetable', () => {
  const timetable = parseExportTimetable(fixture('export-timetable.html'));

  it('indexes every subject in the export', () => {
    expect([...timetable.keys()]).toEqual([
      'COMP1010',
      'COMP1012',
      'COMP1Q01',
    ]);
  });

  it('groups sessions under their subject group code, numerically ordered', () => {
    const groups = timetable.get('COMP1010')!;
    expect(groups.map((g) => g.groupCode)).toEqual([
      '125',
      '173',
      '175',
      '194',
      '1011',
      '1012',
      '1015',
    ]);
    expect(groups.every((g) => g.sessions.length > 0)).toBe(true);
  });

  it('fans a shared class out to every group listed in the row', () => {
    const groups = timetable.get('COMP1010')!;
    // The export lists one row as `1015, 125, 175` — one class, three groups.
    for (const code of ['1015', '125', '175']) {
      const group = groups.find((g) => g.groupCode === code)!;
      expect(group.sessions.map((s) => s.componentCode)).toEqual([
        'LAB001',
        'LAB002',
        'LAB003',
        'LAB004',
        'LEC001',
      ]);
      expect(group.sessions[4]).toMatchObject({
        dayOfWeek: 'Tue',
        startTime: '12:30',
        endTime: '14:20',
        venue: 'TU101',
        teachingStaff: 'LAM, Alexander A',
      });
    }
    // …and no group is invented for the combined string itself.
    expect(groups.some((g) => g.groupCode.includes(','))).toBe(false);
  });

  it('reads each timetable column into the session', () => {
    const group = timetable
      .get('COMP1010')!
      .find((g) => g.groupCode === '1011')!;
    const first = group.sessions[0]!;
    expect(first).toMatchObject({
      componentCode: 'LAB001',
      everyWeeks: 1,
      startWeek: 1,
      endWeek: 13,
      dayOfWeek: 'Fri',
      startTime: '09:30',
      endTime: '10:20',
      venue: 'PQ604A',
      teachingStaff: 'TAYYAB, Muhammad',
      remark: '',
    });
  });

  it('returns an empty index for markup with no timetable table', () => {
    expect(parseExportTimetable('<html><body>No results</body></html>').size).toBe(
      0,
    );
  });
});

describe('subject search results', () => {
  const doc = parseDoc(fixture('search-results.html'));
  const table = findSearchTable(doc)!;
  const cols = headerIndex(table);

  it('finds the result table and maps its headers', () => {
    expect(table).not.toBeNull();
    expect(cols.get('Subject Code')).toBe(0);
    expect(cols.get('Credit(s)')).toBe(5);
  });

  it('reads a row without picking up the inlined JSF script block', () => {
    const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
    const subject = parseSearchRow(rows[0]!, cols)!;
    expect(subject.subjectCode).toBe('COMP1010');
    expect(subject.subjectTitle).toBe(
      'COMPUTATIONAL THINKING AND PROBLEM SOLVING',
    );
    expect(subject.offeringDepartment).toBe('DEPARTMENT OF COMPUTING');
    expect(subject.level).toBe('1');
    expect(subject.credits).toBe('3.0');
  });

  it('reads categories as a list, ignoring the inlined <style> block', () => {
    const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
    const subject = parseSearchRow(rows[2]!, cols)!;
    expect(subject.subjectCode).toBe('COMP1Q01');
    expect(subject.categories).toEqual(['GE Essential Components']);
  });

  it('leaves categories empty when the cell is blank', () => {
    const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
    const subject = parseSearchRow(rows[0]!, cols)!;
    expect(subject.categories).toEqual([]);
  });
});

describe('parseGroupDetails', () => {
  const details = parseGroupDetails(fixture('subject-details.html'));

  it('indexes every group in the Subject Group Details table', () => {
    expect([...details.keys()]).toEqual([
      '1011',
      '1012',
      '173',
      '125',
      '175',
      '194',
      '1015',
    ]);
  });

  it('reads the columns the timetable export does not carry', () => {
    expect(details.get('1011')).toMatchObject({
      groupType: 'PS',
      groupSize: '129',
      vacancies: '(25)',
      seats: 25,
      waiting: null,
      topUp: null,
      waitlistAvailable: 'Yes',
    });
  });

  it('keeps each eligible programme separate', () => {
    // The codes sit in adjacent spans; read as one string they would come back
    // as the unusable `62401-62401-DSA62401-FFT`.
    expect(details.get('173')!.eligibleProgrammes).toEqual([
      '62401-',
      '62401-DSA',
      '62401-FFT',
    ]);
    expect(details.get('1011')!.eligibleProgrammes).toEqual(['61435-']);
  });

  it('reports a group with no seats left', () => {
    expect(details.get('125')).toMatchObject({ vacancies: '(0)', seats: 0 });
  });

  it('splits the waitlist form of the vacancies cell', () => {
    // Same cell, the shape the page's own footnote documents for a queue.
    const waitlisted = parseGroupDetails(
      fixture('subject-details.html').replace('(25)', '(W=40)/(Top-up vac=3)'),
    ).get('1011')!;
    expect(waitlisted).toMatchObject({ seats: 0, waiting: 40, topUp: 3 });
  });

  it('returns an empty index for markup with no group table', () => {
    expect(parseGroupDetails('<html><body>Nothing</body></html>').size).toBe(0);
  });
});

describe('group details join the timetable export', () => {
  it('every timetable group for COMP1010 has a details row', () => {
    const groups = parseExportTimetable(fixture('export-timetable.html')).get(
      'COMP1010',
    )!;
    const details = parseGroupDetails(fixture('subject-details.html'));
    // Both fixtures come from the same subject, so the codes must line up —
    // including the three that the export lists as one `1015, 125, 175` row.
    expect(groups.map((g) => details.has(g.groupCode))).toEqual(
      groups.map(() => true),
    );
  });
});

describe('search results join the timetable export', () => {
  it('every parsed subject code resolves against the export index', () => {
    const timetable = parseExportTimetable(fixture('export-timetable.html'));
    const doc = parseDoc(fixture('search-results.html'));
    const table = findSearchTable(doc)!;
    const cols = headerIndex(table);
    const rows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')];
    const subjects = rows
      .map((r) => parseSearchRow(r, cols))
      .filter((s) => s !== null);

    expect(subjects.length).toBe(rows.length);
    // The fixtures were captured from the same search, so the first three
    // subjects must line up with the three the export fixture keeps.
    expect(subjects.slice(0, 3).map((s) => timetable.has(s.subjectCode))).toEqual(
      [true, true, true],
    );
  });
});
