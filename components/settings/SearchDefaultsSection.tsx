import { useEffect, useState } from 'react';
import { Eraser, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  loadProgrammeOptions,
  loadSearchCriteria,
  type CriteriaOption,
  type SearchCriteria,
} from '@/lib/polyu/criteria';
import { searchDefaultsItem } from '@/lib/storage';
import {
  BY_PROGRAMME_FIELDS,
  BY_SUBJECT_FIELDS,
  COMMON_SEARCH_FIELDS,
  EMPTY_SEARCH_DEFAULTS,
  PROG_DEPT_FIELD,
  PROG_ID_FIELD,
  SEARCH_MODES,
  YEARSEM_FIELD,
  type SearchDefaults,
} from '@/lib/types';

type Status = 'loading' | 'ready' | 'error';
type Bucket = 'common' | 'bySubject' | 'byProgramme';

/**
 * Default values for the subject search: the search mode, the shared semester,
 * and one criteria set per mode. Option lists come from the live ePublic form;
 * the Programme list is fetched per (semester, hosting department) because the
 * page itself only populates it after a department is picked.
 */
export function SearchDefaultsSection() {
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [defaults, setDefaults] = useState<SearchDefaults>(EMPTY_SEARCH_DEFAULTS);
  const [status, setStatus] = useState<Status>('loading');
  const [progOptions, setProgOptions] = useState<CriteriaOption[]>([]);
  const [progStatus, setProgStatus] = useState<Status>('ready');

  const refresh = (force = false) => {
    setStatus('loading');
    loadSearchCriteria(force).then(
      (c) => {
        setCriteria(c);
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  };

  useEffect(() => {
    searchDefaultsItem.getValue().then(setDefaults);
    refresh();
  }, []);

  // The programme list follows the chosen hosting department and semester.
  const progDept = defaults.byProgramme[PROG_DEPT_FIELD] ?? '';
  const yearsem =
    defaults.common[YEARSEM_FIELD] || criteria?.serverYearsem || '';
  useEffect(() => {
    if (!progDept || !yearsem) {
      setProgOptions([]);
      return;
    }
    setProgStatus('loading');
    loadProgrammeOptions(yearsem, progDept).then(
      (options) => {
        setProgOptions(options);
        setProgStatus('ready');
      },
      () => setProgStatus('error'),
    );
  }, [progDept, yearsem]);

  const save = async (next: SearchDefaults) => {
    setDefaults(next);
    await searchDefaultsItem.setValue(next);
  };

  const setField = (bucket: Bucket, id: string, value: string) => {
    const record = { ...defaults[bucket] };
    if (value) record[id] = value;
    else delete record[id];
    const next = { ...defaults, [bucket]: record };
    // A programme belongs to its department (and semester); a stale pick
    // would silently point at the wrong programme.
    if (bucket === 'common' || (bucket === 'byProgramme' && id === PROG_DEPT_FIELD)) {
      const byProgramme = { ...next.byProgramme };
      delete byProgramme[PROG_ID_FIELD];
      next.byProgramme = byProgramme;
    }
    void save(next);
  };

  const configured =
    (defaults.mode ? 1 : 0) +
    [defaults.common, defaults.bySubject, defaults.byProgramme]
      .flatMap(Object.values)
      .filter(Boolean).length;

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <TriangleAlert className="size-4 shrink-0" />
        Could not load the option lists from PolyU.
        <Button variant="outline" size="sm" onClick={() => refresh(true)}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const loading = status === 'loading';
  const fieldOptions = (id: string) => criteria?.fields[id] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Applied once when the subject search opens. Semester and hosting
          department reload the page the same way picking them by hand would.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={configured === 0}
          onClick={() => void save(EMPTY_SEARCH_DEFAULTS)}
        >
          <Eraser className="size-3.5" /> Clear all
        </Button>
      </div>

      <Field label="Default search mode">
        <SearchableSelect
          options={SEARCH_MODES}
          value={defaults.mode}
          placeholder="Page default (By Subject)"
          onChange={(mode) =>
            void save({ ...defaults, mode: mode as SearchDefaults['mode'] })
          }
        />
      </Field>

      {COMMON_SEARCH_FIELDS.map(({ id, label }) => (
        <Field key={id} label={label}>
          <SearchableSelect
            options={fieldOptions(id)}
            value={defaults.common[id] ?? ''}
            placeholder={loading ? 'Loading options…' : '-- No default --'}
            disabled={loading}
            onChange={(value) => setField('common', id, value)}
          />
        </Field>
      ))}

      <GroupHeading>By Subject criteria</GroupHeading>
      {BY_SUBJECT_FIELDS.map(({ id, label }) => (
        <Field key={id} label={label}>
          <SearchableSelect
            options={fieldOptions(id)}
            value={defaults.bySubject[id] ?? ''}
            placeholder={loading ? 'Loading options…' : '-- No default --'}
            disabled={loading}
            onChange={(value) => setField('bySubject', id, value)}
          />
        </Field>
      ))}

      <GroupHeading>By Programme criteria</GroupHeading>
      {BY_PROGRAMME_FIELDS.map(({ id, label }) =>
        id === PROG_ID_FIELD ? (
          <Field key={id} label={label}>
            {progStatus === 'error' ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <TriangleAlert className="size-4 shrink-0" />
                Could not load the programme list.
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    loadProgrammeOptions(yearsem, progDept, true).then(
                      (options) => {
                        setProgOptions(options);
                        setProgStatus('ready');
                      },
                      () => setProgStatus('error'),
                    )
                  }
                >
                  <RefreshCw className="size-3.5" /> Retry
                </Button>
              </div>
            ) : (
              <SearchableSelect
                options={progOptions}
                value={defaults.byProgramme[id] ?? ''}
                placeholder={
                  !progDept
                    ? 'Pick a hosting department first'
                    : progStatus === 'loading'
                      ? 'Loading programmes…'
                      : '-- No default --'
                }
                disabled={!progDept || progStatus === 'loading'}
                onChange={(value) => setField('byProgramme', id, value)}
              />
            )}
          </Field>
        ) : (
          <Field key={id} label={label}>
            <SearchableSelect
              options={fieldOptions(id)}
              value={defaults.byProgramme[id] ?? ''}
              placeholder={loading ? 'Loading options…' : '-- No default --'}
              disabled={loading}
              onChange={(value) => setField('byProgramme', id, value)}
            />
          </Field>
        ),
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-x-4">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-1">
      <div className="mb-1 text-xs font-semibold tracking-wide text-foreground/70 uppercase">
        {children}
      </div>
      <Separator />
    </div>
  );
}
