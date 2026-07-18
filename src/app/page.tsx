'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { NavigationMap, getMapBounds, type MaplibreMap } from '@/components/navigation/navigation-map';
import { SearchPanel } from '@/components/navigation/search-panel';
import { StrategyFilter } from '@/components/navigation/strategy-filter';
import { RouteSheet } from '@/components/navigation/route-sheet';
import { BrandMark } from '@/components/navigation/brand-mark';
import { TrafficLegend } from '@/components/navigation/traffic-legend';
import { useGeolocation } from '@/hooks/navigation/use-geolocation';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import { useCalculateRoutes } from '@/hooks/navigation/use-calculate-routes';
import { useQuery } from '@tanstack/react-query';
import { fetchTraffic, reverseGeocode } from '@/lib/navigation/api';
import type { GeoBounds, TrafficReading } from '@/lib/navigation/types';

/**
 * Página principal — TrafficMind.
 * ----------------------------------------------------------------------------
 * Fluxo guiado em 3 passos (em português):
 *
 *   Passo 1: usuário busca um destino → dropdown → escolhe um.
 *   Passo 2: app pede localização automaticamente. Se negada, mostra
 *            "De onde você sai?" com 2 botões grandes.
 *   Passo 3: rotas calculadas → painel mostra rota recomendada + alternativas.
 *
 * OTIMIZAÇÕES ANTI-LOOP (críticas após integração TomTom):
 *  - GPS só atualiza origin se mover > 30m (evita recalcular rotas a cada
 *    sub-segundo de variação de GPS).
 *  - mapBounds só atualiza se mudar > 10% (evita refetch de tráfego a cada
 *    pan/zoom mínimo).
 *  - setTraffic removido do queryFn — useQuery já cacheia o resultado;
 *    o componente consome `data` direto.
 *  - calc.mutate só dispara se origin E destination mudaram significativamente.
 */
export default function Home() {
  const origin = useNavigationStore((s) => s.origin);
  const destination = useNavigationStore((s) => s.destination);
  const destinationLabel = useNavigationStore((s) => s.destinationLabel);
  const enabledStrategies = useNavigationStore((s) => s.enabledStrategies);
  const setOrigin = useNavigationStore((s) => s.setOrigin);
  const setDestination = useNavigationStore((s) => s.setDestination);

  const geo = useGeolocation();
  const calc = useCalculateRoutes();

  const [mapBounds, setMapBounds] = useState<GeoBounds | null>(null);
  // Ref para evitar recalcular rotas se origin não mudou significativamente.
  const lastOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  // Ref para evitar atualizar mapBounds se não mudou significativamente.
  const lastBoundsRef = useRef<string>('');

  // ----- GPS → store (só se mover > 30m) --------------------------------
  useEffect(() => {
    if (!geo.position) return;
    const newPos = { lat: geo.position.lat, lng: geo.position.lng };
    const last = lastOriginRef.current;
    if (last) {
      const dist = haversineMeters(last, newPos);
      if (dist < 30) return; // ignora micro-variações de GPS
    }
    lastOriginRef.current = newPos;
    setOrigin(newPos);
  }, [geo.position, setOrigin]);

  // ----- Modo demo/teste: ?origin=lat,lng bypassa GPS ------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const o = params.get('origin');
    if (!o) return;
    const [lat, lng] = o.split(',').map(parseFloat);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const newPos = { lat, lng };
      lastOriginRef.current = newPos;
      setOrigin(newPos);
    }
  }, [setOrigin]);

  // ----- Pedir GPS automaticamente quando destino é definido -----------
  const geoRequest = geo.request;
  useEffect(() => {
    if (destination && !origin) {
      geoRequest();
    }
  }, [destination, origin, geoRequest]);

  // ----- Erros de GPS como toast único em português --------------------
  useEffect(() => {
    if (geo.error) {
      let descricao = 'Não conseguimos acessar sua localização.';
      if (geo.error.includes('denied')) {
        descricao = 'Permissão negada. Toque em "Usar o centro do mapa como partida" para continuar.';
      } else if (geo.error.includes('unavailable')) {
        descricao = 'GPS indisponível neste dispositivo. Use "Usar o centro do mapa como partida".';
      } else if (geo.error.includes('timeout')) {
        descricao = 'Demorou demais para obter sua localização. Tente novamente ou use o centro do mapa.';
      }
      toast.error('Não foi possível obter sua localização', {
        id: 'geo-error',
        description: descricao,
        duration: 8000,
      });
    }
  }, [geo.error]);

  // ----- Calcular rotas quando origem E destino estão definidos --------
  // Depende apenas de origin/destination (não de enabledStrategies.join
  // que pode mudar de identidade). Mutation internamente já dedupe.
  const strategiesKey = enabledStrategies.join(',');
  useEffect(() => {
    if (!origin || !destination) return;
    calc.mutate({ origin, destination, strategies: enabledStrategies });
     
  }, [origin, destination, strategiesKey]);

  // ----- Polling do trânsito para a região visível do mapa -------------
  // useQuery cacheia por queryKey. Sem setTraffic dentro do queryFn
  // (anti-pattern que causava re-render infinito).
  const trafficQuery = useQuery({
    queryKey: ['traffic', mapBounds ? boundsKey(mapBounds) : null],
    queryFn: async ({ signal }) => {
      if (!mapBounds) return { readings: [] as TrafficReading[], generatedAt: 0 };
      return fetchTraffic(mapBounds, signal);
    },
    enabled: !!mapBounds,
    refetchInterval: 60_000, // 1 min — TomTom free tier é sensível
    staleTime: 60_000,
  });
  const traffic = trafficQuery.data?.readings ?? [];

  // ----- Sincronizar bounds do mapa periodicamente --------------------
  // Só atualiza state se os bounds mudaram significativamente (> 10% diff
  // em qualquer direção). Evita refetch de tráfego a cada micro-pan.
  // Usa debounce: só seta depois que o mapa para de mover por 2s.
  useEffect(() => {
    let lastChange = 0;
    let lastKey = '';
    const interval = setInterval(() => {
      const map = (window as unknown as { __map?: MaplibreMap }).__map;
      if (!map) return;
      const b = getMapBounds(map);
      if (!b) return;
      const key = boundsKey(b);
      if (key === lastKey) {
        // bounds estável — se já passou tempo suficiente, commita
        if (lastChange && Date.now() - lastChange > 2000 && key !== lastBoundsRef.current) {
          lastBoundsRef.current = key;
          setMapBounds(b);
        }
        return;
      }
      lastKey = key;
      lastChange = Date.now();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ----- Long-press no mapa = soltar pino de destino ------------------
  const handleMapLongPress = useCallback(
    async (coord: { lat: number; lng: number }) => {
      try {
        const res = await reverseGeocode(coord);
        setDestination(coord, res.result?.label ?? 'Pino no mapa');
        toast.success('Destino definido!', {
          description: res.result?.label ?? `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`,
        });
      } catch {
        setDestination(coord, 'Pino no mapa');
        toast.success('Destino definido!', {
          description: `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`,
        });
      }
    },
    [setDestination],
  );

  // ----- "Usar centro do mapa como origem" (fallback) -----------------
  const useMapCenterAsOrigin = useCallback(() => {
    const map = (window as unknown as { __map?: MaplibreMap }).__map;
    if (!map) {
      toast.error('Mapa ainda carregando');
      return;
    }
    const center = map.getCenter();
    const newPos = { lat: center.lat, lng: center.lng };
    lastOriginRef.current = newPos;
    setOrigin(newPos);
    toast.success('Ponto de partida definido!', {
      description: `Centro do mapa: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`,
    });
  }, [setOrigin]);

  // ----- Erros de cálculo de rota -------------------------------------
  useEffect(() => {
    if (calc.isError) {
      toast.error('Erro ao calcular rotas', {
        id: 'calc-error',
        description: 'Não foi possível contactingar o servidor de rotas. Tente novamente.',
        duration: 6000,
      });
    }
  }, [calc.isError, calc.error]);

  // ----- Sucesso: rotas prontas (toast único) -------------------------
  const lastRoutesKey = useRef<string>('');
  useEffect(() => {
    if (!calc.isSuccess || !calc.data?.routes.length) return;
    const key = calc.data.routes.map((r) => r.id).join('|');
    if (key === lastRoutesKey.current) return; // mesmo resultado, não repetir toast
    lastRoutesKey.current = key;
    const rec = calc.data.routes.find((r) => r.isRecommended) ?? calc.data.routes[0];
    toast.success(`${calc.data.routes.length} rotas encontradas!`, {
      description: `Recomendada: ${rec.label} (score ${rec.score})`,
    });
  }, [calc.data, calc.isSuccess]);

  const locating = !geo.position && (geo.permission === 'unknown' || geo.permission === 'prompt');

  const handleLocateMe = () => {
    geo.request();
    toast.info('Pedindo sua localização…', {
      description: 'Aceite a permissão para calcularmos suas rotas.',
    });
  };

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      <NavigationMap traffic={traffic} onMapLongPress={handleMapLongPress} />

      <div className="pointer-events-none absolute inset-0">
        <BrandMark />
        <SearchPanel onLocateMe={handleLocateMe} locating={locating} />
        <StrategyFilter />
        <TrafficLegend readings={traffic} />
        <RouteSheet
          locating={locating}
          onLocateMe={handleLocateMe}
          onUseMapCenterAsOrigin={useMapCenterAsOrigin}
        />
      </div>

      {/* Banner discreto do destino (desktop) */}
      {destination && destinationLabel && (
        <div className="pointer-events-none absolute left-1/2 top-40 z-10 hidden -translate-x-1/2 lg:block">
          <div className="glass-panel rounded-full px-3 py-1.5 text-xs text-foreground shadow-md">
            <span className="text-muted-foreground">Destino: </span>
            <span className="font-medium">{destinationLabel}</span>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Distância em metros entre dois pontos (Haversine). */
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Chave estável para bounds (arredondada pra 3 casas — ~100m de precisão). */
function boundsKey(b: GeoBounds): string {
  return `${b.south.toFixed(3)},${b.west.toFixed(3)},${b.north.toFixed(3)},${b.east.toFixed(3)}`;
}
