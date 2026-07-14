'use client';

import { Sparkles } from 'lucide-react';
import type { Route } from '@/lib/navigation/types';

/**
 * RouteScoringExplain — breakdown visual de como o score foi calculado.
 * ----------------------------------------------------------------------------
 * Mostra as 4 componentes do score (Tempo, Trânsito, Cruzamentos, Complexidade)
 * em barras proporcionais para o usuário entender POR QUE uma rota foi
 * recomendada.
 */
export function RouteScoringExplain({ route }: { route: Route }) {
  const tempo = Math.round(route.duration);
  const transito = Math.round(route.trafficLevel * 6);
  const cruzamentos = Math.round(route.intersectionCount * 25);
  const complexidade = Math.round(route.roadComplexity * 4);
  const total = tempo + transito + cruzamentos + complexidade;
  const maxBar = Math.max(tempo, transito, cruzamentos, complexidade, 1);

  const rows = [
    { label: 'Tempo', value: tempo, color: 'bg-cyan-400' },
    { label: 'Trânsito', value: transito, color: 'bg-amber-400' },
    { label: 'Cruzamentos', value: cruzamentos, color: 'bg-purple-400' },
    { label: 'Complexidade', value: complexidade, color: 'bg-rose-400' },
  ];

  return (
    <div className="rounded-xl bg-secondary/30 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Como calculamos o score · total {total}
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
      <p className="mt-2 text-[10px] text-muted-foreground">
        Menor score = melhor rota. O score combina tempo, trânsito, cruzamentos e complexidade.
      </p>
    </div>
  );
}
