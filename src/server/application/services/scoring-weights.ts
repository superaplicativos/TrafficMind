/**
 * Configuration for the RouteScoringService.
 *
 * Every weight is intentionally exposed as a constructor argument so the
 * system can be re-tuned without code changes (env vars, A/B tests, ML
 * learned weights, etc.). The defaults encode MVP heuristics.
 */
export interface RouteScoringWeights {
  /** Multiplier applied to ETA (seconds) before adding penalties. */
  etaWeight: number;
  /** Multiplier applied to the 0..100 traffic level. */
  trafficWeight: number;
  /** Flat penalty added per intersection / maneuver. */
  intersectionPenalty: number;
  /** Penalty added per active accident along the route (mock = 0). */
  accidentPenalty: number;
  /** Multiplier applied to the 0..100 road-complexity score. */
  roadComplexityWeight: number;
}

export const DEFAULT_SCORING_WEIGHTS: RouteScoringWeights = {
  etaWeight: 1,             // 1 second of ETA = 1 score point
  trafficWeight: 6,         // 1 point of traffic = 6 score points
  intersectionPenalty: 25,  // every maneuver adds 25 points
  accidentPenalty: 0,       // accidents are mock-only in MVP
  roadComplexityWeight: 4,  // 1 point of complexity = 4 score points
};

/**
 * Per-strategy tuning. The "experimental" strategy deliberately over-weights
 * predicted traffic to demonstrate the AI-predictor path.
 */
export const STRATEGY_WEIGHT_OVERRIDES: Partial<Record<string, Partial<RouteScoringWeights>>> = {
  least_turns: { intersectionPenalty: 60 },   // punish maneuvers harder
  scenic: { roadComplexityWeight: 8, trafficWeight: 3 }, // prefer calm roads
  experimental: { trafficWeight: 10, etaWeight: 0.8 },   // AI-trust profile
};
