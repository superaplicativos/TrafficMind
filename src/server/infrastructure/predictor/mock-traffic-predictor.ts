import type { TrafficPredictor, TrafficLevel } from '@/server/domain';
import type { TrafficEngine } from './traffic-engine.service';

/**
 * MockTrafficPredictor
 * ============================================================================
 * Reference implementation of the TrafficPredictor contract. It is NOT an AI
 * model — it returns deterministic, plausible values derived from the live
 * Traffic Engine. Its sole purpose is to occupy the AI slot in the
 * architecture so the rest of the system can be built and tested against a
 * stable interface.
 *
 * To plug a real ML model in:
 *   1. Implement `TrafficPredictor` (this file's import path is the only
 *      contract).
 *   2. Swap the binding in `src/server/application/container.ts`.
 * Nothing else — controller, scorer, frontend — needs to change.
 * ============================================================================
 */
export class MockTrafficPredictor implements TrafficPredictor {
  constructor(private readonly traffic: TrafficEngine) {}

  async predictRoadWeight(roadId: string): Promise<number> {
    const reading = await this.traffic.getTrafficForRoad(roadId);
    if (!reading) return 1;
    // Weight = 1.0 at free-flow, up to ~3.0 at gridlock.
    return 1 + (reading.level / 100) * 2;
  }

  async predictCongestion(roadId: string, horizonMinutes: number): Promise<TrafficLevel> {
    const reading = await this.traffic.getTrafficForRoad(roadId);
    if (!reading) return 30;
    // Crude "drift" model: small oscillation with horizon.
    const drift = Math.sin(horizonMinutes / 15) * 5;
    const base = reading.level + drift;
    return Math.max(0, Math.min(100, Math.round(base))) as TrafficLevel;
  }

  async predictETA(route: { geometry: { lat: number; lng: number }[]; distance: number }): Promise<number> {
    // Distance (m) / assumed average speed (km/h). Predicted traffic knocks
    // average speed down — this is where the future model shines.
    const avgSpeedKmh = 35;
    const seconds = (route.distance / 1000) * (3600 / avgSpeedKmh);
    return Math.round(seconds);
  }
}
