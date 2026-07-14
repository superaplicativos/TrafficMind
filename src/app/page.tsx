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
 * floating UI on top.
 *
 * UX flow (the "happy path"):
 *   1. User opens the page → map loads centered on São Paulo.
 *   2. User searches a destination → dropdown of Nominatim candidates.
 *   3. User picks a destination → toast confirms, destination pin dropped.
 *      → If no origin yet, automatically request GPS permission.
 *      → Bottom sheet shows "Set your starting point" with two CTAs:
 *        "Use my GPS" (retry permission) or "Use map center" (fallback).
 *   4. Origin acquired (GPS or fallback) → routes auto-calculate.
 *   5. Bottom sheet shows recommended route, expandable to see all 5
 *      alternatives + statistics + score breakdown.
 *
 * The page also supports long-press on the map to drop a destination pin
 * (with reverse-geocoded label) and a `?origin=lat,lng` query param for
 * headless / preview runs that bypass GPS.
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

  // ----- Auto-request GPS when destination is set but origin is missing --
  // This is the key UX fix: previously the user picked a destination and
  // nothing happened because origin was never requested. Now we trigger the
  // GPS permission prompt automatically the moment a destination is chosen.
  // Depends only on `geo.request` (stable useCallback) + origin/destination
  // so the effect doesn't fire on every render.
  const geoRequest = geo.request;
  useEffect(() => {
    if (destination && !origin) {
      geoRequest();
    }
  }, [destination, origin, geoRequest]);

  // Surface geolocation errors as a single toast (id dedupes repeats).
  useEffect(() => {
    if (geo.error) {
      toast.error('Could not get your location', {
        id: 'geo-error', // stable id → sonner replaces instead of stacking
        description: `${geo.error}. You can still set your starting point manually with "Use map center".`,
        duration: 6000,
      });
    }
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
      try {
        const res = await reverseGeocode(coord);
        setDestination(coord, res.result?.label ?? 'Dropped pin');
        toast.success('Destination set', {
          description: res.result?.label ?? `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`,
        });
      } catch {
        setDestination(coord, 'Dropped pin');
        toast.success('Destination set', {
          description: `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`,
        });
      }
    },
    [setDestination],
  );

  // ----- "Use map center as origin" fallback ---------------------------
  const useMapCenterAsOrigin = useCallback(() => {
    const map = (window as unknown as { __map?: MaplibreMap }).__map;
    if (!map) {
      toast.error('Map not ready yet');
      return;
    }
    const center = map.getCenter();
    setOrigin({ lat: center.lat, lng: center.lng });
    toast.success('Starting point set', {
      description: `Map center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`,
    });
  }, [setOrigin]);

  // ----- Show route calculation errors ---------------------------------
  useEffect(() => {
    if (calc.isError) {
      toast.error('Route calculation failed', {
        description: (calc.error as Error)?.message ?? 'Please try again.',
        duration: 6000,
      });
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

  const locating = !geo.position && (geo.permission === 'unknown' || geo.permission === 'prompt');

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      <NavigationMap traffic={traffic} onMapLongPress={handleMapLongPress} />

      <div className="pointer-events-none absolute inset-0">
        <BrandMark />
        <SearchPanel
          onLocateMe={() => {
            geo.request();
            toast.info('Requesting your location…');
          }}
          locating={locating}
        />
        <StrategyFilter />
        <TrafficLegend readings={traffic} />
        <RouteSheet
          locating={locating}
          onLocateMe={() => {
            geo.request();
            toast.info('Requesting your location…');
          }}
          onUseMapCenterAsOrigin={useMapCenterAsOrigin}
        />
      </div>

      {/* Tiny destination banner so the user always sees what they typed */}
      {destination && destinationLabel && (
        <div className="pointer-events-none absolute left-1/2 top-36 z-10 hidden -translate-x-1/2 md:block">
          <div className="glass-panel rounded-full px-3 py-1.5 text-xs text-foreground shadow-md">
            <span className="text-muted-foreground">To: </span>
            <span className="font-medium">{destinationLabel}</span>
          </div>
        </div>
      )}
    </main>
  );
}
