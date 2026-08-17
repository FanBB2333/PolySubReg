import { criteriaCacheItem } from '@/lib/storage';
import { SEARCH_DEFAULT_FIELDS } from '@/lib/types';

export interface CriteriaOption {
  value: string;
  label: string;
}

const EPUBLIC_SEARCH_URL = 'https://www38.polyu.edu.hk/ePublic/subject-search.jsf';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The option lists for the search-default criteria, scraped off the anonymous
 * ePublic search form. Runs in extension pages (options/popup), where the
 * `www38.polyu.edu.hk` host permission lets us fetch cross-origin.
 *
 * Results are cached for a day; on a network failure the stale cache is served
 * rather than nothing, since the lists change at most once a semester.
 */
export async function loadSearchCriteria(
  force = false,
): Promise<Record<string, CriteriaOption[]>> {
  const cached = await criteriaCacheItem.getValue();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.fields;
  }

  try {
    const res = await fetch(EPUBLIC_SEARCH_URL, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    const fields: Record<string, CriteriaOption[]> = {};
    for (const { id } of SEARCH_DEFAULT_FIELDS) {
      const select = doc.getElementById(id);
      if (!(select instanceof HTMLSelectElement)) continue;
      fields[id] = Array.from(select.options, (o) => ({
        value: o.value,
        label: o.textContent?.trim() ?? o.value,
      })).filter((o) => o.value !== '');
    }
    if (Object.keys(fields).length === 0) {
      throw new Error('no criteria fields found in the page');
    }

    await criteriaCacheItem.setValue({ fetchedAt: Date.now(), fields });
    return fields;
  } catch (error) {
    if (cached) return cached.fields;
    throw error;
  }
}
