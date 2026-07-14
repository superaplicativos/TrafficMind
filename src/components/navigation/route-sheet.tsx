'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Navigation, Gauge, Fuel, GitBranch, Activity, Layers, Crosshair, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import { STRATEGY_META } from '@/lib/navigation/types';
import type { Route } from '@/lib/navigation/types';
import { RouteScoringExplain } from './route-score-explain';

type SheetState = 'collapsed' | 'half' | 'full';

interface RouteSheetProps {
  /** True while GPS permission is being requested / position is being acquired. */
  locating: boolean;
  /** Called when the user asks the app to set the origin from GPS. */
  onLocateMe: () => void;
  /** Called when the user wants to use the current map center as origin (fallback). */
  onUseMapCenterAsOrigin: () => void;
}

/**
 * RouteSheet
 * ----------------------------------------------------------------------------
 * The mobile-first bottom sheet that hosts:
 *   - the recommended-route CTA (collapsed)
 *   - the list of alternative routes (half)
 *   - the full statistics breakdown + score explanation (full)
 *
 * Empty states are context-aware:
 *   - no destination      → "Search a destination or long-press the map"
 *   - destination, no origin → "Set your starting point" with two CTAs
 *   - both set, calculating  → handled by the parent's overlay
 *   - both set, error        → show error + retry hint
 */
export function RouteSheet({ locating, onLocateMe, onUseMapCenterAsOrigin }: RouteSheetProps) {
  const [state, setState] = useState<SheetState>('collapsed');
  const routes = useNavigationStore((s) => s.routes);
  const destination = useNavigationStore((s) => s.destination);
  const origin = useNavigationStore((s) => s.origin);
  const selectedId = useNavigationStore((s) => s.selectedRouteId);
  const select = useNavigationStore((s) => s.selectRoute);

  // ---- Empty state: no destination yet ----
  if (!destination) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-panel-strong mx-auto max-w-md rounded-2xl p-4 text-center shadow-2xl">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/15">
            <Navigation className="size-5 text-primary" />
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">Where are you going?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search a destination above, or long-press the map to drop a pin.
          </p>
        </div>
      </div>
    );
  }

  // ---- Empty state: destination set but no origin ----
  if (!origin) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-panel-strong mx-auto max-w-md rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Crosshair className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Set your starting point</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Destination set. Now we need your location to calculate routes.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={onLocateMe}
              disabled={locating}
              className="h-10 flex-1 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
              {locating ? 'Locating…' : 'Use my GPS'}
            </Button>
            <Button
              onClick={onUseMapCenterAsOrigin}
              variant="secondary"
              className="h-10 flex-1 gap-2 rounded-xl"
            >
              <MapPin className="size-4" />
              Use map center
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Empty state: origin + destination set but no routes came back ----
  if (routes.length === 0) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-panel-strong mx-auto max-w-md rounded-2xl p-4 text-center shadow-2xl">
          <Loader2 className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-2 text-sm font-medium text-foreground">Calculating routes…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Contacting routing engine for 5 alternatives.
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
        <button
          onClick={cycle}
          className="flex w-full items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground"
          aria-label={state === 'collapsed' ? 'Expand route panel' : 'Collapse route panel'}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/40" />
          {state === 'collapsed' ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        <div className="px-3 pb-3">
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
