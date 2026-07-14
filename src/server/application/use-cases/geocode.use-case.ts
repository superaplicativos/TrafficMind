import type {
  GeoCoordinate,
  GeocodingResult,
} from '@/server/domain';
import { geocodingService } from '@/server/application/container';

/** Use case: forward geocode (search box → coordinates). */
export async function searchPlacesUseCase(query: string): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];
  return geocodingService.search(query.trim());
}

/** Use case: reverse geocode (map long-press → label). */
export async function reverseGeocodeUseCase(coordinate: GeoCoordinate): Promise<GeocodingResult | null> {
  return geocodingService.reverse(coordinate);
}
