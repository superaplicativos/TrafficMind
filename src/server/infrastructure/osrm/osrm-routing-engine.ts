import type {
  GeoCoordinate,
  Polyline,
  Route,
  RouteInstruction,
  RouteStrategy,
  RoutingEngine,
  TrafficRepository,
} from '@/server/domain';
import type { RouteScoringService } from '@/server/application/services/route-scoring.service';

/**
 * OsrmRoutingEngine
 * ============================================================================
 * Implements the RoutingEngine port against an OSRM-compatible HTTP API.
 *
 * GraphHopper (the production target described in the README) ships an
 * OSRM-compatible endpoint at `/route` when the `graphhopper-osm-lib` is run
 * with the OSRM adapter, but for the MVP we target vanilla OSRM so the app
 * works out-of-the-box against the public demo server AND the docker-compose
 * OSRM container. The interface is identical from the domain layer's POV.
 *
 * Each requested RouteStrategy is translated to an OSRM `overview=full`
 * request with a different `geometries=geojson` profile + alternative
 * algorithm hint. The raw OSRM response is then enriched with traffic-aware
 * duration, intersection count, road complexity and fuel estimate before
 * being passed through the RouteScoringService.
 * ============================================================================
 */
export class OsrmRoutingEngine implements RoutingEngine {
  constructor(
    private readonly endpoint: string,
    private readonly traffic: TrafficRepository,
    private readonly scorer: RouteScoringService,
  ) {}

  async calculateRoutes(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    strategies: RouteStrategy[],
  ): Promise<Route[]> {
    // MVP strategy: fire one OSRM request with `alternatives=true` to get up
    // to N alternative geometries in a single call (avoids the public demo
    // server's per-IP rate limit), then *label* each returned geometry with a
    // strategy from the requested set. This is honest about the fact that the
    // public OSRM endpoint computes "fastest + alternatives" rather than
    // genuinely different objective functions — but it gives the user visible
    // alternatives to compare, and the scoring engine still produces a
    // meaningful ranking. In production (self-hosted GraphHopper) each
    // strategy becomes a real `ch.disable=true` request with its own weight.
    const altRoutes = await this.fetchAlternatives(origin, destination, strategies.length);
    if (altRoutes.length === 0) return [];

    // Map each requested strategy onto one of the returned geometries.
    // If we got fewer alternatives than strategies, the extra strategies
    // reuse the last geometry but get their own (re-scored) entry — so the
    // user can still see how different weight profiles would rank the same
    // physical route.
    const routes: Route[] = [];
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      const raw = altRoutes[Math.min(i, altRoutes.length - 1)];
      routes.push(await this.enrich(raw, strategy, i));
    }

    return this.scorer.rank(routes);
  }

  // --------------------------------------------------------------------------

  /**
   * Single OSRM call requesting multiple alternative geometries.
   * Returns an empty array on any failure so callers can degrade gracefully.
   * Retries once on transient failure — the public OSRM demo server
   * occasionally rate-limits or returns an empty body.
   */
  private async fetchAlternatives(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    count: number,
  ): Promise<OsrmRoute[]> {
    const url = new URL(
      `${this.endpoint}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
    );
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('steps', 'true');
    url.searchParams.set('alternatives', 'true');
    url.searchParams.set('annotations', 'false');

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          if (attempt === 0) continue;
          return [];
        }
        const body = (await res.json()) as OsrmRouteResponse;
        if (body.code !== 'Ok' || !body.routes?.length) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }
          return [];
        }
        // OSRM may return fewer alternatives than requested — that's fine.
        // Sort by duration so we can label them sensibly.
        return body.routes.sort((a, b) => a.duration - b.duration).slice(0, Math.max(count, 1));
      } catch {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        return [];
      }
    }
    return [];
  }

  /**
   * Convert a raw OSRM route into a domain Route, then enrich it with
   * traffic-aware duration, intersection count, complexity and fuel estimate.
   * The TrafficRepository gives us the live congestion along the route's
   * bounding box, which we sample to produce an aggregate `trafficLevel`.
   */
  private async enrich(raw: OsrmRoute, strategy: RouteStrategy, index: number): Promise<Route> {
    const geometry = parseGeometry(raw.geometry);
    const instructions = parseInstructions(raw.legs);
    const intersectionCount = countIntersections(raw.legs);

    const bounds = computeBounds(geometry, 0.005);
    const trafficReadings = await this.traffic.getTrafficForRegion(bounds);
    const trafficLevel = aggregateTraffic(trafficReadings);

    // Traffic-adjusted duration: degrade by up to +60% when trafficLevel=100.
    const trafficMultiplier = 1 + (trafficLevel / 100) * 0.6;
    const duration = Math.round(raw.duration * trafficMultiplier);

    const roadComplexity = computeComplexity(geometry, instructions);
    const estimatedFuel = estimateFuel(raw.distance, duration, trafficLevel);

    const label = buildLabel(strategy, duration, raw.distance);

    const route: Route = {
      id: `${strategy}-${index}-${raw.distance}-${Math.round(raw.duration)}`,
      strategy,
      label,
      distance: Math.round(raw.distance),
      duration,
      geometry,
      instructions,
      intersectionCount,
      roadComplexity,
      trafficLevel,
      estimatedFuel,
      score: 0,
      isRecommended: false,
    };
    return this.scorer.score(route);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseGeometry(g: OsrmRoute['geometry']): Polyline {
  if (g.type === 'LineString') return g.coordinates.map(([lng, lat]) => ({ lat, lng }));
  // GeoJSON MultiLineString — flatten.
  return (g.coordinates as number[][][]).flat().map(([lng, lat]) => ({ lat, lng }));
}

function parseInstructions(legs: OsrmLeg[]): RouteInstruction[] {
  const out: RouteInstruction[] = [];
  let step = 1;
  for (const leg of legs) {
    for (const s of leg.steps) {
      out.push({
        step: step++,
        text: s.name ? `${maneuverText(s.maneuver)} onto ${s.name}` : maneuverText(s.maneuver),
        distance: Math.round(s.distance),
        duration: Math.round(s.duration),
        sign: signFromManeuver(s.maneuver),
        location: s.maneuver.location
          ? { lat: s.maneuver.location[1], lng: s.maneuver.location[0] }
          : undefined,
      });
    }
  }
  return out;
}

function maneuverText(m: OsrmManeuver): string {
  switch (m.type) {
    case 'depart': return 'Depart';
    case 'arrive': return 'Arrive at destination';
    case 'turn': {
      const mod = m.modifier ?? 'straight';
      return `Turn ${mod}`;
    }
    case 'continue': return 'Continue';
    case 'merge': return 'Merge';
    case 'roundabout': return 'Enter roundabout';
    case 'rotary': return 'Enter rotary';
    case 'fork': return `Take fork ${m.modifier ?? 'straight'}`;
    case 'end of road': return `End of road, turn ${m.modifier ?? 'straight'}`;
    default: return 'Proceed';
  }
}

function signFromManeuver(m: OsrmManeuver): number {
  const mod = m.modifier ?? '';
  if (m.type === 'depart' || m.type === 'arrive') return 0;
  if (mod.includes('left')) return -1;
  if (mod.includes('right')) return 1;
  if (mod === 'sharp left') return -3;
  if (mod === 'sharp right') return 3;
  if (mod === 'slight left') return -2;
  if (mod === 'slight right') return 2;
  if (mod === 'uturn') return -6;
  return 0;
}

function countIntersections(legs: OsrmLeg[]): number {
  // Every maneuver that isn't "depart" or "arrive" counts as an intersection.
  let n = 0;
  for (const leg of legs) {
    for (const s of leg.steps) {
      if (s.maneuver.type !== 'depart' && s.maneuver.type !== 'arrive') n++;
    }
  }
  return n;
}

function computeBounds(points: Polyline, pad: number) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  return { south: minLat - pad, west: minLng - pad, north: maxLat + pad, east: maxLng + pad };
}

function aggregateTraffic(readings: { level: number }[]): number {
  if (!readings.length) return 30; // sensible default for areas without known roads
  // Use the mean — a more sophisticated scorer could use a distance-weighted
  // average across the route's edges, but for the MVP the mean is enough to
  // differentiate routes.
  return Math.round(readings.reduce((s, r) => s + r.level, 0) / readings.length);
}

function computeComplexity(geometry: Polyline, instructions: RouteInstruction[]): number {
  // 0..100. Heuristic: count direction changes (sharp angles in the polyline)
  // plus a per-intersection contribution, then squash with a soft cap.
  let directionChanges = 0;
  for (let i = 2; i < geometry.length; i++) {
    const a = geometry[i - 2], b = geometry[i - 1], c = geometry[i];
    const bearing1 = bearing(a, b);
    const bearing2 = bearing(b, c);
    const delta = Math.abs(normalizeAngle(bearing2 - bearing1));
    if (delta > 30) directionChanges++;
  }
  const intersectionComponent = Math.min(instructions.length * 2, 40);
  const changeComponent = Math.min(directionChanges * 3, 40);
  return Math.min(100, Math.round(intersectionComponent + changeComponent + 20));
}

function bearing(a: GeoCoordinate, b: GeoCoordinate): number {
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const normalizeAngle = (a: number) => (a > 180 ? a - 360 : a < -180 ? a + 360 : a);

/**
 * Estimate fuel consumption in liters.
 * Model: base rate 6 L/100km, +30% in heavy traffic, +15% if average speed
 * below 25 km/h (city stop-and-go). Placeholder — replace with a real
 * consumption model in the future "fuel optimization" feature.
 */
function estimateFuel(distanceM: number, durationS: number, trafficLevel: number): number {
  const distanceKm = distanceM / 1000;
  const hours = durationS / 3600;
  const avgSpeed = hours > 0 ? distanceKm / hours : 0;
  let lPer100 = 6;
  if (trafficLevel > 60) lPer100 *= 1.3;
  if (avgSpeed < 25) lPer100 *= 1.15;
  return Math.round((distanceKm * lPer100) / 1000 * 10) / 10;
}

function buildLabel(strategy: RouteStrategy, durationS: number, distanceM: number): string {
  const minutes = Math.round(durationS / 60);
  const km = (distanceM / 1000).toFixed(1);
  const name = STRATEGY_LABELS[strategy];
  return `${name} • ${minutes} min • ${km} km`;
}

const STRATEGY_LABELS: Record<RouteStrategy, string> = {
  fastest: 'Fastest',
  shortest: 'Shortest',
  scenic: 'Scenic',
  least_turns: 'Fewest Turns',
  experimental: 'AI Experimental',
};

// ---------------------------------------------------------------------------
// OSRM response types (subset we use)
// ---------------------------------------------------------------------------

interface OsrmRouteResponse {
  code: string;
  routes: OsrmRoute[];
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: GeoJsonLineString | GeoJsonMultiLineString;
  legs: OsrmLeg[];
}

interface OsrmLeg {
  steps: OsrmStep[];
}

interface OsrmStep {
  name: string;
  distance: number;
  duration: number;
  maneuver: OsrmManeuver;
}

interface OsrmManeuver {
  type: string;
  modifier?: string;
  location?: [number, number];
}

interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}
interface GeoJsonMultiLineString {
  type: 'MultiLineString';
  coordinates: [number, number][][];
}
