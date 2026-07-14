import type {
  GeoBounds,
  GeoCoordinate,
  GeocodingResponse,
  Route,
  RouteResponse,
  RouteStrategy,
  TrafficResponse,
} from './types';

/**
 * Thin fetch wrappers for the TrafficMind API. All requests are same-origin
 * relative paths under `/api`. The functions are framework-agnostic so they
 * can be called from React Query hooks, server components or test fixtures.
 */

export async function fetchRoutes(
  origin: GeoCoordinate,
  destination: GeoCoordinate,
  strategies?: RouteStrategy[],
  signal?: AbortSignal,
): Promise<RouteResponse> {
  const res = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, strategies }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Route request failed (${res.status})`);
  }
  return (await res.json()) as RouteResponse;
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodingResponse> {
  const url = `/api/geocode?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
  return (await res.json()) as GeocodingResponse;
}

export async function reverseGeocode(
  coord: GeoCoordinate,
  signal?: AbortSignal,
): Promise<{ result: GeocodingResponse['results'][number] | null }> {
  const url = `/api/reverse-geocode?lat=${coord.lat}&lng=${coord.lng}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  return (await res.json()) as { result: GeocodingResponse['results'][number] | null };
}

export async function fetchTraffic(bounds: GeoBounds, signal?: AbortSignal): Promise<TrafficResponse> {
  const url = `/api/traffic?south=${bounds.south}&west=${bounds.west}&north=${bounds.north}&east=${bounds.east}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Traffic fetch failed (${res.status})`);
  return (await res.json()) as TrafficResponse;
}

export type { Route };
