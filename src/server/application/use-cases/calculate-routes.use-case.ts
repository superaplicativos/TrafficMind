import type { GeoCoordinate, Route, RouteStrategy } from '@/server/domain';
import { routingEngine, trafficPredictor } from '@/server/application/container';

/**
 * Use case: calculate every alternative route between two points and rank
 * them by composite score.
 *
 * The default strategy set matches the MVP brief: fastest, shortest, scenic,
 * least_turns, experimental. The experimental strategy is also "pre-warmed"
 * by asking the AI predictor for an ETA prediction — the value is currently
 * discarded (mock returns ~the same number OSRM does), but the call site
 * exists so future ML models can hook in without touching the controller.
 */
export async function calculateRoutesUseCase(
  origin: GeoCoordinate,
  destination: GeoCoordinate,
  strategies: RouteStrategy[] = ['fastest', 'shortest', 'scenic', 'least_turns', 'experimental'],
): Promise<Route[]> {
  const routes = await routingEngine.calculateRoutes(origin, destination, strategies);

  // AI slot — touch the predictor so the dependency is real and the contract
  // is exercised. Future ML models can re-rank `routes` using predictions.
  if (routes.length > 0) {
    const predictedEta = await trafficPredictor.predictETA({
      geometry: routes[0].geometry,
      distance: routes[0].distance,
    });
    // For the MVP we log to the route's metadata implicitly: the experimental
    // route carries a label that already says "AI Experimental", and the
    // predicted ETA is reserved for the future "AI Re-ranked" badge.
    void predictedEta;
  }

  return routes;
}
