'use client';

import { useMutation } from '@tanstack/react-query';
import { fetchRoutes } from '@/lib/navigation/api';
import type { GeoCoordinate, RouteStrategy } from '@/lib/navigation/types';
import { useNavigationStore } from './use-navigation-store';

/**
 * useCalculateRoutes
 * ----------------------------------------------------------------------------
 * Mutation that fires the POST /api/route request. On success the result is
 * pushed into the navigation store (session state) and the recommended route
 * is auto-selected.
 */
export function useCalculateRoutes() {
  const setRoutes = useNavigationStore((s) => s.setRoutes);

  return useMutation({
    mutationKey: ['calculate-routes'],
    mutationFn: (vars: {
      origin: GeoCoordinate;
      destination: GeoCoordinate;
      strategies?: RouteStrategy[];
    }) => fetchRoutes(vars.origin, vars.destination, vars.strategies),
    onSuccess: (data) => {
      setRoutes(data.routes, data.recommendedId);
    },
  });
}
