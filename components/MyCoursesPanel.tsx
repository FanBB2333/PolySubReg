import { useMemo } from 'react';
import { DownloadCloud, TriangleAlert, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeeklyGrid } from '@/components/WeeklyGrid';
import { useCart } from '@/lib/hooks/useCart';
import { findConflicts, formatSession, totalCredits } from '@/lib/polyu/timetable';
import type { SelectedCourse } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MyCoursesPanelProps {
  onClose: () => void;
  /** Present only where the page can be scraped for registered subjects. */
  onImport?: () => void;
  importState?: 'idle' | 'importing' | 'done' | 'empty';
}

export function MyCoursesPanel({
  onClose,
  onImport,
  importState = 'idle',
}: MyCoursesPanelProps) {
  const { cart, remove, clear } = useCart();
  const conflicts = useMemo(() => findConflicts(cart), [cart]);
  const credits = useMemo(() => totalCredits(cart), [cart]);
  const sessionCount = cart.reduce((n, c) => n + c.sessions.length, 0);

  return (
    <div className="flex h-full w-full flex-col bg-card">
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Courses</h2>
          <div className="flex items-center gap-1">
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => clear()}>
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <Stat label="Courses" value={cart.length} />
          <Stat label="Credits" value={credits} />
          <Stat label="Sessions" value={sessionCount} />
        </div>

        {conflicts.size > 0 && (
          <div className="mt-2 flex items-center gap-1.5 rounded bg-destructive/10 p-2 text-sm text-destructive">
            <TriangleAlert className="size-4 shrink-0" />
            {conflicts.size} course(s) have timetable clashes
          </div>
        )}

        {onImport && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            disabled={importState === 'importing'}
            onClick={onImport}
          >
            <DownloadCloud className="size-3.5" />
            {importState === 'importing'
              ? 'Importing…'
              : importState === 'empty'
                ? 'Nothing found on this page'
                : 'Import from this page'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="schedule" className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="schedule" className="flex-1">
              Weekly
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1">
              List
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="schedule" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <WeeklyGrid courses={cart} conflicts={conflicts} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="list" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No courses selected</p>
                  <p className="mt-1 text-xs">
                    Expand a subject in the search results and add a group
                  </p>
                </div>
              ) : (
                cart.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    conflictsWith={[...(conflicts.get(course.id) ?? [])]
                      .map((id) => cart.find((c) => c.id === id)?.subjectCode)
                      .filter(Boolean)
                      .join(', ')}
                    onRemove={() => remove(course.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface CourseCardProps {
  course: SelectedCourse;
  conflictsWith: string;
  onRemove: () => void;
}

function CourseCard({ course, conflictsWith, onRemove }: CourseCardProps) {
  return (
    <Card
      className={cn(
        'gap-0 py-0 transition-all',
        conflictsWith && 'border-destructive bg-destructive/5',
      )}
    >
      <CardHeader className="gap-0 p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">
              {course.subjectCode} · {course.groupCode}
            </div>
            <CardTitle className="text-sm leading-tight font-medium">
              {course.subjectTitle || course.subjectCode}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label="Remove"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="mb-2 flex flex-wrap gap-1">
          {course.credits && (
            <Badge variant="secondary" className="text-xs">
              {course.credits} credits
            </Badge>
          )}
          {course.source === 'estudent' && (
            <Badge variant="outline" className="text-xs">
              Registered
            </Badge>
          )}
        </div>
        {course.sessions.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {course.sessions.map(formatSession).join('; ')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No published sessions</p>
        )}
        {conflictsWith && (
          <>
            <Separator className="my-2" />
            <p className="text-xs text-destructive">
              Clashes with: {conflictsWith}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
