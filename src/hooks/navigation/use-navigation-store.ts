'use client';

import { create } from 'zustand';
import type { GeoCoordinate, Route, RouteStrategy } from '@/lib/navigation/types';

/**
 * NavigationSessionStore
 * ----------------------------------------------------------------------------
 * The single source of truth for the current navigation session:
 *   - origin (GPS or manually pinned)
 *   - destination (search result or map pin)
 *   - calculated routes (alternative + recommended)
 *   - currently selected route id (which one is highlighted on the map)
 *   - which strategies the user wants to compute
 *
 * Routes themselves come from React Query (server state); this store only
 * holds the *session* state — the user's current intent.
 */
interface NavigationState {
  origin: GeoCoordinate | null;
  destination: GeoCoordinate | null;
  destinationLabel: string;
  routes: Route[];
  recommendedId: string | null;
  selectedRouteId: string | null;
  enabledStrategies: RouteStrategy[];
  lastOriginPulledAt: number | null;

  setOrigin: (c: GeoCoordinate | null) => void;
  setDestination: (c: GeoCoordinate | null, label?: string) => void;
  setRoutes: (routes: Route[], recommendedId: string | null) => void;
  selectRoute: (id: string | null) => void;
  toggleStrategy: (s: RouteStrategy) => void;
  markOriginPulled: () => void;
  reset: () => void;
}

const DEFAULT_STRATEGIES: RouteStrategy[] = [
  'fastest',
  'shortest',
  'scenic',
  'least_turns',
  'experimental',
];

export const useNavigationStore = create<NavigationState>((set, get) => ({
  origin: null,
  destination: null,
  destinationLabel: '',
  routes: [],
  recommendedId: null,
  selectedRouteId: null,
  enabledStrategies: DEFAULT_STRATEGIES,
  lastOriginPulledAt: null,

  setOrigin: (c) => set({ origin: c }),
  setDestination: (c, label) =>
    set({ destination: c, destinationLabel: label ?? '', selectedRouteId: null, routes: [] }),
  setRoutes: (routes, recommendedId) =>
    set({
      routes,
      recommendedId,
      // default-select the recommended route (or the first one)
      selectedRouteId: recommendedId ?? routes[0]?.id ?? null,
    }),
  selectRoute: (id) => set({ selectedRouteId: id }),
  toggleStrategy: (s) =>
    set((state) => {
      const has = state.enabledStrategies.includes(s);
      const next = has
        ? state.enabledStrategies.filter((x) => x !== s)
        : [...state.enabledStrategies, s];
      // never let the user disable everything
      return { enabledStrategies: next.length ? next : state.enabledStrategies };
    }),
  markOriginPulled: () => set({ lastOriginPulledAt: Date.now() }),
  reset: () =>
    set({
      origin: get().origin,
      destination: null,
      destinationLabel: '',
      routes: [],
      recommendedId: null,
      selectedRouteId: null,
    }),
}));
