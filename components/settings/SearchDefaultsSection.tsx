import { useEffect, useState } from 'react';
import { Eraser, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/SearchableSelect';
import { loadSearchCriteria, type CriteriaOption } from '@/lib/polyu/criteria';
import { searchDefaultsItem } from '@/lib/storage';
import { SEARCH_DEFAULT_FIELDS, type SearchDefaults } from '@/lib/types';

type Status = 'loading' | 'ready' | 'error';

/**
 * Default values for the subject search criteria. Option lists come from the
 * live ePublic form (cached for a day), so they always match what the page
 * actually offers. Every configured default is applied once when the search
 * page opens; each combobox's × clears its own default.
 */
export function SearchDefaultsSection() {
  const [criteria, setCriteria] = useState<Record<string, CriteriaOption[]>>({});
  const [defaults, setDefaults] = useState<SearchDefaults>({});
  const [status, setStatus] = useState<Status>('loading');

  const refresh = (force = false) => {
    setStatus('loading');
    loadSearchCriteria(force).then(
      (fields) => {
        setCriteria(fields);
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  };

  useEffect(() => {
    searchDefaultsItem.getValue().then(setDefaults);
    refresh();
  }, []);

  const update = async (id: string, value: string) => {
    const next = { ...defaults };
    if (value) next[id] = value;
    else delete next[id];
    setDefaults(next);
    await searchDefaultsItem.setValue(next);
  };

  const clearAll = async () => {
    setDefaults({});
    await searchDefaultsItem.setValue({});
  };

  const configured = Object.values(defaults).filter(Boolean).length;

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Applied once when the subject search opens. Changing the semester
          default reloads the page the same way picking it by hand would.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={configured === 0}
          onClick={clearAll}
        >
          <Eraser className="size-3.5" /> Clear all
        </Button>
      </div>

      {SEARCH_DEFAULT_FIELDS.map(({ id, label }) => (
        <div key={id} className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <SearchableSelect
            options={criteria[id] ?? []}
            value={defaults[id] ?? ''}
            placeholder={
              status === 'loading' ? 'Loading options…' : '-- No default --'
            }
            disabled={status === 'loading'}
            onChange={(value) => update(id, value)}
          />
        </div>
      ))}
    </div>
  );
}
