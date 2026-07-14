'use client';

import { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Navigation,
  Gauge,
  Fuel,
  GitBranch,
  Activity,
  Layers,
  Loader2,
  MapPin,
  Crosshair,
  Sparkles,
  Clock,
  Route as RouteIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import { STRATEGY_META } from '@/lib/navigation/types';
import type { Route } from '@/lib/navigation/types';
import { RouteScoringExplain } from './route-score-explain';

type SheetState = 'collapsed' | 'half' | 'full';

interface RouteSheetProps {
  locating: boolean;
  onLocateMe: () => void;
  onUseMapCenterAsOrigin: () => void;
}

/**
 * RouteSheet — painel inferior (bottom sheet).
 * ----------------------------------------------------------------------------
 * Mostra orientações contextuais em português simples:
 *
 *   1. Sem destino: "Para onde vamos?" + dica de busca
 *   2. Com destino, sem origem: "De onde você sai?" + 2 botões grandes
 *   3. Com origem e destino, calculando: "Calculando suas rotas…"
 *   4. Rotas prontas: lista de alternativas + estatísticas + breakdown do score
 *
 * Sem jargão. Botões grandes com texto. Indicador visual de progresso.
 */
export function RouteSheet({ locating, onLocateMe, onUseMapCenterAsOrigin }: RouteSheetProps) {
  const [state, setState] = useState<SheetState>('collapsed');
  const routes = useNavigationStore((s) => s.routes);
  const destination = useNavigationStore((s) => s.destination);
  const destinationLabel = useNavigationStore((s) => s.destinationLabel);
  const origin = useNavigationStore((s) => s.origin);
  const selectedId = useNavigationStore((s) => s.selectedRouteId);
  const select = useNavigationStore((s) => s.selectRoute);

  // ---- Passo 1: sem destino ----
  if (!destination) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-panel-strong mx-auto max-w-md rounded-2xl p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <span className="text-lg font-bold text-primary">1</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">Para onde vamos?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Digite o endereço ou nome do lugar na busca acima. Exemplo: "Aeroporto de Congonhas".
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Passo 2: destino definido, sem origem ----
  if (!origin) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-panel-strong mx-auto max-w-md rounded-2xl p-5 shadow-2xl">
          {/* Resumo do destino */}
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-secondary/40 p-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Destino</div>
              <div className="truncate text-sm font-medium text-foreground">
                {destinationLabel || 'Pino no mapa'}
              </div>
            </div>
          </div>

          {/* Pergunta + CTAs */}
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <span className="text-lg font-bold text-primary">2</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">De onde você sai?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Precisamos do seu ponto de partida para calcular as rotas.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Button
              onClick={onLocateMe}
              disabled={locating}
              className="h-14 w-full gap-3 rounded-xl bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
            >
              {locating ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Crosshair className="size-5" />
              )}
              {locating ? 'Localizando…' : 'Usar minha localização atual'}
            </Button>
            <Button
              onClick={onUseMapCenterAsOrigin}
              variant="secondary"
              className="h-14 w-full gap-3 rounded-xl text-base font-medium"
            >
              <MapPin className="size-5" />
              Usar o centro do mapa como partida
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            💡 Dica: arraste o mapa para posicionar e depois toque no botão acima.
          </p>
        </div>
      </div>
    );
  }

  // ---- Calculando rotas ----
  if (routes.length === 0) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="glass-panel-strong mx-auto max-w-md rounded-2xl p-5 shadow-2xl">
          <div className="flex flex-col items-center gap-3 py-2">
            <Loader2 className="size-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">Calculando suas rotas…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Buscando 5 alternativas e ranqueando por melhor score.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Rotas prontas ----
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
          state === 'collapsed' && 'max-h-40',
          state === 'half' && 'max-h-[65vh]',
          state === 'full' && 'max-h-[88vh]',
        )}
      >
        <button
          onClick={cycle}
          className="flex w-full items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground"
          aria-label={state === 'collapsed' ? 'Expandir painel' : 'Recolher painel'}
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
        className="flex size-12 shrink-0 items-center justify-center rounded-full"
        style={{ background: meta.color, boxShadow: `0 0 14px ${meta.color}88` }}
      >
        <Navigation className="size-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground">
            {Math.round(route.duration / 60)} min
          </span>
          <span className="text-sm text-muted-foreground">
            · {(route.distance / 1000).toFixed(1)} km
          </span>
          {route.isRecommended && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              ★ Recomendada
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{route.label}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</div>
        <div className="text-base font-mono font-bold text-foreground">{route.score}</div>
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
          {routes.length} rotas alternativas — toque para escolher
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
                'relative flex min-w-[130px] shrink-0 flex-col gap-1 rounded-xl border p-3 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border/60 bg-secondary/40 hover:bg-secondary/60',
              )}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="size-2.5 rounded-full"
                  style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                />
                <span className="text-xs font-medium text-foreground">{strategyLabel(r.strategy)}</span>
              </div>
              <div className="text-base font-bold text-foreground">
                {Math.round(r.duration / 60)} min
              </div>
              <div className="text-[11px] text-muted-foreground">
                {(r.distance / 1000).toFixed(1)} km · score {r.score}
              </div>
              {r.isRecommended && (
                <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                  ★
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
    { icon: RouteIcon, label: 'Distância', value: `${(route.distance / 1000).toFixed(1)} km`, color: 'text-primary' },
    { icon: Clock, label: 'Tempo', value: `${Math.round(route.duration / 60)} min`, color: 'text-primary' },
    { icon: Activity, label: 'Trânsito', value: `${route.trafficLevel}/100`, color: trafficTextColor(route.trafficLevel) },
    { icon: GitBranch, label: 'Cruzamentos', value: `${route.intersectionCount}`, color: 'text-foreground' },
    { icon: Fuel, label: 'Combustível', value: `${route.estimatedFuel.toFixed(1)} L`, color: 'text-foreground' },
    { icon: Activity, label: 'Complexidade', value: `${route.roadComplexity}/100`, color: complexityTextColor(route.roadComplexity) },
  ];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Gauge className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Estatísticas da rota selecionada
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-secondary/40 p-2.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <s.icon className="size-3" />
              <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
            </div>
            <div className={cn('mt-1 text-sm font-bold', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>
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

function strategyLabel(strategy: Route['strategy']): string {
  const map: Record<Route['strategy'], string> = {
    fastest: 'Mais rápida',
    shortest: 'Mais curta',
    scenic: 'Cênica',
    least_turns: 'Menos curvas',
    experimental: 'IA experimental',
  };
  return map[strategy];
}
