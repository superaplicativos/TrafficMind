/**
 * TrafficMind — Domain Layer
 * ============================================================================
 * Pure business entities and value objects. No framework, no I/O, no external
 * dependencies. This is the heart of Clean Architecture: everything else
 * (application, infrastructure, presentation) depends on these types, never
 * the other way around.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Geographic primitives
// ---------------------------------------------------------------------------

/**
 * A WGS84 geographic coordinate. The fundamental unit for all spatial work.
 */
export interface GeoCoordinate {
  lat: number;
  lng: number;
}

/**
 * A sequence of coordinates that traces a path on the map.
 */
export type Polyline = GeoCoordinate[];

// ---------------------------------------------------------------------------
// Route domain
// ---------------------------------------------------------------------------

/**
 * The categorical reason a route was generated. The frontend uses this to
 * label routes ("Fastest", "Shortest", ...) and the scoring engine uses it
 * to apply the right weight profile.
 */
export type RouteStrategy =
  | 'fastest'      // minimize travel time
  | 'shortest'     // minimize distance
  | 'scenic'       // placeholder — prefer green / waterfront edges (mock)
  | 'least_turns'  // minimize intersection count
  | 'experimental';// AI-weighted blend (placeholder for ML predictor)

export interface RouteInstruction {
  step: number;
  text: string;
  distance: number;
  duration: number;
  sign?: number;
  location?: GeoCoordinate;
}

/**
 * A single calculated route between an origin and a destination, produced
 * by the routing engine and enriched by the traffic engine + scorer.
 */
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

// ---------------------------------------------------------------------------
// Traffic domain
// ---------------------------------------------------------------------------

/**
 * Traffic congestion level on a 0..100 scale where 0 = free flow and
 * 100 = gridlock. This is the lingua franca between the Traffic Engine,
 * the AI predictor and the route scorer.
 */
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

// ---------------------------------------------------------------------------
// AI predictor contract
// ---------------------------------------------------------------------------

/**
 * Contract that any future ML-powered traffic predictor must implement.
 *
 * The MVP ships with a deterministic mock implementation; swapping it for a
 * real model (e.g. a Graph Neural Network trained on historical loops) only
 * requires implementing this interface — no other layer changes.
 */
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

// ---------------------------------------------------------------------------
// Repository contracts (ports)
// ---------------------------------------------------------------------------

export interface RoutingEngine {
  calculateRoutes(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    strategies: RouteStrategy[],
  ): Promise<Route[]>;
}

export interface TrafficRepository {
  getTrafficForRegion(bounds: GeoBounds): Promise<TrafficReading[]>;
  getTrafficForRoad(roadId: string): Promise<TrafficReading | null>;
}

export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

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
