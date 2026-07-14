'use client';

import { useCallback, useEffect, useState } from 'react';
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
 *   Passo 1: usuário busca um destino → dropdown do Nominatim → escolhe um.
 *   Passo 2: app pede localização automaticamente. Se negada, mostra
 *            "De onde você sai?" com 2 botões grandes:
 *            "Usar minha localização atual" (tenta de novo) ou
 *            "Usar o centro do mapa como partida" (fallback).
 *   Passo 3: rotas calculadas → painel mostra rota recomendada + alternativas
 *            + estatísticas + breakdown do score.
 *
 * Também suporta:
 *   - Long-press no mapa para soltar um pino de destino (com reverse geocode).
 *   - Parâmetro ?origin=lat,lng para testes/headless (bypassa GPS).
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
  const [traffic, setTraffic] = useState<TrafficReading[]>([]);

  // ----- GPS → store ----------------------------------------------------
  useEffect(() => {
    if (geo.position) {
      setOrigin({ lat: geo.position.lat, lng: geo.position.lng });
    }
  }, [geo.position, setOrigin]);

  // ----- Modo demo/teste: ?origin=lat,lng bypassa GPS ------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const o = params.get('origin');
    if (!o) return;
    const [lat, lng] = o.split(',').map(parseFloat);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setOrigin({ lat, lng });
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
      // Mensagens amigáveis em vez de jargão técnico do browser.
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

  // ----- Calcular rotas quando origem e destino estão definidos --------
  useEffect(() => {
    if (!origin || !destination) return;
    calc.mutate({ origin, destination, strategies: enabledStrategies });
     
  }, [origin, destination, enabledStrategies.join(',')]);

  // ----- Polling do trânsito para a região visível do mapa -------------
  useQuery({
    queryKey: ['traffic', mapBounds],
    queryFn: async ({ signal }) => {
      if (!mapBounds) return { readings: [], generatedAt: 0 };
      const res = await fetchTraffic(mapBounds, signal);
      setTraffic(res.readings);
      return res;
    },
    enabled: !!mapBounds,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  // ----- Sincronizar bounds do mapa periodicamente --------------------
  useEffect(() => {
    const interval = setInterval(() => {
      const map = (window as unknown as { __map?: MaplibreMap }).__map;
      if (!map) return;
      const b = getMapBounds(map);
      if (b) setMapBounds(b);
    }, 4_000);
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
    setOrigin({ lat: center.lat, lng: center.lng });
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

  // ----- Sucesso: rotas prontas ---------------------------------------
  useEffect(() => {
    if (calc.isSuccess && calc.data?.routes.length) {
      const rec = calc.data.routes.find((r) => r.isRecommended) ?? calc.data.routes[0];
      toast.success(`${calc.data.routes.length} rotas encontradas!`, {
        description: `Recomendada: ${rec.label} (score ${rec.score})`,
      });
    }
     
  }, [calc.data]);

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
