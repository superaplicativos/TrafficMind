'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Navigation, Gauge, Fuel, GitBranch, Activity, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import { STRATEGY_META } from '@/lib/navigation/types';
import type { Route } from '@/lib/navigation/types';
import { RouteScoringExplain } from './route-score-explain';

type SheetState = 'collapsed' | 'half' | 'full';

/**
 * RouteSheet
 * ----------------------------------------------------------------------------
 * The mobile-first bottom sheet that hosts:
 *   - the recommended-route CTA (collapsed)
 *   - the list of alternative routes (half)
 *   - the full statistics breakdown + score explanation (full)
 *
 * On desktop the same content is rendered as a side panel (parent decides);
 * here we always render the mobile-style sheet and let CSS handle the layout.
 */
export function RouteSheet() {
  const [state, setState] = useState<SheetState>('collapsed');
  const routes = useNavigationStore((s) => s.routes);
  const selectedId = useNavigationStore((s) => s.selectedRouteId);
  const select = useNavigationStore((s) => s.selectRoute);

  // No routes → render a friendly hint.
  if (routes.length === 0) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-panel-strong mx-auto max-w-md rounded-2xl p-4 text-center shadow-2xl">
          <Navigation className="mx-auto size-6 text-primary" />
          <p className="mt-2 text-sm font-medium text-foreground">No routes yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search a destination or long-press the map to drop a pin.
          </p>
        </div>
      </div>
    );
  }

  const selected = routes.find((r) => r.id === selectedId) ?? routes[0];
  const recommended = routes.find((r) => r.isRecommended) ?? routes[0];

  const cycle = () => {
    setState((s) => (s === 'collapsed' ? 'half' : s === 'half' ? 'full' : 'collapsed'));
  };

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div
        className={cn(
          'glass-panel-strong mx-auto max-w-md overflow-hidden rounded-2xl shadow-2xl transition-[max-height] duration-300 ease-out',
          state === 'collapsed' && 'max-h-32',
          state === 'half' && 'max-h-[60vh]',
          state === 'full' && 'max-h-[85vh]',
        )}
      >
        {/* Grabber + collapse/expand */}
        <button
          onClick={cycle}
          className="flex w-full items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground"
          aria-label={state === 'collapsed' ? 'Expand route panel' : 'Collapse route panel'}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/40" />
          {state === 'collapsed' ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        <div className="px-3 pb-3">
          {/* Collapsed: just the recommended CTA */}
          <CollapsedSummary route={recommended} onClick={cycle} />

          {state !== 'collapsed' && (
            <>
              <RouteList
                routes={routes}
                selectedId={selected.id}
                onSelect={(id) => select(id)}
              />
              <Separator />
              <StatsGrid route={selected} />
              <Separator />
              <RouteScoringExplain route={selected} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CollapsedSummary({ route, onClick }: { route: Route; onClick: () => void }) {
  const meta = STRATEGY_META[route.strategy];
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl bg-secondary/40 p-3 text-left hover:bg-secondary/60"
    >
      <div
        className="size-10 shrink-0 rounded-full"
        style={{ background: meta.color, boxShadow: `0 0 12px ${meta.color}88` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">
            {Math.round(route.duration / 60)} min
          </span>
          <span className="text-sm text-muted-foreground">
            · {(route.distance / 1000).toFixed(1)} km
          </span>
          {route.isRecommended && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Recommended
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{route.label}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Score</div>
        <div className="text-sm font-mono font-semibold text-foreground">{route.score}</div>
      </div>
    </button>
  );
}

function RouteList({
  routes,
  selectedId,
  onSelect,
}: {
  routes: Route[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Layers className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {routes.length} alternative routes
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {routes.map((r) => {
          const meta = STRATEGY_META[r.strategy];
          const isSelected = r.id === selectedId;
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={cn(
                'relative flex min-w-[120px] shrink-0 flex-col gap-1 rounded-xl border p-2.5 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border/60 bg-secondary/40 hover:bg-secondary/60',
              )}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="size-2.5 rounded-full"
                  style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                />
                <span className="text-xs font-medium text-foreground">{meta.label}</span>
              </div>
              <div className="text-sm font-semibold text-foreground">
                {Math.round(r.duration / 60)} min
              </div>
              <div className="text-[11px] text-muted-foreground">
                {(r.distance / 1000).toFixed(1)} km · score {r.score}
              </div>
              {r.isRecommended && (
                <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                  Rec
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Separator() {
  return <div className="my-3 h-px bg-border/60" />;
}

function StatsGrid({ route }: { route: Route }) {
  const stats = [
    { icon: Navigation, label: 'Distance', value: `${(route.distance / 1000).toFixed(1)} km`, color: 'text-primary' },
    { icon: Gauge, label: 'ETA', value: `${Math.round(route.duration / 60)} min`, color: 'text-primary' },
    { icon: Activity, label: 'Traffic', value: `${route.trafficLevel}/100`, color: trafficTextColor(route.trafficLevel) },
    { icon: GitBranch, label: 'Intersections', value: `${route.intersectionCount}`, color: 'text-foreground' },
    { icon: Fuel, label: 'Fuel est.', value: `${route.estimatedFuel.toFixed(1)} L`, color: 'text-foreground' },
    { icon: Activity, label: 'Complexity', value: `${route.roadComplexity}/100`, color: complexityTextColor(route.roadComplexity) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl bg-secondary/40 p-2.5">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <s.icon className="size-3" />
            <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
          </div>
          <div className={cn('mt-1 text-sm font-semibold', s.color)}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function trafficTextColor(level: number) {
  if (level < 30) return 'text-emerald-400';
  if (level < 55) return 'text-amber-400';
  if (level < 75) return 'text-orange-400';
  return 'text-red-400';
}
function complexityTextColor(level: number) {
  if (level < 40) return 'text-emerald-400';
  if (level < 65) return 'text-amber-400';
  return 'text-red-400';
}
