import { storage } from 'wxt/utils/storage';
import {
  DEFAULT_CREDENTIALS,
  DEFAULT_SETTINGS,
  EMPTY_SEARCH_DEFAULTS,
  type Credentials,
  type SearchDefaults,
  type SelectedCourse,
  type Settings,
} from '@/lib/types';

/**
 * Credentials live in `storage.local` only — never `sync`, which would push the
 * password through the user's Google account.
 */
export const credentialsItem = storage.defineItem<Credentials>(
  'local:credentials',
  { fallback: DEFAULT_CREDENTIALS },
);

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

export const cartItem = storage.defineItem<SelectedCourse[]>('local:cart', {
  fallback: [],
});

/** User-configured default values for the subject search criteria. */
export const searchDefaultsItem = storage.defineItem<SearchDefaults>(
  'local:searchDefaults',
  {
    fallback: EMPTY_SEARCH_DEFAULTS,
    version: 2,
    migrations: {
      // v1 was one flat field-id → value record covering the By Subject
      // criteria plus the semester.
      2: (old: Record<string, string>): SearchDefaults => {
        const { 'mainForm:yearsem': yearsem, ...bySubject } = old ?? {};
        return {
          mode: '',
          common: yearsem ? { 'mainForm:yearsem': yearsem } : {},
          bySubject,
          byProgramme: {},
        };
      },
    },
  },
);

/** Cached option lists scraped off the ePublic search form for the options UI. */
export const criteriaCacheItem = storage.defineItem<{
  fetchedAt: number;
  fields: Record<string, { value: string; label: string }[]>;
  /** The semester the server itself pre-selects. */
  serverYearsem: string;
} | null>('local:searchCriteria', { fallback: null });

/** Programme lists fetched per (semester, hosting department) pair. */
export const programmeCacheItem = storage.defineItem<
  Record<string, { fetchedAt: number; options: { value: string; label: string }[] }>
>('local:programmeOptions', { fallback: {} });

export async function getSettings(): Promise<Settings> {
  // Merge over the defaults so a settings object written by an older version
  // still gets sensible values for keys added since.
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

export async function addToCart(course: SelectedCourse): Promise<void> {
  const cart = await cartItem.getValue();
  if (cart.some((c) => c.id === course.id)) return;
  await cartItem.setValue([...cart, course]);
}

export async function removeFromCart(id: string): Promise<void> {
  const cart = await cartItem.getValue();
  await cartItem.setValue(cart.filter((c) => c.id !== id));
}

/**
 * Replaces every `estudent`-sourced entry with `courses`, leaving the user's
 * own picks untouched. Called after harvesting an eStudent page.
 */
export async function replaceHarvestedCourses(
  courses: SelectedCourse[],
): Promise<void> {
  const cart = await cartItem.getValue();
  const kept = cart.filter((c) => c.source !== 'estudent');
  const keptIds = new Set(kept.map((c) => c.id));
  await cartItem.setValue([
    ...kept,
    ...courses.filter((c) => !keptIds.has(c.id)),
  ]);
}
