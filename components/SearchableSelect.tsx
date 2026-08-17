import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Matches the width the original `<select>` occupied, so layout is stable. */
  width?: number;
  disabled?: boolean;
}

const LIST_MAX_HEIGHT = 320;
const MIN_DROPDOWN_WIDTH = 256;

/**
 * Drop-in replacement for the PolyU search form's `<select>` elements.
 *
 * The dropdown list is promoted to the browser's top layer with the native
 * Popover API rather than positioned with z-index: the component sits inside a
 * table deep in the PolyU page, whose own stacking contexts paint over any
 * z-index we could pick, and the top layer is above all of them by definition.
 * The element itself stays inside our shadow root, so Tailwind styles apply and
 * React portals (which would escape the shadow root) are never needed.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '-- Please Select --',
  width,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  // Show the popover and pin it to the trigger. Runs before paint so the list
  // never flashes at the wrong position.
  useLayoutEffect(() => {
    if (!open) return;
    const pop = popRef.current;
    const trigger = rootRef.current;
    if (!pop || !trigger) return;

    try {
      pop.showPopover();
    } catch {
      // Already showing, or an ancient browser without the Popover API — the
      // element still renders, just without top-layer promotion.
    }

    const rect = trigger.getBoundingClientRect();
    const popWidth = Math.max(rect.width, MIN_DROPDOWN_WIDTH);
    const left = Math.min(
      Math.max(4, rect.left),
      window.innerWidth - popWidth - 4,
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < LIST_MAX_HEIGHT && rect.top > spaceBelow;

    pop.style.inset = 'auto';
    pop.style.left = `${left}px`;
    pop.style.width = `${popWidth}px`;
    if (openUp) {
      pop.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      pop.style.top = `${rect.bottom + 4}px`;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      // This component lives in a shadow root, so by the time the event reaches
      // `document` its `target` has been retargeted to the shadow host — which
      // is never a descendant of `rootRef`. The composed path still holds the
      // true originating node.
      const root = rootRef.current;
      if (root && !e.composedPath().includes(root)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // The top-layer popover is pinned to viewport coordinates and would drift
    // away from its trigger when the page scrolls or resizes — close instead.
    // Scrolls that start inside the option list itself must not count.
    const onScroll = (e: Event) => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="psr-select relative inline-block align-middle text-sm"
      style={{ width: width ? `${width}px` : '100%' }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-card px-2.5 py-1',
          'text-left text-foreground transition-colors hover:bg-muted/50',
          'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn('truncate', !selected && 'text-muted-foreground')}
          title={selected?.label}
        >
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {selected && selected.value !== '' && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                select('');
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </span>
          )}
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div
          ref={popRef}
          popover="manual"
          className="fixed m-0 overflow-hidden rounded-md border border-border bg-popover p-0 text-sm text-popover-foreground shadow-lg"
        >
          <Command
            // The options are already a curated list; keep PolyU's own ordering
            // instead of re-ranking by fuzzy score.
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Type to filter…" className="h-9" />
            <CommandList className="max-h-72">
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => select(option.value)}
                    className="text-xs"
                  >
                    <Check
                      className={cn(
                        'size-3.5 shrink-0',
                        option.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
