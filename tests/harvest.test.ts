import { describe, expect, it } from 'vitest';
import { harvestRegisteredCourses, isHarvestablePage } from '@/lib/polyu/harvest';

/**
 * eStudent's registration pages sit behind SSO, so these fixtures reproduce the
 * RichFaces table shape the harvester keys off rather than a captured response.
 */
function doc(body: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><body>${body}</body></html>`,
    'text/html',
  );
}

function table(headers: string[], rows: string[][]): string {
  return `<table class="dr-table rich-table">
    <thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
      .join('')}</tbody>
  </table>`;
}

describe('isHarvestablePage', () => {
  it('accepts eStudent pages that are not the subject search', () => {
    expect(
      isHarvestablePage('/eStudent/secure/registration/subject-registration.jsf'),
    ).toBe(true);
  });

  it('rejects the subject search, whose tables list offerings, not registrations', () => {
    expect(isHarvestablePage('/eStudent/secure/information/subject-search.jsf')).toBe(
      false,
    );
    expect(
      isHarvestablePage('/eStudent/secure/information/subject-search-details.jsf'),
    ).toBe(false);
  });

  it('rejects the anonymous ePublic app entirely', () => {
    expect(isHarvestablePage('/ePublic/subject-search.jsf')).toBe(false);
  });
});

describe('harvestRegisteredCourses', () => {
  it('reads a registration summary that carries no class times', () => {
    const courses = harvestRegisteredCourses(
      doc(
        table(
          ['Subject Code', 'Subject Title', 'Subject Group', 'Credit(s)'],
          [
            ['COMP5911', 'SOFTWARE ENGINEERING', '1011', '3.0'],
            ['COMP5121', 'DATA MINING', '2011', '3.0'],
          ],
        ),
      ),
    );

    expect(courses.map((c) => c.id)).toEqual([
      'COMP5911::1011',
      'COMP5121::2011',
    ]);
    expect(courses[0]).toMatchObject({
      subjectCode: 'COMP5911',
      subjectTitle: 'SOFTWARE ENGINEERING',
      groupCode: '1011',
      credits: '3.0',
      source: 'estudent',
      sessions: [],
    });
  });

  it('folds a class timetable into one course per group', () => {
    const courses = harvestRegisteredCourses(
      doc(
        table(
          [
            'Subject Code',
            'Subject Title',
            'Subject Group Code',
            'Component Code',
            'Day of Week',
            'Start Time',
            'End Time',
            'Venue',
            'Teaching Staff',
          ],
          [
            ['COMP5911', 'SOFTWARE ENGINEERING', '1011', 'LEC001', 'Mon', '18:30', '21:20', 'PQ603', 'CHAN, Tai Man'],
            ['COMP5911', 'SOFTWARE ENGINEERING', '1011', 'TUT001', 'Wed', '19:30', '20:20', 'PQ604A', 'CHAN, Tai Man'],
            ['COMP5121', 'DATA MINING', '2011', 'LEC001', 'Thu', '18:30', '21:20', 'FJ304', 'WONG, Siu Ming'],
          ],
        ),
      ),
    );

    expect(courses).toHaveLength(2);
    expect(courses[0]!.sessions.map((s) => s.componentCode)).toEqual([
      'LEC001',
      'TUT001',
    ]);
    expect(courses[0]!.sessions[0]).toMatchObject({
      dayOfWeek: 'Mon',
      startTime: '18:30',
      endTime: '21:20',
      venue: 'PQ603',
      teachingStaff: 'CHAN, Tai Man',
    });
    expect(courses[1]!.sessions).toHaveLength(1);
  });

  it('ignores tables without both a subject code and a group column', () => {
    expect(
      harvestRegisteredCourses(
        doc(table(['Subject Code', 'Grade'], [['COMP5911', 'A']])),
      ),
    ).toEqual([]);
  });

  it('skips rows missing either identifier', () => {
    const courses = harvestRegisteredCourses(
      doc(
        table(
          ['Subject Code', 'Subject Group'],
          [
            ['COMP5911', '1011'],
            ['', '2011'],
            ['COMP5121', ''],
            // RichFaces emits a total row with the same column count.
            ['Total', ''],
          ],
        ),
      ),
    );
    expect(courses.map((c) => c.id)).toEqual(['COMP5911::1011']);
  });
});
