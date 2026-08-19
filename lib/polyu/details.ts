import { parseGroupDetails } from '@/lib/polyu/parse';
import type { SubjectGroupDetail } from '@/lib/types';

type DetailIndex = Map<string, SubjectGroupDetail>;

const cache = new Map<string, Promise<DetailIndex>>();

/** The subject-code link in a result row, which opens that subject's details. */
export function subjectLinkOf(
  row: HTMLTableRowElement,
): HTMLAnchorElement | null {
  return row.querySelector<HTMLAnchorElement>('a[id$=":subjCode"]');
}

/**
 * Fetches one subject's "Subject Group Details" — vacancies, group size and the
 * programmes each group is open to, none of which the timetable export carries.
 *
 * `subject-search-details.jsf` has no addressable URL: it renders whichever
 * subject the session last selected, so it can only be asked for by replaying
 * the form POST the subject-code link submits (see the `jsfcljs` handler JSF
 * writes onto that link). Doing so leaves the open results page alone — checked
 * against the live site: its DOM, its paging and the timetable export all
 * behave identically afterwards.
 */
export function loadGroupDetails(
  subjectCode: string,
  link: HTMLAnchorElement,
): Promise<DetailIndex> {
  const cached = cache.get(subjectCode);
  if (cached) return cached;

  const form = link.closest('form');
  if (!form) {
    return Promise.reject(new Error('the subject link is not inside a form'));
  }

  const body = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    body.append(key, String(value));
  }
  // What the link's own handler adds before submitting.
  body.append(link.id, link.id);

  const pending = fetch(form.action || location.href, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(parseGroupDetails)
    .catch((error) => {
      // Let the next expand retry rather than caching the failure forever.
      cache.delete(subjectCode);
      throw error;
    });

  cache.set(subjectCode, pending);
  return pending;
}
