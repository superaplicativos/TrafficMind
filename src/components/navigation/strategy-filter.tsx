'use client';

import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import type { RouteStrategy } from '@/lib/navigation/types';

const ALL_STRATEGIES: RouteStrategy[] = [
  'fastest',
  'shortest',
  'scenic',
  'least_turns',
  'experimental',
];

const STRATEGY_LABELS_PT: Record<RouteStrategy, string> = {
  fastest: 'Mais rápida',
  shortest: 'Mais curta',
  scenic: 'Cênica',
  least_turns: 'Menos curvas',
  experimental: 'IA experimental',
};

const STRATEGY_COLORS: Record<RouteStrategy, string> = {
  fastest: '#06b6d4',
  shortest: '#10b981',
  scenic: '#f59e0b',
  least_turns: '#a855f7',
  experimental: '#ef4444',
};

/**
 * StrategyFilter — chips para escolher quais estratégias calcular.
 * ----------------------------------------------------------------------------
 * Só aparece depois que o destino é definido.
 */
export function StrategyFilter() {
  const enabled = useNavigationStore((s) => s.enabledStrategies);
  const toggle = useNavigationStore((s) => s.toggleStrategy);
  const hasDestination = useNavigationStore((s) => s.destination !== null);

  if (!hasDestination) return null;

  return (
    <div className="glass-panel pointer-events-auto absolute left-1/2 top-44 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-full p-1.5 shadow-xl scrollbar-thin sm:left-3 sm:translate-x-0">
      <Layers className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
      {ALL_STRATEGIES.map((s) => {
        const active = enabled.includes(s);
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
              active
                ? 'bg-secondary/80 text-foreground'
                : 'text-muted-foreground hover:bg-secondary/40',
            )}
            title={`Alternar estratégia: ${STRATEGY_LABELS_PT[s]}`}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: STRATEGY_COLORS[s], opacity: active ? 1 : 0.4 }}
            />
            {STRATEGY_LABELS_PT[s]}
          </button>
        );
      })}
    </div>
  );
}
