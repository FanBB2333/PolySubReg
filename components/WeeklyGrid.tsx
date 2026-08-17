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
// The full teaching day is always shown, morning to evening, so the shape of
// the week stays stable as courses come and go. PolyU classes run 08:30–21:20.
const DAY_START = 8 * 60; // 08:00
const DAY_END = 22 * 60; // 22:00
const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 26;

/** One rendered block: possibly several parallel sessions merged. */
interface DisplayEntry {
  course: SelectedCourse;
  day: number;
  startMin: number;
  endMin: number;
  /** `LEC001`, or `LAB ×4` when parallel sessions were merged. */
  component: string;
  time: string;
  venue: string;
  staff: string;
  tooltip: string;
}

interface PositionedEntry extends DisplayEntry {
  /** Column within an overlap cluster, so clashing blocks sit side by side. */
  col: number;
  cols: number;
}

/**
 * PolyU lists a group's parallel lab/tutorial streams as separate rows —
 * LAB001…LAB004, same time, different rooms. Drawn naively they stack into an
 * unreadable pile, so sessions of the same course sharing a time slot collapse
 * into one block that names the component family and counts the rooms.
 */
function mergeParallel(entries: GridEntry[]): DisplayEntry[] {
  const merged = new Map<string, { base: GridEntry; venues: string[]; components: string[] }>();
  for (const e of entries) {
    const family = e.session.componentCode.replace(/\d+$/, '');
    const key = [e.course.id, e.day, e.startMin, e.endMin, family].join('|');
    const bucket = merged.get(key);
    if (bucket) {
      if (e.session.venue) bucket.venues.push(e.session.venue);
      bucket.components.push(e.session.componentCode);
    } else {
      merged.set(key, {
        base: e,
        venues: e.session.venue ? [e.session.venue] : [],
        components: [e.session.componentCode],
      });
    }
  }

  return [...merged.values()].map(({ base, venues, components }) => {
    const many = components.length > 1;
    const family = base.session.componentCode.replace(/\d+$/, '');
    return {
      course: base.course,
      day: base.day,
      startMin: base.startMin,
      endMin: base.endMin,
      component: many ? `${family} ×${components.length}` : base.session.componentCode,
      time: `${base.session.startTime}–${base.session.endTime}`,
      venue: many ? `${venues[0] ?? ''} +${venues.length - 1}` : (venues[0] ?? ''),
      staff: base.session.teachingStaff,
      tooltip: [
        `${base.course.subjectCode} ${base.course.subjectTitle}`,
        `Group ${base.course.groupCode} · ${components.join(', ')}`,
        `${base.session.dayOfWeek} ${base.session.startTime}-${base.session.endTime}`,
        venues.length > 0 && `Venue: ${venues.join(', ')}`,
        base.session.teachingStaff && `Staff: ${base.session.teachingStaff}`,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  });
}

/**
 * Classic calendar column assignment: blocks that overlap in time share the
 * cell width side by side instead of painting over each other.
 */
function layoutDay(dayEntries: DisplayEntry[]): PositionedEntry[] {
  const sorted = [...dayEntries].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin,
  );
  const out: PositionedEntry[] = [];
  let cluster: { entry: DisplayEntry; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const { entry, col } of cluster) {
      out.push({ ...entry, col, cols: colEnds.length });
    }
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };

  for (const entry of sorted) {
    if (cluster.length > 0 && entry.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= entry.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(0);
    }
    colEnds[col] = entry.endMin;
    cluster.push({ entry, col });
    clusterEnd = Math.max(clusterEnd, entry.endMin);
  }
  flush();
  return out;
}

interface WeeklyGridProps {
  courses: SelectedCourse[];
  conflicts: Map<string, Set<string>>;
}

export function WeeklyGrid({ courses, conflicts }: WeeklyGridProps) {
  const positioned = useMemo(() => {
    const display = mergeParallel(buildGrid(courses));
    return Array.from({ length: DAY_COUNT }, (_, day) =>
      layoutDay(display.filter((e) => e.day === day)),
    ).flat();
  }, [courses]);

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

  // Widen beyond the standard day only if a session actually falls outside it.
  const { start, end } = useMemo(() => {
    let start = DAY_START;
    let end = DAY_END;
    for (const e of positioned) {
      start = Math.min(start, Math.floor(e.startMin / 60) * 60);
      end = Math.max(end, Math.ceil(e.endMin / 60) * 60);
    }
    return { start, end };
  }, [positioned]);

  const slots = (end - start) / SLOT_MINUTES;

  return (
    <div className="p-4 pt-2">
      <div
        className="grid gap-px overflow-hidden rounded-lg border border-border bg-border"
        style={{
          gridTemplateColumns: `52px repeat(${DAY_COUNT}, minmax(0, 1fr))`,
          gridTemplateRows: `${HEADER_HEIGHT}px repeat(${slots}, ${ROW_HEIGHT}px)`,
        }}
      >
        <div className="bg-muted/50" />
        {DAYS.slice(0, DAY_COUNT).map((day) => (
          <div
            key={day}
            className="flex items-center justify-center bg-muted/50 text-xs font-medium text-muted-foreground"
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
                'flex items-start justify-end bg-muted/30 pr-1.5 pt-0.5 text-[10px] text-muted-foreground',
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

        {positioned.map((entry, i) => (
          <Block
            key={`${entry.course.id}-${entry.component}-${entry.day}-${entry.startMin}-${i}`}
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
  entry: PositionedEntry;
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
        'overflow-hidden rounded border px-1.5 py-0.5 leading-tight',
        conflicted
          ? 'border-destructive/40 bg-destructive/20 text-destructive'
          : colorClass,
      )}
      style={{
        gridColumn: entry.day + 2,
        gridRow: `${rowStart} / span ${span}`,
        // Percentages resolve against the grid cell, so an overlap cluster of
        // n blocks splits the cell into n side-by-side columns.
        width: `calc(${100 / entry.cols}% - 2px)`,
        marginLeft: `calc(${(100 * entry.col) / entry.cols}% + 1px)`,
        marginTop: '1px',
        marginBottom: '1px',
      }}
      title={entry.tooltip}
    >
      <div className="truncate text-[11px] font-medium">
        {entry.course.subjectCode}
        <span className="ml-1 font-normal opacity-70">{entry.component}</span>
      </div>
      {span > 1 && (
        <div className="truncate text-[10px] opacity-80">
          {entry.time}
          {entry.venue && ` · ${entry.venue}`}
        </div>
      )}
      {span > 2 && entry.staff && (
        <div className="truncate text-[10px] opacity-70">{entry.staff}</div>
      )}
    </div>
  );
}
