/**
 * TomTomGeocodingService
 * ============================================================================
 * Implementação de `GeocodingService` (port do domínio) sobre o TomTom Search.
 * Substitui o Nominatim. Mantém o mesmo contrato — quem consome a porta não
 * sabe (nem precisa saber) que agora é TomTom.
 * ============================================================================
 */

import type { GeocodingResult, GeocodingService, GeoCoordinate } from '@/server/domain';
import type { TomTomClient } from './tomtom-client';

export class TomTomGeocodingService implements GeocodingService {
  constructor(private readonly client: TomTomClient) {}

  search(query: string): Promise<GeocodingResult[]> {
    return this.client.search(query);
  }

  reverse(coordinate: GeoCoordinate): Promise<GeocodingResult | null> {
    return this.client.reverse(coordinate);
  }
}
