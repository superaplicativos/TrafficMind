'use client';

import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import { STRATEGY_META } from '@/lib/navigation/types';
import type { RouteStrategy } from '@/lib/navigation/types';

const ALL_STRATEGIES: RouteStrategy[] = [
  'fastest',
  'shortest',
  'scenic',
  'least_turns',
  'experimental',
];

/**
 * StrategyFilter
 * ----------------------------------------------------------------------------
 * A small floating chip row (hidden on very small screens to avoid crowding
 * the search box) that lets the user toggle which routing strategies the
 * backend should compute. Hidden while no destination is set.
 */
export function StrategyFilter() {
  const enabled = useNavigationStore((s) => s.enabledStrategies);
  const toggle = useNavigationStore((s) => s.toggleStrategy);
  const hasDestination = useNavigationStore((s) => s.destination !== null);

  if (!hasDestination) return null;

  return (
    <div className="glass-panel pointer-events-auto absolute left-1/2 top-20 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-full p-1.5 shadow-xl scrollbar-thin sm:left-3 sm:translate-x-0">
      <Layers className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
      {ALL_STRATEGIES.map((s) => {
        const meta = STRATEGY_META[s];
        const active = enabled.includes(s);
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
              active
                ? 'bg-secondary/80 text-foreground'
                : 'text-muted-foreground hover:bg-secondary/40',
            )}
            title={meta.description}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: meta.color, opacity: active ? 1 : 0.4 }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
