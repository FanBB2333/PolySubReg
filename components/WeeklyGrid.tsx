import { useMemo } from 'react';
import { buildGrid, DAYS, type GridEntry } from '@/lib/polyu/timetable';
import type { SelectedCourse } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Morandi tints, cycled per subject so each subject keeps one colour. */
const COURSE_COLORS: readonly string[] = [
  'bg-[#8B9A7D]/20 border-[#8B9A7D]/40 text-[#5C6B50]',
  'bg-[#B5A99A]/20 border-[#B5A99A]/40 text-[#7A6F62]',
  'bg-[#C9B8A1]/20 border-[#C9B8A1]/40 text-[#8A7A5E]',
  'bg-[#A4B8C4]/20 border-[#A4B8C4]/40 text-[#5E7180]',
  'bg-[#C4A4A4]/20 border-[#C4A4A4]/40 text-[#8A6666]',
  'bg-[#B8C4A4]/20 border-[#B8C4A4]/40 text-[#6E7A58]',
  'bg-[#C4B8D4]/20 border-[#C4B8D4]/40 text-[#7A6E8A]',
  'bg-[#D4C4B8]/20 border-[#D4C4B8]/40 text-[#8A7A6E]',
];

function colorAt(index: number): string {
  return COURSE_COLORS[index % COURSE_COLORS.length]!;
}

const DAY_COUNT = 6; // Mon–Sat; PolyU does not timetable Sundays.
const SLOT_MINUTES = 30;
const GRID_START = 8 * 60; // 08:00
const GRID_END = 22 * 60; // 22:00
const ROW_HEIGHT = 22;

interface WeeklyGridProps {
  courses: SelectedCourse[];
  conflicts: Map<string, Set<string>>;
}

export function WeeklyGrid({ courses, conflicts }: WeeklyGridProps) {
  const entries = useMemo(() => buildGrid(courses), [courses]);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const course of courses) {
      if (!map.has(course.subjectCode)) {
        map.set(course.subjectCode, colorAt(i));
        i++;
      }
    }
    return map;
  }, [courses]);

  const { start, end } = useMemo(() => {
    if (entries.length === 0) return { start: 8 * 60, end: 19 * 60 };
    // Crop the grid to the hours actually in use, padded by half an hour.
    const min = Math.min(...entries.map((e) => e.startMin)) - SLOT_MINUTES;
    const max = Math.max(...entries.map((e) => e.endMin)) + SLOT_MINUTES;
    return {
      start: Math.max(GRID_START, Math.floor(min / 60) * 60),
      end: Math.min(GRID_END, Math.ceil(max / 60) * 60),
    };
  }, [entries]);

  const slots = Math.max(1, (end - start) / SLOT_MINUTES);

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="text-sm">Nothing to show on the timetable</p>
        <p className="mt-1 text-xs">
          Add a subject group with published class times
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div
        className="grid gap-px overflow-hidden rounded-lg border border-border bg-border"
        style={{
          gridTemplateColumns: `42px repeat(${DAY_COUNT}, minmax(0, 1fr))`,
          gridTemplateRows: `20px repeat(${slots}, ${ROW_HEIGHT}px)`,
        }}
      >
        <div className="bg-muted/50" />
        {DAYS.slice(0, DAY_COUNT).map((day) => (
          <div
            key={day}
            className="flex items-center justify-center bg-muted/50 text-[10px] font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {Array.from({ length: slots }, (_, i) => {
          const minute = start + i * SLOT_MINUTES;
          const onTheHour = minute % 60 === 0;
          return (
            <div
              key={`gutter-${minute}`}
              className={cn(
                'flex items-start justify-end bg-muted/30 pr-1 text-[9px] text-muted-foreground',
                !onTheHour && 'text-transparent',
              )}
              style={{ gridColumn: 1, gridRow: i + 2 }}
            >
              {onTheHour ? `${String(minute / 60).padStart(2, '0')}:00` : '·'}
            </div>
          );
        })}

        {/* Empty cells first so entries paint on top of them. */}
        {Array.from({ length: slots }, (_, i) =>
          Array.from({ length: DAY_COUNT }, (_, d) => (
            <div
              key={`cell-${i}-${d}`}
              className="bg-card"
              style={{ gridColumn: d + 2, gridRow: i + 2 }}
            />
          )),
        )}

        {entries
          .filter((e) => e.day < DAY_COUNT)
          .map((entry, i) => (
            <Block
              key={`${entry.course.id}-${entry.session.componentCode}-${entry.day}-${entry.startMin}-${i}`}
              entry={entry}
              gridStart={start}
              conflicted={(conflicts.get(entry.course.id)?.size ?? 0) > 0}
              colorClass={colorOf.get(entry.course.subjectCode) ?? colorAt(0)}
            />
          ))}
      </div>
    </div>
  );
}

interface BlockProps {
  entry: GridEntry;
  gridStart: number;
  conflicted: boolean;
  colorClass: string;
}

function Block({ entry, gridStart, conflicted, colorClass }: BlockProps) {
  const rowStart = Math.round((entry.startMin - gridStart) / SLOT_MINUTES) + 2;
  const span = Math.max(
    1,
    Math.round((entry.endMin - entry.startMin) / SLOT_MINUTES),
  );

  return (
    <div
      className={cn(
        'm-px overflow-hidden rounded border px-1 py-px text-[9px] leading-tight',
        conflicted
          ? 'border-destructive/40 bg-destructive/20 text-destructive'
          : colorClass,
      )}
      style={{
        gridColumn: entry.day + 2,
        gridRow: `${rowStart} / span ${span}`,
      }}
      title={[
        `${entry.course.subjectCode} ${entry.course.subjectTitle}`,
        `Group ${entry.course.groupCode} · ${entry.session.componentCode}`,
        `${entry.session.dayOfWeek} ${entry.session.startTime}-${entry.session.endTime}`,
        entry.session.venue && `Venue: ${entry.session.venue}`,
        entry.session.teachingStaff && `Staff: ${entry.session.teachingStaff}`,
      ]
        .filter(Boolean)
        .join('\n')}
    >
      <div className="truncate font-medium">{entry.course.subjectCode}</div>
      {span > 1 && (
        <div className="truncate opacity-80">{entry.session.venue}</div>
      )}
    </div>
  );
}
