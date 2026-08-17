/**
 * PolyU runs the same JSF application twice: `ePublic` is anonymous, `eStudent`
 * is behind ADFS SSO. Page markup is identical, only the path prefix differs.
 */
export type PolyuApp = 'ePublic' | 'eStudent' | 'unknown';

export const POLYU_HOST = 'www38.polyu.edu.hk';

export function currentApp(pathname = location.pathname): PolyuApp {
  if (pathname.startsWith('/ePublic/')) return 'ePublic';
  if (pathname.startsWith('/eStudent/')) return 'eStudent';
  return 'unknown';
}

/**
 * The subject search page and its timetable export live in the same directory,
 * so a relative URL works for both apps without hard-coding either prefix.
 */
export function exportTimetableUrl(): string {
  return new URL('./subject-search-export-timetable.jsf', location.href).href;
}

export function isSubjectSearchPage(pathname = location.pathname): boolean {
  return /\/(ePublic|eStudent\/secure\/information)\/subject-search\.jsf$/.test(
    pathname,
  );
}
