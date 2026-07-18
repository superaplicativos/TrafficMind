/**
 * TomTomTrafficRepository
 * ============================================================================
 * Implementação de `TrafficRepository` (port do domínio) sobre TomTom Traffic
 * Flow + Traffic Incidents. Substitui o TrafficEngine simulado.
 *
 * Diferença vs simulação:
 *  - TrafficEngine: gera valores 0..100 deterministicamente por curva diária.
 *  - TomTomTrafficRepository: consulta velocidade real da via mais próxima
 *    e calcula `level` como `1 - (currentSpeed / freeFlowSpeed)`.
 *
 * Os dados são cacheados em memória por 30s para respeitar rate limits do
 * free tier (5 req/s, 25k req/dia) e evitar custos desnecessários.
 * ============================================================================
 */

import type { GeoBounds, TrafficReading, TrafficRepository } from '@/server/domain';
import type { TomTomClient } from './tomtom-client';

export class TomTomTrafficRepository implements TrafficRepository {
  private regionCache: { key: string; ts: number; readings: TrafficReading[] } | null = null;
  private readonly regionTtlMs = 30_000;

  private roadCache = new Map<string, { ts: number; reading: TrafficReading | null }>();
  private readonly roadTtlMs = 60_000;

  constructor(private readonly client: TomTomClient) {}

  async getTrafficForRegion(bounds: GeoBounds): Promise<TrafficReading[]> {
    const key = boundsKey(bounds);
    if (this.regionCache && this.regionCache.key === key && Date.now() - this.regionCache.ts < this.regionTtlMs) {
      return this.regionCache.readings;
    }
    const readings = await this.client.getFlowForRegion(bounds);
    this.regionCache = { key, ts: Date.now(), readings };
    return readings;
  }

  async getTrafficForRoad(roadId: string): Promise<TrafficReading | null> {
    const cached = this.roadCache.get(roadId);
    if (cached && Date.now() - cached.ts < this.roadTtlMs) return cached.reading;

    // roadId é "<lat>-<lng>" quando vem do routing engine. Reconstrói coord.
    const [latStr, lngStr] = roadId.split('-');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const reading = await this.client.getFlowAt({ lat, lng });
    this.roadCache.set(roadId, { ts: Date.now(), reading });
    return reading;
  }
}

function boundsKey(b: GeoBounds): string {
  return `${b.south.toFixed(3)},${b.west.toFixed(3)},${b.north.toFixed(3)},${b.east.toFixed(3)}`;
}
