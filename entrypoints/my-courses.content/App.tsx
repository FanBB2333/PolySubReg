import { useCallback, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { MyCoursesPanel } from '@/components/MyCoursesPanel';
import { useCart } from '@/lib/hooks/useCart';
import { harvestRegisteredCourses, isHarvestablePage } from '@/lib/polyu/harvest';
import { replaceHarvestedCourses } from '@/lib/storage';
import { cn } from '@/lib/utils';

type ImportState = 'idle' | 'importing' | 'done' | 'empty';

export function App() {
  const [open, setOpen] = useState(false);
  const [importState, setImportState] = useState<ImportState>('idle');
  const { cart } = useCart();
  const harvestable = isHarvestablePage();

  const runImport = useCallback(async () => {
    setImportState('importing');
    const courses = harvestRegisteredCourses();
    if (courses.length === 0) {
      setImportState('empty');
      return;
    }
    await replaceHarvestedCourses(courses);
    setImportState('done');
  }, []);

  // Registration and class-timetable pages list what the user is already taking.
  // Pull those in automatically so the panel is populated the first time it is
  // opened, without the user having to know about the import button.
  useEffect(() => {
    if (!harvestable) return;
    const courses = harvestRegisteredCourses();
    if (courses.length > 0) void replaceHarvestedCourses(courses);
  }, [harvestable]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="My Courses"
        className={cn(
          'fixed top-24 right-0 z-[2147483000] flex items-center gap-2 rounded-l-lg border border-r-0 border-border',
          'bg-card py-2.5 pr-3 pl-3 text-sm font-medium shadow-lg transition-all',
          'hover:bg-muted',
          open && 'right-96',
        )}
      >
        <CalendarDays className="size-4 text-primary" />
        <span>My Courses</span>
        {cart.length > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] leading-none text-primary-foreground">
            {cart.length}
          </span>
        )}
      </button>

      <div
        className={cn(
          'fixed top-0 right-0 z-[2147483000] h-screen border-l border-border shadow-2xl transition-transform duration-300 ease-in-out',
          'w-96',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <MyCoursesPanel
          onClose={() => setOpen(false)}
          onImport={harvestable ? runImport : undefined}
          importState={importState}
        />
      </div>
    </>
  );
}
