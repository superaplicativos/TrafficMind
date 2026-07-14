/**
 * Composition root.
 * ============================================================================
 * The single place where concrete implementations are wired to the domain
 * ports. Anything outside this file depends on interfaces, never on classes.
 *
 * To swap the mock TrafficPredictor for a real ML model, edit ONE line here.
 * ============================================================================
 */
import { TrafficEngine } from '@/server/application/services/traffic-engine.service';
import { RouteScoringService } from '@/server/application/services/route-scoring.service';
import { OsrmRoutingEngine } from '@/server/infrastructure/osrm/osrm-routing-engine';
import { NominatimGeocodingService } from '@/server/infrastructure/nominatim/nominatim-geocoder';
import { MockTrafficPredictor } from '@/server/infrastructure/predictor/mock-traffic-predictor';
import type {
  GeocodingService,
  RoutingEngine,
  TrafficPredictor,
  TrafficRepository,
} from '@/server/domain';

// --- Singletons ------------------------------------------------------------

/** The simulated traffic feed. Implements TrafficRepository directly. */
export const trafficEngine = new TrafficEngine();

/** The route scorer with default MVP weights. */
export const routeScorer = new RouteScoringService();

/**
 * OSRM endpoint. In docker-compose this is the `osrm` service on its default
 * 5000 port. Outside docker it falls back to the public OSRM demo server so
 * the app is useful even with zero infrastructure.
 */
const OSRM_ENDPOINT =
  process.env.OSRM_ENDPOINT ?? 'https://router.project-osrm.org';

/** RoutingEngine backed by OSRM. */
export const routingEngine: RoutingEngine = new OsrmRoutingEngine(
  OSRM_ENDPOINT,
  trafficEngine as TrafficRepository,
  routeScorer,
);

/** Geocoder backed by OSM Nominatim. */
export const geocodingService: GeocodingService = new NominatimGeocodingService();

/**
 * AI slot. Today: mock. Tomorrow: replace this one line with a real
 * ML-backed implementation of TrafficPredictor.
 */
export const trafficPredictor: TrafficPredictor = new MockTrafficPredictor(trafficEngine);

// The TrafficEngine already implements TrafficRepository, but exposing it
// through the port makes the dependency direction explicit.
export const trafficRepository: TrafficRepository = trafficEngine;
