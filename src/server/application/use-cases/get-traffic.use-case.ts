import type {
  GeoBounds,
  TrafficReading,
} from '@/server/domain';
import { trafficRepository } from '@/server/application/container';

/**
 * Use case: get current traffic for a map region.
 *
 * The controller calls this with the map's bounding box; the use case
 * delegates to the TrafficRepository (the Traffic Engine in MVP) and returns
 * the raw readings. Swapping the repository for a real feed changes nothing
 * here.
 */
export async function getTrafficForRegionUseCase(bounds: GeoBounds): Promise<TrafficReading[]> {
  return trafficRepository.getTrafficForRegion(bounds);
}
