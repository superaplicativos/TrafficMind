'use client';

import { Sparkles } from 'lucide-react';
import type { Route } from '@/lib/navigation/types';

/**
 * RouteScoringExplain
 * ----------------------------------------------------------------------------
 * Visual breakdown of how the selected route's composite score was computed.
 * This is the user-facing "explainability" surface that turns the black-box
 * RouteScore into four labelled bars so users can see WHY a route is
 * recommended — the same idea Google Maps' "fastest / 5 min slower" labels
 * use, but for our richer score.
 *
 * The weights mirror the backend RouteScoringService defaults so the bars are
 * proportional to the actual score contribution.
 */
export function RouteScoringExplain({ route }: { route: Route }) {
  const eta = Math.round(route.duration);              // 1s = 1pt
  const traffic = Math.round(route.trafficLevel * 6);  // 1pt × 6
  const intersections = Math.round(route.intersectionCount * 25);
  const complexity = Math.round(route.roadComplexity * 4);
  const total = eta + traffic + intersections + complexity;
  const maxBar = Math.max(eta, traffic, intersections, complexity, 1);

  const rows = [
    { label: 'ETA', value: eta, color: 'bg-cyan-400' },
    { label: 'Traffic', value: traffic, color: 'bg-amber-400' },
    { label: 'Intersections', value: intersections, color: 'bg-purple-400' },
    { label: 'Road complexity', value: complexity, color: 'bg-rose-400' },
  ];

  return (
    <div className="rounded-xl bg-secondary/30 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Score breakdown · total {total}
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{r.label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary/80">
              <div
                className={r.color}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${(r.value / maxBar) * 100}%`,
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-foreground">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
