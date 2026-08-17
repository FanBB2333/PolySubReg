import { searchDefaultsItem } from '@/lib/storage';

const APPLIED_KEY = 'psr:search-defaults-applied';
const YEARSEM_ID = 'mainForm:yearsem';

/**
 * Pre-selects the user's configured default criteria on a freshly opened
 * subject search page.
 *
 * Guards, in order:
 * - once per tab session — re-applying later would clobber choices the user
 *   made by hand;
 * - never on a page that already shows results — those values are the user's
 *   own search, restored by JSF;
 * - only values that still exist in the dropdown (semesters rotate out).
 *
 * The Academic Year/Semester select carries JSF's `auto-submit-with-dialog`
 * behaviour: changing it reloads the page. It is applied last so every other
 * default is already in the form when that submit fires, and the reloaded page
 * comes back with all of them restored server-side.
 */
export async function applySearchDefaults(): Promise<void> {
  if (sessionStorage.getItem(APPLIED_KEY)) return;
  if (document.getElementById('mainForm:searchResult')) return;

  const defaults = await searchDefaultsItem.getValue();
  const entries = Object.entries(defaults)
    .filter(([, value]) => value)
    .sort(([a], [b]) => Number(a === YEARSEM_ID) - Number(b === YEARSEM_ID));
  if (entries.length === 0) return;

  sessionStorage.setItem(APPLIED_KEY, '1');

  for (const [id, value] of entries) {
    const select = document.getElementById(id);
    if (!(select instanceof HTMLSelectElement)) continue;
    if (select.value === value) continue;
    if (!Array.from(select.options).some((o) => o.value === value)) continue;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
