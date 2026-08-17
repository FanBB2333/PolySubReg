import { courseId, type ClassSession, type SelectedCourse } from '@/lib/types';
import { findTableByHeaders, headerIndex, text } from '@/lib/polyu/parse';

/**
 * eStudent's registration and class-timetable pages are not part of the public
 * app, so we cannot enumerate their URLs up front. Instead of hard-coding paths
 * that may not exist, the harvester keys off table *shape*: any RichFaces table
 * carrying a subject code and a subject group column is treated as a list of the
 * user's registered subjects.
 */
const SUBJECT_CODE_HEADERS = ['Subject Code'];
const GROUP_HEADERS = ['Subject Group Code', 'Subject Group', 'Group Code', 'Group'];
const TITLE_HEADERS = ['Subject Title', 'Subject Name'];
const CREDIT_HEADERS = ['Credit(s)', 'Credits', 'Credit'];

function pick(cols: Map<string, number>, candidates: string[]): number | undefined {
  for (const c of candidates) {
    const i = cols.get(c);
    if (i !== undefined) return i;
  }
  return undefined;
}

/** Pages whose tables describe *offerings*, not the user's own registrations. */
export function isHarvestablePage(pathname = location.pathname): boolean {
  if (!pathname.startsWith('/eStudent/')) return false;
  return !/subject-search(-details)?\.jsf$/.test(pathname);
}

/**
 * Scrapes every table on the current page that looks like a registered-subject
 * list. Rows carrying day/time columns also contribute timetable sessions, so a
 * class-timetable page yields fully scheduled courses while a plain registration
 * summary yields courses with no sessions.
 */
export function harvestRegisteredCourses(
  root: ParentNode = document,
): SelectedCourse[] {
  const byId = new Map<string, SelectedCourse>();

  for (const table of root.querySelectorAll<HTMLTableElement>('table')) {
    const cols = headerIndex(table);
    const codeIdx = pick(cols, SUBJECT_CODE_HEADERS);
    const groupIdx = pick(cols, GROUP_HEADERS);
    if (codeIdx === undefined || groupIdx === undefined) continue;

    const titleIdx = pick(cols, TITLE_HEADERS);
    const creditIdx = pick(cols, CREDIT_HEADERS);
    const dayIdx = pick(cols, ['Day of Week', 'Day']);
    const startIdx = pick(cols, ['Start Time', 'From']);
    const endIdx = pick(cols, ['End Time', 'To']);
    const venueIdx = pick(cols, ['Venue', 'Room']);
    const staffIdx = pick(cols, ['Teaching Staff', 'Staff', 'Teacher']);
    const componentIdx = pick(cols, ['Component Code', 'Component']);

    for (const row of table.querySelectorAll<HTMLTableRowElement>('tbody tr')) {
      const cell = (i?: number) => (i === undefined ? '' : text(row.cells[i]));
      const subjectCode = cell(codeIdx);
      const groupCode = cell(groupIdx);
      if (!subjectCode || !groupCode) continue;

      const id = courseId(subjectCode, groupCode);
      const existing = byId.get(id);
      const course: SelectedCourse = existing ?? {
        id,
        subjectCode,
        subjectTitle: cell(titleIdx),
        groupCode,
        credits: cell(creditIdx),
        offeringDepartment: '',
        sessions: [],
        source: 'estudent',
        addedAt: Date.now(),
      };

      const day = cell(dayIdx);
      const startTime = cell(startIdx);
      if (day && startTime) {
        const session: ClassSession = {
          componentCode: cell(componentIdx),
          everyWeeks: Number(cell(pick(cols, ['For Every (Week)']))) || 1,
          startWeek: Number(cell(pick(cols, ['Start Week']))) || 0,
          endWeek: Number(cell(pick(cols, ['End Week']))) || 0,
          dayOfWeek: day,
          startTime,
          endTime: cell(endIdx),
          venue: cell(venueIdx),
          teachingStaff: cell(staffIdx),
          remark: '',
        };
        course.sessions.push(session);
      }

      byId.set(id, course);
    }
  }

  return [...byId.values()];
}
