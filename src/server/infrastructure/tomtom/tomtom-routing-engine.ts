/**
 * TomTomRoutingEngine
 * ============================================================================
 * Implementação de `RoutingEngine` (port do domínio) sobre o TomTom Routing.
 * Substitui o OsrmRoutingEngine. A principal mudança arquitetural:
 *
 *  - OSRM calculava UMA geometria e a replicávamos para 5 estratégias com
 *    pesos diferentes (honesto sobre a limitação do demo público).
 *  - TomTom calcula CINCO geometrias reais, uma por estratégia, porque o
 *    TomTom suporta `routeType` distintos (fastest, shortest, eco) e parâmetros
 *    `avoid` reais. As rotas agora são genuinamente diferentes no mapa.
 *
 * O enrichment (tráfego, complexidade, combustível, score) é centralizado no
 * `RouteScoringService` e no `TrafficRepository` — não muda nada.
 * ============================================================================
 */

import type {
  GeoCoordinate,
  Route,
  RouteStrategy,
  RoutingEngine,
  TrafficRepository,
} from '@/server/domain';
import type { RouteScoringService } from '@/server/application/services/route-scoring.service';
import type { TomTomClient } from './tomtom-client';

export class TomTomRoutingEngine implements RoutingEngine {
  constructor(
    private readonly client: TomTomClient,
    private readonly traffic: TrafficRepository,
    private readonly scorer: RouteScoringService,
  ) {}

  async calculateRoutes(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    strategies: RouteStrategy[],
  ): Promise<Route[]> {
    // 1. Calcula as 5 rotas em paralelo (TomTom suporta paralelismo dentro
    //    do rate limit do free tier: 5 req/s).
    const routes = await this.client.calculateRoutes(origin, destination, strategies);

    if (routes.length === 0) return [];

    // 2. Enriquece cada rota com o nível de trânsito real do TrafficRepository.
    //    Como o TomTom já devolve `trafficDelayInSeconds` no summary, o
    //    `trafficLevel` já vem preenchido — mas reconfirmamos com o flow real
    //    da região para dar robustez (fallback se a rota não tiver delay).
    const enriched = await Promise.all(
      routes.map(async (r) => {
        if (r.trafficLevel === 0 && r.geometry.length > 0) {
          // Amostra no midpoint da rota.
          const mid = r.geometry[Math.floor(r.geometry.length / 2)];
          const reading = await this.traffic.getTrafficForRoad(
            `${mid.lat.toFixed(4)}-${mid.lng.toFixed(4)}`,
          ).catch(() => null);
          if (reading) {
            return { ...r, trafficLevel: reading.level };
          }
        }
        return r;
      }),
    );

    // 3. Aplica o scorer (score composto + ranking + recomendação).
    return this.scorer.rank(enriched);
  }
}
