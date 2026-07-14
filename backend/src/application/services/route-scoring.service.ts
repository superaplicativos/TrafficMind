import { Injectable } from '@nestjs/common';
import type { Route, RouteStrategy } from '@/domain';

export interface RouteScoringWeights {
  etaWeight: number;
  trafficWeight: number;
  intersectionPenalty: number;
  accidentPenalty: number;
  roadComplexityWeight: number;
}

export const DEFAULT_SCORING_WEIGHTS: RouteScoringWeights = {
  etaWeight: 1,
  trafficWeight: 6,
  intersectionPenalty: 25,
  accidentPenalty: 0,
  roadComplexityWeight: 4,
};

const STRATEGY_OVERRIDES: Partial<Record<string, Partial<RouteScoringWeights>>> = {
  least_turns: { intersectionPenalty: 60 },
  scenic: { roadComplexityWeight: 8, trafficWeight: 3 },
  experimental: { trafficWeight: 10, etaWeight: 0.8 },
};

/**
 * RouteScoringService — NestJS reference mirror of the Next.js scorer.
 * The contract is identical; the only difference is that this one is
 * injectable via NestJS DI.
 */
@Injectable()
export class RouteScoringService {
  constructor(private readonly weights: RouteScoringWeights = DEFAULT_SCORING_WEIGHTS) {}

  score(route: Route): Route {
    const w = this.weightsFor(route.strategy);
    route.score = Math.round(
      route.duration * w.etaWeight +
      route.trafficLevel * w.trafficWeight +
      route.intersectionCount * w.intersectionPenalty +
      0 * w.accidentPenalty +
      route.roadComplexity * w.roadComplexityWeight,
    );
    return route;
  }

  rank(routes: Route[]): Route[] {
    const scored = routes.map((r) => this.score({ ...r }));
    scored.sort((a, b) => a.score - b.score);
    if (scored.length > 0) scored[0].isRecommended = true;
    return scored;
  }

  private weightsFor(strategy: RouteStrategy): RouteScoringWeights {
    return { ...this.weights, ...(STRATEGY_OVERRIDES[strategy] ?? {}) };
  }
}
