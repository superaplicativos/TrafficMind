/**
 * TrafficMind — Domain Layer (NestJS backend reference)
 * ============================================================================
 * Identical contract to the Next.js API's domain layer. Keeping both in sync
 * is intentional: the same business types power the dev-time API (Next.js
 * routes) and the production API (NestJS). The reference implementation
 * below mirrors the Next.js implementation one-to-one.
 * ============================================================================
 */

export interface GeoCoordinate { lat: number; lng: number; }
export type Polyline = GeoCoordinate[];

export type RouteStrategy =
  | 'fastest' | 'shortest' | 'scenic' | 'least_turns' | 'experimental';

export interface RouteInstruction {
  step: number;
  text: string;
  distance: number;
  duration: number;
  sign?: number;
  location?: GeoCoordinate;
}

export interface Route {
  id: string;
  strategy: RouteStrategy;
  label: string;
  distance: number;
  duration: number;
  geometry: Polyline;
  instructions: RouteInstruction[];
  intersectionCount: number;
  roadComplexity: number;
  trafficLevel: number;
  estimatedFuel: number;
  score: number;
  isRecommended: boolean;
}

export type TrafficLevel = number;

export interface TrafficReading {
  roadId: string;
  roadName: string;
  center: GeoCoordinate;
  level: TrafficLevel;
  freeFlowSpeed: number;
  currentSpeed: number;
  timestamp: number;
}

export interface TrafficPredictor {
  predictRoadWeight(roadId: string, context?: PredictionContext): Promise<number>;
  predictCongestion(roadId: string, horizonMinutes: number): Promise<TrafficLevel>;
  predictETA(route: Pick<Route, 'geometry' | 'distance'>): Promise<number>;
}

export interface PredictionContext {
  dayOfWeek?: number;
  minuteOfDay?: number;
  weatherCode?: number;
  incidentActive?: boolean;
}

export interface RoutingEngine {
  calculateRoutes(origin: GeoCoordinate, destination: GeoCoordinate, strategies: RouteStrategy[]): Promise<Route[]>;
}

export interface TrafficRepository {
  getTrafficForRegion(bounds: GeoBounds): Promise<TrafficReading[]>;
  getTrafficForRoad(roadId: string): Promise<TrafficReading | null>;
}

export interface GeoBounds { south: number; west: number; north: number; east: number; }

export interface GeocodingService {
  search(query: string): Promise<GeocodingResult[]>;
  reverse(coordinate: GeoCoordinate): Promise<GeocodingResult | null>;
}

export interface GeocodingResult {
  label: string;
  secondary?: string;
  coordinate: GeoCoordinate;
  bbox?: [number, number, number, number];
  osmId?: string;
}
