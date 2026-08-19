import { Check, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/hooks/useCart';
import { staffOf } from '@/lib/polyu/timetable';
import {
  courseId,
  type Subject,
  type SubjectGroup,
  type SubjectGroupDetail,
} from '@/lib/types';
import { cn } from '@/lib/utils';

/** State of the second request, the one that carries vacancies. */
export type DetailStatus = 'loading' | 'ready' | 'failed';

interface SubjectGroupsProps {
  subject: Subject;
  loading: boolean;
  error?: string;
  details?: DetailStatus;
}

/**
 * The panel injected under a search result row: one card per subject group,
 * headlined by the teaching staff so the user can compare lecturers at a glance.
 */
export function SubjectGroups({
  subject,
  loading,
  error,
  details = 'ready',
}: SubjectGroupsProps) {
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
      {details === 'failed' && (
        <p className="text-xs text-muted-foreground">
          Vacancies and eligibility are unavailable — the subject details page
          did not answer.
        </p>
      )}
      {subject.groups.map((group) => (
        <GroupCard
          key={group.groupCode}
          group={group}
          details={details}
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
  details: DetailStatus;
  selected: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

function GroupCard({
  group,
  details,
  selected,
  onAdd,
  onRemove,
}: GroupCardProps) {
  const staff = staffOf(group.sessions);
  const detail = group.detail;

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
          {detail ? (
            <VacancyBadge detail={detail} />
          ) : (
            details === 'loading' && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> vacancies…
              </span>
            )
          )}
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

      {detail && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <Fact label="Group type" value={detail.groupType} />
          <Fact label="Size" value={detail.groupSize} />
          <Fact label="Waitlist" value={detail.waitlistAvailable} />
          {detail.topUp !== null && (
            <Fact label="Top-up next round" value={String(detail.topUp)} />
          )}
          {detail.eligibleProgrammes.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              Open to
              {detail.eligibleProgrammes.map((code) => (
                <code
                  key={code}
                  className="rounded bg-background px-1 py-px font-mono text-foreground"
                >
                  {code}
                </code>
              ))}
            </span>
          )}
        </div>
      )}

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

      {/* An unrecognised vacancies cell still gets shown, just not as a badge. */}
      {detail?.vacancies && detail.seats === null && detail.waiting === null && (
        <div className="border-t border-border/50 px-3 py-1.5 text-[11px] text-muted-foreground">
          Vacancies: {detail.vacancies}
        </div>
      )}

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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} <span className="font-medium text-foreground">{value || '—'}</span>
    </span>
  );
}

/**
 * Seats left, or how long the queue is once the group is full. PolyU prints
 * both in one cell, so the numbers get pulled apart at parse time.
 */
function VacancyBadge({ detail }: { detail: SubjectGroupDetail }) {
  const { seats, waiting } = detail;

  if (seats === null && waiting === null) return null;

  if (seats !== null && seats > 0) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        {seats} seat{seats === 1 ? '' : 's'} left
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      Full{waiting !== null && ` · ${waiting} waiting`}
    </Badge>
  );
}
