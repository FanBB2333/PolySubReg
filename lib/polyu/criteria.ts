import { criteriaCacheItem, programmeCacheItem } from '@/lib/storage';
import {
  BY_SUBJECT_FIELDS,
  COMMON_SEARCH_FIELDS,
  PROG_DEPT_FIELD,
  PROG_ID_FIELD,
  YEARSEM_FIELD,
} from '@/lib/types';

export interface CriteriaOption {
  value: string;
  label: string;
}

export interface SearchCriteria {
  fields: Record<string, CriteriaOption[]>;
  /** The semester the server itself pre-selects on a fresh page. */
  serverYearsem: string;
}

const EPUBLIC_SEARCH_URL = 'https://www38.polyu.edu.hk/ePublic/subject-search.jsf';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Every criteria select that is populated on the initial GET render. */
const STATIC_FIELD_IDS = [
  ...COMMON_SEARCH_FIELDS.map((f) => f.id),
  ...BY_SUBJECT_FIELDS.map((f) => f.id),
  PROG_DEPT_FIELD,
];

function parseOptions(select: HTMLSelectElement): CriteriaOption[] {
  return Array.from(select.options, (o) => ({
    value: o.value,
    label: o.textContent?.trim() ?? o.value,
  })).filter((o) => o.value !== '');
}

/**
 * The option lists for the search-default criteria, scraped off the anonymous
 * ePublic search form. Runs in extension pages (options/popup), where the
 * `www38.polyu.edu.hk` host permission lets us fetch cross-origin.
 *
 * Results are cached for a day; on a network failure the stale cache is served
 * rather than nothing, since the lists change at most once a semester.
 */
export async function loadSearchCriteria(force = false): Promise<SearchCriteria> {
  const cached = await criteriaCacheItem.getValue();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { fields: cached.fields, serverYearsem: cached.serverYearsem };
  }

  try {
    const res = await fetch(EPUBLIC_SEARCH_URL, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    const fields: Record<string, CriteriaOption[]> = {};
    for (const id of STATIC_FIELD_IDS) {
      const select = doc.getElementById(id);
      if (select instanceof HTMLSelectElement) fields[id] = parseOptions(select);
    }
    if (Object.keys(fields).length === 0) {
      throw new Error('no criteria fields found in the page');
    }

    const yearsem = doc.getElementById(YEARSEM_FIELD);
    const serverYearsem =
      yearsem instanceof HTMLSelectElement ? yearsem.value : '';

    await criteriaCacheItem.setValue({
      fetchedAt: Date.now(),
      fields,
      serverYearsem,
    });
    return { fields, serverYearsem };
  } catch (error) {
    if (cached) return { fields: cached.fields, serverYearsem: cached.serverYearsem };
    throw error;
  }
}

/**
 * The Programme list for one (semester, hosting department) pair.
 *
 * JSF populates that select only through a form re-render, so this replays the
 * page's own auto-submit: GET for the session cookie and ViewState, then POST
 * the form in byProgramme mode. The server rejects the POST unless a semester
 * is selected — pass the user's default or the server's own pre-selection.
 */
export async function loadProgrammeOptions(
  yearsem: string,
  department: string,
  force = false,
): Promise<CriteriaOption[]> {
  const key = `${yearsem}|${department}`;
  const cache = await programmeCacheItem.getValue();
  const hit = cache[key];
  if (!force && hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.options;
  }

  try {
    const getRes = await fetch(EPUBLIC_SEARCH_URL, { credentials: 'include' });
    if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
    const getDoc = new DOMParser().parseFromString(await getRes.text(), 'text/html');
    const viewState =
      getDoc
        .querySelector<HTMLInputElement>('input[name="javax.faces.ViewState"]')
        ?.value ?? 'j_id1';

    const body = new URLSearchParams({
      mainForm: 'mainForm',
      'mainForm:searchMode': 'byProgramme',
      [YEARSEM_FIELD]: yearsem,
      [PROG_DEPT_FIELD]: department,
      [PROG_ID_FIELD]: '',
      'javax.faces.ViewState': viewState,
    });
    const res = await fetch(EPUBLIC_SEARCH_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const select = doc.getElementById(PROG_ID_FIELD);
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('programme list missing from the response');
    }
    const options = parseOptions(select);

    await programmeCacheItem.setValue({
      ...cache,
      [key]: { fetchedAt: Date.now(), options },
    });
    return options;
  } catch (error) {
    if (hit) return hit.options;
    throw error;
  }
}
