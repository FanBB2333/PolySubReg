import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findSearchTable,
  headerIndex,
  parseExportTimetable,
  parseSearchRow,
} from '@/lib/polyu/parse';

/**
 * Both fixtures are verbatim slices of live PolyU responses captured from
 * `subject-search.jsf` and `subject-search-export-timetable.jsf`, so these tests
 * pin the parsers to the markup RichFaces actually emits — generated `j_id*`
 * attributes, inline `<script>`/`<style>` blocks and all.
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
