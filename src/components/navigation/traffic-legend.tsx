'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrafficReading } from '@/lib/navigation/types';

interface TrafficLegendProps {
  readings: TrafficReading[];
}

/**
 * TrafficLegend — lista colapsável do trânsito ao vivo (desktop apenas).
 * ----------------------------------------------------------------------------
 * Mostra as vias monitoradas com seus níveis de congestionamento.
 */
export function TrafficLegend({ readings }: TrafficLegendProps) {
  const [open, setOpen] = useState(false);
  if (!readings.length) return null;

  const sorted = [...readings].sort((a, b) => b.level - a.level);

  return (
    <div className="glass-panel pointer-events-auto absolute bottom-24 left-3 z-20 hidden w-64 rounded-xl shadow-xl md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Trânsito agora · {readings.length} vias
          </span>
        </div>
        {open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronUp className="size-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="max-h-72 overflow-y-auto border-t border-border/60 scrollbar-thin">
          {sorted.map((r) => (
            <div key={r.roadId} className="flex items-center gap-2 px-3 py-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: colorFor(r.level), boxShadow: `0 0 6px ${colorFor(r.level)}` }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">{r.roadName}</span>
              <span className={cn('shrink-0 font-mono', textColorFor(r.level))}>{r.level}</span>
              <span className="shrink-0 text-muted-foreground">{r.currentSpeed} km/h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function colorFor(level: number): string {
  if (level < 30) return '#10b981';
  if (level < 55) return '#f59e0b';
  if (level < 75) return '#f97316';
  return '#ef4444';
}
function textColorFor(level: number): string {
  if (level < 30) return 'text-emerald-400';
  if (level < 55) return 'text-amber-400';
  if (level < 75) return 'text-orange-400';
  return 'text-red-400';
}
