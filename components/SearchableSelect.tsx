import { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Drop-in replacement for the PolyU search form's `<select>` elements.
 *
 * The dropdown is rendered inline rather than through a portal: the whole
 * component lives inside a shadow root, and a portal would escape it and lose
 * every Tailwind style.
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
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      // This component lives in a shadow root, so by the time the event reaches
      // `document` its `target` has been retargeted to the shadow host — which
      // is never a descendant of `rootRef`. Checking `contains(e.target)` here
      // would close the dropdown on every click, including clicks on our own
      // options. The composed path still holds the true originating node.
      const root = rootRef.current;
      if (root && !e.composedPath().includes(root)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open && rootRef.current) {
      // Long department lists would otherwise run off the bottom of the page.
      const rect = rootRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 320 && rect.top > 320);
    }
    setOpen((o) => !o);
  };

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
        onClick={toggle}
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
          className={cn(
            'absolute z-[2147483000] w-full min-w-64 rounded-md border border-border bg-popover shadow-lg',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
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
