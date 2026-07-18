/**
 * Composition root.
 * ============================================================================
 * O único arquivo que liga implementações concretas às ports do domínio.
 *
 * Provedores ativos (modo produção):
 *   - TomTomClient          → cliente HTTP unificado
 *   - TomTomGeocodingService → GeocodingService (substitui Nominatim)
 *   - TomTomRoutingEngine    → RoutingEngine (substitui OSRM)
 *   - TomTomTrafficRepository→ TrafficRepository (substitui TrafficEngine simulado)
 *   - MockTrafficPredictor   → TrafficPredictor (slot de IA ainda é mock)
 *
 * Fallback automático: se TOMTOM_API_KEY não estiver definida, cai para os
 * providers simulados (TrafficEngine + OsrmRoutingEngine + Nominatim). Isso
 * permite rodar o MVP em ambientes sem chave sem quebrar nada.
 * ============================================================================
 */

import { TrafficEngine } from '@/server/application/services/traffic-engine.service';
import { RouteScoringService } from '@/server/application/services/route-scoring.service';
import { OsrmRoutingEngine } from '@/server/infrastructure/osrm/osrm-routing-engine';
import { NominatimGeocodingService } from '@/server/infrastructure/nominatim/nominatim-geocoder';
import { MockTrafficPredictor } from '@/server/infrastructure/predictor/mock-traffic-predictor';
import {
  TomTomClient,
  TomTomError,
} from '@/server/infrastructure/tomtom/tomtom-client';
import { TomTomGeocodingService } from '@/server/infrastructure/tomtom/tomtom-geocoding-service';
import { TomTomRoutingEngine } from '@/server/infrastructure/tomtom/tomtom-routing-engine';
import { TomTomTrafficRepository } from '@/server/infrastructure/tomtom/tomtom-traffic-repository';
import type {
  GeocodingService,
  RoutingEngine,
  TrafficPredictor,
  TrafficRepository,
} from '@/server/domain';

// --- Chave de API -------------------------------------------------------

/**
 * Lê a chave TomTom de várias fontes possíveis (Next.js server env,
 * Vercel env, .env local). Em runtime serverless só `process.env` é visível.
 */
function readTomTomKey(): string | null {
  const fromEnv = process.env.TOMTOM_API_KEY;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return null;
}

const TOMTOM_KEY = readTomTomKey();
export const USES_TOMTOM = TOMTOM_KEY !== null;

// --- Singletons ---------------------------------------------------------

/** Scorer — sempre o mesmo independente do provider. */
export const routeScorer = new RouteScoringService();

/**
 * Provider ativo de tráfego.
 *  - Se TomTom ativo: TomTomTrafficRepository (dados reais)
 *  - Caso contrário: TrafficEngine (simulação)
 */
export const trafficRepository: TrafficRepository = USES_TOMTOM
  ? new TomTomTrafficRepository(new TomTomClient(TOMTOM_KEY!))
  : new TrafficEngine();

/**
 * Provider ativo de roteamento.
 *  - Se TomTom ativo: TomTomRoutingEngine
 *  - Caso contrário: OsrmRoutingEngine (demo público)
 */
export const routingEngine: RoutingEngine = USES_TOMTOM
  ? new TomTomRoutingEngine(
      new TomTomClient(TOMTOM_KEY!),
      trafficRepository,
      routeScorer,
    )
  : new OsrmRoutingEngine(
      process.env.OSRM_ENDPOINT ?? 'https://router.project-osrm.org',
      trafficRepository,
      routeScorer,
    );

/**
 * Provider ativo de geocoding.
 *  - Se TomTom ativo: TomTomGeocodingService
 *  - Caso contrário: NominatimGeocodingService (OSM público)
 */
export const geocodingService: GeocodingService = USES_TOMTOM
  ? new TomTomGeocodingService(new TomTomClient(TOMTOM_KEY!))
  : new NominatimGeocodingService();

/**
 * Slot de IA — ainda é mock. Para plugar um modelo real, troque esta
 * única linha por uma implementação de `TrafficPredictor`.
 */
export const trafficPredictor: TrafficPredictor = new MockTrafficPredictor(
  // Se TomTom ativo, o predictor usa o traffic repository real.
  // Caso contrário, usa o TrafficEngine (que também implementa a port).
  trafficRepository as unknown as InstanceType<typeof TrafficEngine>,
);

// Reexporta erros para handlers de API usarem.
export { TomTomError };

/** Log informativo no startup do servidor. */
if (USES_TOMTOM) {
   
  console.log('[TrafficMind] Provider ativo: TomTom (dados reais)');
} else {
   
  console.warn(
    '[TrafficMind] TOMTOM_API_KEY não definida — usando providers simulados (OSRM + Nominatim + TrafficEngine).',
  );
}
