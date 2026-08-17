import { searchDefaultsItem } from '@/lib/storage';
import {
  AUTO_SUBMIT_FIELD_IDS,
  PROG_DEPT_FIELD,
  PROG_ID_FIELD,
} from '@/lib/types';

const APPLIED_KEY = 'psr:search-defaults-applied';
const MODE_KEY = 'mode';

function loadApplied(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(APPLIED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

/**
 * Pre-selects the user's configured default criteria on a freshly opened
 * subject search page.
 *
 * Guards:
 * - each default applies once per tab session — re-applying later would
 *   clobber choices the user made by hand;
 * - never on a page that already shows results — those values are the user's
 *   own search, restored by JSF;
 * - only values that still exist in the dropdown (semesters rotate out).
 *
 * Two of the selects (semester, programme hosting department) carry JSF's
 * auto-submit behaviour: changing them reloads the page. All values are set
 * first and a single change event fires last — the submit posts the whole
 * form, so the reloaded page comes back with every default restored. The
 * Programme list only exists after that reload, which is why the applied set
 * is per-field: the second pass fills what the first could not.
 */
export async function applySearchDefaults(): Promise<void> {
  if (document.getElementById('mainForm:searchResult')) return;

  const defaults = await searchDefaultsItem.getValue();
  const applied = loadApplied();

  // Search mode radio: the page's own script toggles the criteria blocks on
  // click, so go through a real click rather than setting `checked`.
  if (defaults.mode && !applied.has(MODE_KEY)) {
    applied.add(MODE_KEY);
    const radio = document.getElementById(
      defaults.mode === 'byProgramme'
        ? 'mainForm:byProgramme'
        : 'mainForm:bySubject',
    );
    if (radio instanceof HTMLInputElement && !radio.checked) radio.click();
  }

  // Only the active mode's criteria (plus the shared semester) are applied —
  // defaults for the other mode would submit along with the form otherwise.
  const effectiveMode = defaults.mode || 'bySubject';
  const wanted: Record<string, string> = {
    ...defaults.common,
    ...(effectiveMode === 'byProgramme' ? defaults.byProgramme : defaults.bySubject),
  };

  let autoSubmitChanged: HTMLSelectElement | null = null;
  for (const [id, value] of Object.entries(wanted)) {
    if (!value || applied.has(id)) continue;
    const select = document.getElementById(id);
    if (!(select instanceof HTMLSelectElement)) continue;

    if (!Array.from(select.options).some((o) => o.value === value)) {
      // The Programme list is empty until the hosting department's reload;
      // keep it pending while that reload is still coming.
      const pendingReload = id === PROG_ID_FIELD && !!wanted[PROG_DEPT_FIELD];
      if (!pendingReload) applied.add(id);
      continue;
    }

    applied.add(id);
    if (select.value !== value) {
      select.value = value;
      if (AUTO_SUBMIT_FIELD_IDS.has(id)) autoSubmitChanged = select;
    }
  }

  // Persist before the change event: an auto-submit unloads the page.
  sessionStorage.setItem(APPLIED_KEY, JSON.stringify([...applied]));

  if (autoSubmitChanged) {
    autoSubmitChanged.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
