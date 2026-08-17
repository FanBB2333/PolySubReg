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

/** One subject group (what PolyU calls a "class"), with all of its sessions. */
export interface SubjectGroup {
  groupCode: string;
  sessions: ClassSession[];
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
  /** Appended to the NetID to form the ADFS username. */
  domain: string;
}

export interface Settings {
  autoLogin: boolean;
  enhanceSearch: boolean;
  showMyCourses: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoLogin: true,
  enhanceSearch: true,
  showMyCourses: true,
};

export const DEFAULT_CREDENTIALS: Credentials = {
  netId: '',
  password: '',
  domain: '@connect.polyu.edu.hk',
};

export function courseId(subjectCode: string, groupCode: string): string {
  return `${subjectCode}::${groupCode}`;
}
