/**
 * Shared navigation types — mirror the backend domain layer.
 * Kept in `lib/navigation` so the frontend doesn't import server code.
 */
export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export type Polyline = GeoCoordinate[];

export type RouteStrategy =
  | 'fastest'
  | 'shortest'
  | 'scenic'
  | 'least_turns'
  | 'experimental';

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

export interface RouteResponse {
  routes: Route[];
  recommendedId: string | null;
  generatedAt: number;
}

export interface GeocodingResult {
  label: string;
  secondary?: string;
  coordinate: GeoCoordinate;
  osmId?: string;
}

export interface GeocodingResponse {
  results: GeocodingResult[];
}

export interface TrafficReading {
  roadId: string;
  roadName: string;
  center: GeoCoordinate;
  level: number;
  freeFlowSpeed: number;
  currentSpeed: number;
  timestamp: number;
}

export interface TrafficResponse {
  readings: TrafficReading[];
  generatedAt: number;
}

export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Strategy display metadata for the UI. */
export const STRATEGY_META: Record<RouteStrategy, { label: string; color: string; description: string }> = {
  fastest:      { label: 'Fastest',        color: '#06b6d4', description: 'Minimizes total travel time.' },
  shortest:     { label: 'Shortest',       color: '#10b981', description: 'Minimizes total distance.' },
  scenic:       { label: 'Scenic',         color: '#f59e0b', description: 'Prefers calmer, greener roads. (placeholder)' },
  least_turns:  { label: 'Fewest Turns',   color: '#a855f7', description: 'Minimizes maneuvers.' },
  experimental: { label: 'AI Experimental',color: '#ef4444', description: 'AI-weighted blend (mock predictor).' },
};
