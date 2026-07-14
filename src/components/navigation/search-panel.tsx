'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Loader2, Crosshair } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDebouncedGeocode } from '@/hooks/navigation/use-debounced-geocode';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import { toast } from 'sonner';
import type { GeocodingResult } from '@/lib/navigation/types';

interface SearchPanelProps {
  onLocateMe: () => void;
  locating: boolean;
}

/**
 * SearchPanel
 * ----------------------------------------------------------------------------
 * Floating top panel with:
 *   - destination search (debounced Nominatim)
 *   - "locate me" button (triggers GPS permission prompt)
 *   - dropdown of geocoding candidates
 *
 * Selecting a candidate pushes the destination into the navigation store;
 * the parent effect then triggers route calculation.
 */
export function SearchPanel({ onLocateMe, locating }: SearchPanelProps) {
  const { query, setQuery, results, isFetching, clear } = useDebouncedGeocode();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setDestination = useNavigationStore((s) => s.setDestination);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (r: GeocodingResult) => {
    setDestination(r.coordinate, r.label);
    setOpen(false);
    clear();
    toast.success(`Destination set: ${r.label}`);
  };

  return (
    <div
      ref={containerRef}
      className="glass-panel-strong pointer-events-auto absolute left-1/2 top-3 z-30 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl p-2 shadow-2xl sm:left-3 sm:translate-x-0"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Where to?"
            className="h-11 rounded-xl border-transparent bg-secondary/60 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Destination search"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => {
                clear();
                setOpen(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl bg-secondary/60 hover:bg-secondary"
          onClick={onLocateMe}
          disabled={locating}
          aria-label="Locate me"
          title="Use my location"
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
        </Button>
      </div>

      {/* Dropdown */}
      {open && (results.length > 0 || isFetching) && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-popover/95 backdrop-blur scrollbar-thin">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Searching…</span>
            </div>
          )}
          {!isFetching &&
            results.map((r) => (
              <button
                key={r.osmId ?? r.label}
                onClick={() => pick(r)}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                  'hover:bg-secondary/60 focus:bg-secondary/60 focus:outline-none',
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{r.label}</div>
                  {r.secondary && (
                    <div className="truncate text-xs text-muted-foreground">{r.secondary}</div>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
