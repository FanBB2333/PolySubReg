import ReactDOM from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { SubjectGroups } from '@/components/SubjectGroups';
import { loadGroupDetails, subjectLinkOf } from '@/lib/polyu/details';
import {
  findSearchTable,
  headerIndex,
  parseExportTimetable,
  parseSearchRow,
  SEARCH_HEADERS,
} from '@/lib/polyu/parse';
import { exportTimetableUrl } from '@/lib/polyu/site';
import { staffOf } from '@/lib/polyu/timetable';
import type { Subject, SubjectGroup } from '@/lib/types';

const ENHANCED = 'data-psr-enhanced';

type TimetableIndex = Map<string, SubjectGroup[]>;

let timetablePromise: Promise<TimetableIndex> | null = null;

/**
 * Fetches the timetable for the *entire* current result set.
 *
 * `subject-search-export-timetable.jsf` is the page's own "Export Timetable"
 * target: one GET returns every group, component, slot, venue and lecturer for
 * all matching subjects across all result pages. Pulling it once means expanding
 * a row costs nothing, where the site itself needs a full navigation per subject.
 */
function loadTimetable(): Promise<TimetableIndex> {
  timetablePromise ??= fetch(exportTimetableUrl(), {
    credentials: 'same-origin',
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(parseExportTimetable)
    .catch((error) => {
      // Let the next expand retry rather than caching the failure forever.
      timetablePromise = null;
      throw error;
    });
  return timetablePromise;
}

/** Discards the cached timetable — call when a new search is submitted. */
export function invalidateTimetable(): void {
  timetablePromise = null;
}

export async function enhanceResults(ctx: ContentScriptContext): Promise<void> {
  const table = findSearchTable();
  if (!table) return;

  const cols = headerIndex(table);
  const codeIndex = cols.get(SEARCH_HEADERS.code) ?? 0;
  const titleIndex = cols.get(SEARCH_HEADERS.title);
  const columnCount = table.querySelectorAll('thead th').length || 6;

  const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
  const subjects: { row: HTMLTableRowElement; subject: Subject }[] = [];

  for (const row of rows) {
    if (row.hasAttribute(ENHANCED)) continue;
    const subject = parseSearchRow(row, cols);
    if (!subject) continue;
    row.setAttribute(ENHANCED, '');

    const codeCell = row.cells[codeIndex];
    if (!codeCell) continue;

    const toggle = createToggle();
    codeCell.insertBefore(toggle, codeCell.firstChild);
    subjects.push({ row, subject });

    let detailRow: HTMLTableRowElement | null = null;
    let expanded = false;

    toggle.addEventListener('click', async () => {
      expanded = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded ? '▾' : '▸';

      if (!expanded) {
        detailRow?.remove();
        detailRow = null;
        return;
      }

      detailRow = table.ownerDocument.createElement('tr');
      detailRow.className = 'psr-detail-row';
      const cell = table.ownerDocument.createElement('td');
      cell.colSpan = columnCount;
      cell.style.padding = '0';
      detailRow.appendChild(cell);
      row.after(detailRow);

      await mountDetail(ctx, cell, subject, subjectLinkOf(row));
    });
  }

  if (subjects.length === 0) return;

  // Annotate every row in the background so the collapsed table already shows
  // group and lecturer counts without the user expanding anything.
  try {
    const timetable = await loadTimetable();
    for (const { row, subject } of subjects) {
      subject.groups = timetable.get(subject.subjectCode) ?? [];
      const titleCell =
        titleIndex === undefined ? undefined : row.cells[titleIndex];
      if (titleCell) appendSummary(titleCell, subject);
    }
  } catch (error) {
    console.warn('[PSR] could not preload the timetable export:', error);
  }
}

function createToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'psr-expand-toggle';
  button.textContent = '▸';
  button.title = 'Show subject groups, class times and lecturers';
  button.setAttribute('aria-expanded', 'false');
  return button;
}

function appendSummary(titleCell: HTMLTableCellElement, subject: Subject): void {
  if (titleCell.querySelector('.psr-summary')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'psr-summary';

  if (subject.groups.length === 0) {
    wrapper.append(chip('No timetable', 'muted'));
    titleCell.appendChild(wrapper);
    return;
  }

  const sessions = subject.groups.reduce((n, g) => n + g.sessions.length, 0);
  const staff = staffOf(subject.groups.flatMap((g) => g.sessions));

  wrapper.append(
    chip(
      `${subject.groups.length} group${subject.groups.length > 1 ? 's' : ''}`,
      'primary',
    ),
    chip(`${sessions} session${sessions > 1 ? 's' : ''}/wk`, 'muted'),
  );
  for (const name of staff.slice(0, 3)) wrapper.append(chip(name, 'muted'));
  if (staff.length > 3) wrapper.append(chip(`+${staff.length - 3}`, 'muted'));

  titleCell.appendChild(wrapper);
}

function chip(label: string, tone: 'primary' | 'muted'): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `psr-chip psr-chip-${tone}`;
  span.textContent = label;
  return span;
}

async function mountDetail(
  ctx: ContentScriptContext,
  anchor: HTMLElement,
  subject: Subject,
  link: HTMLAnchorElement | null,
): Promise<void> {
  const ui = await createShadowRootUi(ctx, {
    name: 'psr-subject-detail',
    position: 'inline',
    anchor,
    append: 'first',
    onMount: (container) => {
      const root = ReactDOM.createRoot(container);
      root.render(<SubjectGroups subject={subject} loading />);

      const timetable = loadTimetable();
      // Vacancies come from a second request, one subject at a time. Start it
      // now and render the timetable as soon as it lands rather than making the
      // whole panel wait for the slower of the two.
      const details = link
        ? loadGroupDetails(subject.subjectCode, link)
        : Promise.reject(new Error('no subject link in this row'));
      details.catch(() => {}); // handled below; keep it from going unhandled

      timetable.then(
        (byCode) =>
          root.render(
            <SubjectGroups
              subject={{ ...subject, groups: byCode.get(subject.subjectCode) ?? [] }}
              loading={false}
              details="loading"
            />,
          ),
        (error: unknown) =>
          root.render(
            <SubjectGroups
              subject={subject}
              loading={false}
              error={`Could not load the timetable: ${String(error)}`}
            />,
          ),
      );

      Promise.all([timetable, details]).then(
        ([byCode, byGroup]) =>
          root.render(
            <SubjectGroups
              subject={{
                ...subject,
                groups: (byCode.get(subject.subjectCode) ?? []).map((group) => ({
                  ...group,
                  detail: byGroup.get(group.groupCode),
                })),
              }}
              loading={false}
              details="ready"
            />,
          ),
        (error: unknown) => {
          // A missing details page costs the vacancies, not the timetable.
          console.warn('[PSR] could not load the subject details:', error);
          timetable.then((byCode) =>
            root.render(
              <SubjectGroups
                subject={{ ...subject, groups: byCode.get(subject.subjectCode) ?? [] }}
                loading={false}
                details="failed"
              />,
            ),
          );
        },
      );

      return root;
    },
    onRemove: (root) => root?.unmount(),
  });

  ui.mount();
}
