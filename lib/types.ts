/** A single timetabled class meeting, as exported by `subject-search-export-timetable.jsf`. */
export interface ClassSession {
  /** Component code, e.g. `LEC001`, `LAB002`, `TUT001`. */
  componentCode: string;
  /** How often the session repeats, in weeks. `1` means every week. */
  everyWeeks: number;
  startWeek: number;
  endWeek: number;
  /** `Mon` … `Sun`, verbatim from the page. */
  dayOfWeek: string;
  /** `HH:mm`. */
  startTime: string;
  /** `HH:mm`. */
  endTime: string;
  venue: string;
  teachingStaff: string;
  remark: string;
}

/**
 * A group's row in the "Subject Group Details" table of
 * `subject-search-details.jsf` — who may take it and whether there is room,
 * neither of which the timetable export carries.
 */
export interface SubjectGroupDetail {
  /** Programme codes allowed to take this group, e.g. `61435-` or `61435-FCS`. */
  eligibleProgrammes: string[];
  /** PolyU's group type code, e.g. `PS`. */
  groupType: string;
  /** Places in the group, as printed. */
  groupSize: string;
  /**
   * The vacancies cell verbatim: `(25)` normally, or `(W=40)/(Top-up vac=0)`
   * once a waitlist has formed — the page's own footnote defines that form.
   */
  vacancies: string;
  /** Free places, when the cell prints a plain count. */
  seats: number | null;
  /** Students already queued, when a waitlist has formed. */
  waiting: number | null;
  /** Places released in the next auto top-up round. */
  topUp: number | null;
  /** `Yes` / `No`, verbatim. */
  waitlistAvailable: string;
}

/** One subject group (what PolyU calls a "class"), with all of its sessions. */
export interface SubjectGroup {
  groupCode: string;
  sessions: ClassSession[];
  /** Filled in once the details page has been fetched for this subject. */
  detail?: SubjectGroupDetail;
}

/** A row of the subject search result table, plus whatever detail we could attach. */
export interface Subject {
  subjectCode: string;
  subjectTitle: string;
  offeringDepartment: string;
  categories: string[];
  level: string;
  credits: string;
  groups: SubjectGroup[];
}

/** A subject group the user picked, stored in the local cart. */
export interface SelectedCourse {
  id: string;
  subjectCode: string;
  subjectTitle: string;
  groupCode: string;
  credits: string;
  offeringDepartment: string;
  sessions: ClassSession[];
  /** `local` = added from the search page, `estudent` = harvested from eStudent. */
  source: 'local' | 'estudent';
  addedAt: number;
}

export interface Credentials {
  netId: string;
  password: string;
  /**
   * Appended to the NetID to form the ADFS username. Leave empty for the
   * default `hh\<NetID>` AD format — PolyU's own ADFS page prepends `hh\` to
   * any username that carries neither `@` nor `\` (see its onload.js), and the
   * AD rejects the e-mail style `<NetID>@connect.polyu.edu.hk`.
   */
  domain: string;
}

export interface Settings {
  autoLogin: boolean;
  enhanceSearch: boolean;
  showMyCourses: boolean;
  /**
   * Drives the subject registration pages by itself. Off unless the user turns
   * it on: unlike the other three this one submits a registration on their
   * behalf, so it must never be something they get by installing the extension.
   */
  autoRegister: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoLogin: true,
  enhanceSearch: true,
  showMyCourses: true,
  autoRegister: false,
};

export const DEFAULT_CREDENTIALS: Credentials = {
  netId: '',
  password: '',
  domain: '',
};

/** The ADFS username the extension will submit for a given credential set. */
export function adfsUsername(credentials: Credentials): string {
  const { netId, domain } = credentials;
  if (netId.includes('@') || netId.includes('\\')) return netId;
  return domain ? `${netId}${domain}` : `hh\\${netId}`;
}

export function courseId(subjectCode: string, groupCode: string): string {
  return `${subjectCode}::${groupCode}`;
}

/**
 * The subject search criteria that can carry a user-configured default value,
 * applied when the search page opens. Ids are the JSF element ids, identical on
 * ePublic and eStudent. The form has two modes with disjoint criteria, plus the
 * Academic Year/Semester shared by both.
 */
export type SearchMode = 'bySubject' | 'byProgramme';

export const SEARCH_MODES: { value: SearchMode; label: string }[] = [
  { value: 'bySubject', label: 'By Subject' },
  { value: 'byProgramme', label: 'By Programme' },
];

export const COMMON_SEARCH_FIELDS = [
  { id: 'mainForm:yearsem', label: 'Academic Year / Semester' },
] as const;

export const BY_SUBJECT_FIELDS = [
  { id: 'mainForm:offerOrgUnitId', label: 'Offering Department' },
  { id: 'mainForm:subjCategory', label: 'Category' },
  { id: 'mainForm:additionalRequirement', label: 'Additional Requirements in CAR' },
  { id: 'mainForm:subjLevel', label: 'Subject Level' },
] as const;

export const BY_PROGRAMME_FIELDS = [
  { id: 'mainForm:progOrgUnitId', label: 'Programme Hosting Department' },
  { id: 'mainForm:progId', label: 'Programme' },
] as const;

export const YEARSEM_FIELD = 'mainForm:yearsem';
export const PROG_DEPT_FIELD = 'mainForm:progOrgUnitId';
export const PROG_ID_FIELD = 'mainForm:progId';

/** Selects whose change JSF answers with a full form submit and re-render. */
export const AUTO_SUBMIT_FIELD_IDS: ReadonlySet<string> = new Set([
  YEARSEM_FIELD,
  PROG_DEPT_FIELD,
]);

export interface SearchDefaults {
  /** Default search mode; `''` keeps the page's own default (By Subject). */
  mode: '' | SearchMode;
  /** Criteria shared by both modes (Academic Year/Semester). */
  common: Record<string, string>;
  bySubject: Record<string, string>;
  byProgramme: Record<string, string>;
}

export const EMPTY_SEARCH_DEFAULTS: SearchDefaults = {
  mode: '',
  common: {},
  bySubject: {},
  byProgramme: {},
};
