import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronsRight } from 'lucide-react';
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
          // The open panel slides over the launcher; fade it out underneath.
          open && 'pointer-events-none opacity-0',
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

      {/* Dims the page while the panel is open; clicking it closes the panel. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-[2147482999] bg-foreground/25 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <div
        className={cn(
          'fixed top-0 right-0 z-[2147483000] flex h-screen border-l border-border shadow-2xl transition-transform duration-300 ease-in-out',
          // Roughly 3/5 of the page, clamped so it neither collapses on a
          // narrow window nor sprawls on an ultrawide one.
          'w-[clamp(560px,60vw,1040px)] max-w-full',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse My Courses"
          className={cn(
            'flex h-full w-7 shrink-0 flex-col items-center justify-center gap-3 border-r border-border',
            'bg-muted/50 transition-colors hover:bg-muted',
          )}
        >
          <ChevronsRight className="size-4 text-muted-foreground" />
          <span
            className="text-[11px] font-medium text-muted-foreground"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            My Courses{cart.length > 0 && ` (${cart.length})`}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <MyCoursesPanel
            onClose={() => setOpen(false)}
            onImport={harvestable ? runImport : undefined}
            importState={importState}
          />
        </div>
      </div>
    </>
  );
}
