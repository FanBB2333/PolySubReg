import { Check, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/hooks/useCart';
import { staffOf } from '@/lib/polyu/timetable';
import { courseId, type Subject, type SubjectGroup } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SubjectGroupsProps {
  subject: Subject;
  loading: boolean;
  error?: string;
}

/**
 * The panel injected under a search result row: one card per subject group,
 * headlined by the teaching staff so the user can compare lecturers at a glance.
 */
export function SubjectGroups({ subject, loading, error }: SubjectGroupsProps) {
  const { cart, add, remove } = useCart();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading timetable…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-destructive">
        <TriangleAlert className="size-4" />
        {error}
      </div>
    );
  }

  if (subject.groups.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        No timetable published for this subject in the selected academic
        year/semester.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {subject.groups.map((group) => (
        <GroupCard
          key={group.groupCode}
          group={group}
          selected={cart.some(
            (c) => c.id === courseId(subject.subjectCode, group.groupCode),
          )}
          onAdd={() =>
            add({
              id: courseId(subject.subjectCode, group.groupCode),
              subjectCode: subject.subjectCode,
              subjectTitle: subject.subjectTitle,
              groupCode: group.groupCode,
              credits: subject.credits,
              offeringDepartment: subject.offeringDepartment,
              sessions: group.sessions,
              source: 'local',
              addedAt: Date.now(),
            })
          }
          onRemove={() =>
            remove(courseId(subject.subjectCode, group.groupCode))
          }
        />
      ))}
    </div>
  );
}

interface GroupCardProps {
  group: SubjectGroup;
  selected: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

function GroupCard({ group, selected, onAdd, onRemove }: GroupCardProps) {
  const staff = staffOf(group.sessions);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-colors',
        selected ? 'border-primary/40 bg-primary/5' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            Group {group.groupCode}
          </Badge>
          {staff.length > 0 ? (
            staff.map((name) => (
              <Badge key={name} variant="outline" className="font-normal">
                {name}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">
              Teaching staff TBC
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant={selected ? 'secondary' : 'default'}
          className="h-7"
          onClick={selected ? onRemove : onAdd}
        >
          {selected ? (
            <>
              <Check className="size-3.5" /> Added
            </>
          ) : (
            <>
              <Plus className="size-3.5" /> My Courses
            </>
          )}
        </Button>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-3 py-1.5 text-left font-medium">Component</th>
            <th className="px-3 py-1.5 text-left font-medium">Day</th>
            <th className="px-3 py-1.5 text-left font-medium">Time</th>
            <th className="px-3 py-1.5 text-left font-medium">Weeks</th>
            <th className="px-3 py-1.5 text-left font-medium">Venue</th>
            <th className="px-3 py-1.5 text-left font-medium">Staff</th>
          </tr>
        </thead>
        <tbody>
          {group.sessions.map((session, i) => (
            <tr
              key={`${session.componentCode}-${session.dayOfWeek}-${session.startTime}-${i}`}
              className="border-t border-border/50"
            >
              <td className="px-3 py-1.5 font-mono">{session.componentCode}</td>
              <td className="px-3 py-1.5">{session.dayOfWeek}</td>
              <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                {session.startTime}–{session.endTime}
              </td>
              <td className="px-3 py-1.5 whitespace-nowrap">
                {session.startWeek || session.endWeek
                  ? `${session.startWeek}–${session.endWeek}`
                  : '—'}
                {session.everyWeeks > 1 && ` (every ${session.everyWeeks} wks)`}
              </td>
              <td className="px-3 py-1.5">{session.venue || '—'}</td>
              <td className="px-3 py-1.5">{session.teachingStaff || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {group.sessions.some((s) => s.remark) && (
        <div className="border-t border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
          {[...new Set(group.sessions.map((s) => s.remark).filter(Boolean))].join(
            ' · ',
          )}
        </div>
      )}
    </div>
  );
}
