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
 * Home page
 * ----------------------------------------------------------------------------
 * The single user-visible route. Lays out the MapLibre map full-screen with
 * floating UI on top:
 *   - SearchPanel (top center / top-left on desktop)
 *   - StrategyFilter (below search, only when destination is set)
 *   - BrandMark (top-left desktop only)
 *   - TrafficLegend (bottom-left desktop only)
 *   - RouteSheet (bottom center, mobile-first)
 *
 * Side effects:
 *   - GPS subscription → pushes origin into the store.
 *   - When both origin and destination are set → triggers route calculation.
 *   - Polls /api/traffic for the visible map bounds every 30s.
 *   - Long-press on the map → reverse-geocodes the point and sets it as the
 *     destination.
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

  // ----- Demo / test mode: ?origin=lat,lng bypasses GPS ----------------
  // Useful for headless previews, CI smoke tests and users who decline
  // the geolocation permission prompt. In production this is a no-op.
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

  // Surface geolocation errors as toasts (once per error message).
  useEffect(() => {
    if (geo.error) toast.error(`GPS: ${geo.error}`);
  }, [geo.error]);

  // ----- Auto-calculate routes when both ends are set -------------------
  useEffect(() => {
    if (!origin || !destination) return;
    calc.mutate({ origin, destination, strategies: enabledStrategies });
     
  }, [origin, destination, enabledStrategies.join(',')]);

  // ----- Poll traffic for the visible map bounds ------------------------
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

  // ----- Periodically sync the map's viewport bounds into state ---------
  useEffect(() => {
    const interval = setInterval(() => {
      // The map exposes itself on window for the MVP; a more robust solution
      // would forward a ref. Keeping it simple per the MVP brief.
      const map = (window as unknown as { __map?: MaplibreMap }).__map;
      if (!map) return;
      const b = getMapBounds(map);
      if (b) setMapBounds(b);
    }, 4_000);
    return () => clearInterval(interval);
  }, []);

  // ----- Long-press to set destination ---------------------------------
  const handleMapLongPress = useCallback(
    async (coord: { lat: number; lng: number }) => {
      // Reverse geocode for a friendly label (best-effort, not blocking).
      try {
        const res = await reverseGeocode(coord);
        setDestination(coord, res.result?.label ?? 'Dropped pin');
        toast.success('Destination set', { description: res.result?.label ?? `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      } catch {
        setDestination(coord, 'Dropped pin');
        toast.success('Destination set', { description: `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}` });
      }
    },
    [setDestination],
  );

  // ----- Show recalculation errors -------------------------------------
  useEffect(() => {
    if (calc.isError) {
      toast.error('Route calculation failed', { description: (calc.error as Error)?.message });
    }
  }, [calc.isError, calc.error]);

  // ----- Show success toast when routes come back ----------------------
  useEffect(() => {
    if (calc.isSuccess && calc.data?.routes.length) {
      const rec = calc.data.routes.find((r) => r.isRecommended) ?? calc.data.routes[0];
      toast.success(`Found ${calc.data.routes.length} routes`, {
        description: `Recommended: ${rec.label} (score ${rec.score})`,
      });
    }
     
  }, [calc.data]);

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      {/* Map (full-screen base layer) */}
      <NavigationMap traffic={traffic} onMapLongPress={handleMapLongPress} />

      {/* Floating UI layer */}
      <div className="pointer-events-none absolute inset-0">
        <BrandMark />
        <SearchPanel
          onLocateMe={() => {
            geo.request();
            toast.info('Locating you…');
          }}
          locating={geo.permission === 'unknown' && !geo.position}
        />
        <StrategyFilter />
        <TrafficLegend readings={traffic} />
        <RouteSheet />
      </div>

      {/* Tiny destination banner so the user always sees what they typed */}
      {destination && destinationLabel && (
        <div className="pointer-events-none absolute left-1/2 top-32 z-10 hidden -translate-x-1/2 md:block">
          <div className="glass-panel rounded-full px-3 py-1.5 text-xs text-foreground shadow-md">
            <span className="text-muted-foreground">To: </span>
            <span className="font-medium">{destinationLabel}</span>
          </div>
        </div>
      )}

      {/* Loading overlay while route calculation is in flight and no routes yet */}
      {calc.isPending && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center">
          <div className="glass-panel-strong mx-auto inline-block rounded-xl px-4 py-2 text-sm text-foreground shadow-xl">
            Calculating routes…
          </div>
        </div>
      )}
    </main>
  );
}
