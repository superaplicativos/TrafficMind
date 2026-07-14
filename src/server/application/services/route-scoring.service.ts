import type { Route, RouteStrategy } from '@/server/domain';
import {
  DEFAULT_SCORING_WEIGHTS,
  STRATEGY_WEIGHT_OVERRIDES,
  type RouteScoringWeights,
} from './scoring-weights';

/**
 * RouteScoringService
 * ============================================================================
 * Turns raw routing-engine output into a comparable, explainable score.
 *
 * The MVP formula is intentionally transparent so product / data folks can
 * reason about it:
 *
 *   score = ETA * etaWeight
 *         + trafficLevel * trafficWeight
 *         + intersectionCount * intersectionPenalty
 *         + accidents * accidentPenalty          // 0 in MVP
 *         + roadComplexity * roadComplexityWeight
 *
 * Lower score wins. The service is pure — given the same inputs it returns
 * the same outputs — which keeps it trivially unit-testable and lets the
 * future ML layer learn weights without touching call sites.
 * ============================================================================
 */
export class RouteScoringService {
  constructor(private readonly weights: RouteScoringWeights = DEFAULT_SCORING_WEIGHTS) {}

  /**
   * Score a single route using its strategy's weight profile.
   * Mutates `score` and returns the route for chaining.
   */
  score(route: Route): Route {
    const w = this.weightsFor(route.strategy);

    const etaComponent = route.duration * w.etaWeight;
    const trafficComponent = route.trafficLevel * w.trafficWeight;
    const intersectionComponent = route.intersectionCount * w.intersectionPenalty;
    const accidentComponent = 0 * w.accidentPenalty; // MVP: no accident feed yet
    const complexityComponent = route.roadComplexity * w.roadComplexityWeight;

    route.score = Math.round(
      etaComponent + trafficComponent + intersectionComponent + accidentComponent + complexityComponent,
    );
    return route;
  }

  /**
   * Score every route, sort ascending, and mark the lowest-scoring one as
   * recommended. Returns a fresh sorted array; callers should treat the
   * first element as the recommended route.
   */
  rank(routes: Route[]): Route[] {
    const scored = routes.map((r) => this.score({ ...r }));
    scored.sort((a, b) => a.score - b.score);
    if (scored.length > 0) scored[0].isRecommended = true;
    return scored;
  }

  /**
   * Compose the effective weight set for a given strategy by merging the
   * defaults with any per-strategy overrides.
   */
  private weightsFor(strategy: RouteStrategy): RouteScoringWeights {
    const override = STRATEGY_WEIGHT_OVERRIDES[strategy] ?? {};
    return { ...this.weights, ...override };
  }

  /**
   * Human-readable breakdown of how a route's score was computed. Used by
   * the statistics panel to make the engine explainable to the user.
   */
  explain(route: Route): Array<{ label: string; value: number }> {
    const w = this.weightsFor(route.strategy);
    return [
      { label: 'ETA', value: Math.round(route.duration * w.etaWeight) },
      { label: 'Traffic', value: Math.round(route.trafficLevel * w.trafficWeight) },
      { label: 'Intersections', value: Math.round(route.intersectionCount * w.intersectionPenalty) },
      { label: 'Road complexity', value: Math.round(route.roadComplexity * w.roadComplexityWeight) },
    ];
  }
}
