import type { GeoBounds, TrafficLevel, TrafficReading } from '@/server/domain';

/**
 * RoadProfile
 * ----------------------------------------------------------------------------
 * A named arterial road that the simulated city "knows about". The Traffic
 * Engine interpolates a realistic congestion level for each profile based on
 * the time of day, then layers on deterministic noise so the map looks alive.
 */
interface RoadProfile {
  roadId: string;
  roadName: string;
  center: { lat: number; lng: number };
  /** Free-flow speed in km/h. */
  freeFlowSpeed: number;
  /**
   * Baseline congestion at the morning peak (08:00 local). 0..100.
   * Used as the amplitude of a sine curve over the day.
   */
  peakLevel: number;
  /**
   * Hour offset of the morning peak. Afternoon peak is assumed to be +9h.
   * Default 8 (08:00).
   */
  morningPeakHour?: number;
}

/**
 * A small but representative catalog of São Paulo arterials. These are real
 * coordinates so the map looks credible when the user pans around Av. Paulista.
 * The Traffic Engine is not limited to this list — it falls back to a
 * deterministic hash for any unknown road id.
 */
const KNOWN_ROADS: RoadProfile[] = [
  { roadId: 'av-paulista',    roadName: 'Av. Paulista',          center: { lat: -23.5613, lng: -46.6565 }, freeFlowSpeed: 60, peakLevel: 82 },
  { roadId: 'marginal-pinh',  roadName: 'Marginal Pinheiros',    center: { lat: -23.5889, lng: -46.7178 }, freeFlowSpeed: 80, peakLevel: 90 },
  { roadId: 'marginal-tiete', roadName: 'Marginal Tietê',        center: { lat: -23.5189, lng: -46.6889 }, freeFlowSpeed: 80, peakLevel: 88 },
  { roadId: 'av-rebolucas',   roadName: 'Av. Rebouças',          center: { lat: -23.5641, lng: -46.6929 }, freeFlowSpeed: 50, peakLevel: 78 },
  { roadId: 'av-faria-lima',  roadName: 'Av. Faria Lima',        center: { lat: -23.5774, lng: -46.6890 }, freeFlowSpeed: 60, peakLevel: 80 },
  { roadId: 'av-luis-carlos', roadName: 'Av. Luís Carlos Berrini', center: { lat: -23.6012, lng: -46.6921 }, freeFlowSpeed: 50, peakLevel: 75 },
  { roadId: 'r-nova-cidade',  roadName: 'Small streets (Itaim)', center: { lat: -23.5812, lng: -46.6831 }, freeFlowSpeed: 30, peakLevel: 25 },
  { roadId: 'r-jardins',      roadName: 'Jardins residential',   center: { lat: -23.5697, lng: -46.6639 }, freeFlowSpeed: 30, peakLevel: 30 },
  { roadId: 'minhocao',       roadName: 'Minhocão (elevated)',   center: { lat: -23.5417, lng: -46.6619 }, freeFlowSpeed: 70, peakLevel: 60 },
  { roadId: 'av-23-maio',     roadName: 'Av. 23 de Maio',        center: { lat: -23.5547, lng: -46.6410 }, freeFlowSpeed: 60, peakLevel: 72 },
  { roadId: 'av-d-pedro1',    roadName: 'Av. Dom Pedro I',       center: { lat: -23.5275, lng: -46.6028 }, freeFlowSpeed: 50, peakLevel: 65 },
  { roadId: 'r- Augusta',     roadName: 'R. Augusta',            center: { lat: -23.5563, lng: -46.6630 }, freeFlowSpeed: 30, peakLevel: 55 },
];

/**
 * TrafficEngine
 * ============================================================================
 * The MVP traffic source. It deterministically simulates congestion for a
 * catalog of known roads and falls back to a stable hash for unknown road
 * ids. The output of this class flows into:
 *   - the RouteScoringService (via TrafficRepository)
 *   - the map's traffic overlay
 *   - the MockTrafficPredictor (which adds time-shifted noise)
 *
 * Replacing this class with a real feed (city cameras, Waze CSV, etc.) is a
 * drop-in operation: it implements TrafficRepository and the consumers never
 * need to change.
 * ============================================================================
 */
export class TrafficEngine {
  /** In-memory cache so repeated region queries are cheap. */
  private cache: { ts: number; readings: TrafficReading[] } = { ts: 0, readings: [] };
  private readonly cacheTtlMs = 30_000; // 30s — the simulation is "live"

  constructor(private readonly clock: () => number = Date.now) {}

  /**
   * Simulate traffic for a region. The MVP ignores the bounds for filtering
   * (we only have ~12 known roads, all in São Paulo) but the contract is
   * preserved so future implementations can spatially filter.
   */
  async getTrafficForRegion(_bounds: GeoBounds): Promise<TrafficReading[]> {
    const now = this.clock();
    if (now - this.cache.ts < this.cacheTtlMs && this.cache.readings.length > 0) {
      return this.cache.readings;
    }
    const readings = KNOWN_ROADS.map((p) => this.simulate(p, now));
    this.cache = { ts: now, readings };
    return readings;
  }

  async getTrafficForRoad(roadId: string): Promise<TrafficReading | null> {
    const profile = KNOWN_ROADS.find((r) => r.roadId === roadId);
    if (profile) return this.simulate(profile, this.clock());
    // Unknown road: synthesise a stable pseudo-reading so scoring still works.
    const level = this.hashLevel(roadId, this.clock());
    return {
      roadId,
      roadName: roadId,
      center: { lat: -23.55, lng: -46.65 },
      level,
      freeFlowSpeed: 50,
      currentSpeed: Math.round(50 * (1 - level / 130)),
      timestamp: this.clock(),
    };
  }

  /**
   * Convert a (roadProfile, timestamp) into a believable traffic reading.
   *
   * The model is a simple bimodal day curve (morning + evening peak) plus a
   * small deterministic sinusoidal noise term keyed off the road id, so the
   * same minute always yields the same level for the same road. This keeps
   * the simulation stable enough to reason about but lively enough to look
   * real on the map.
   */
  private simulate(p: RoadProfile, now: number): TrafficReading {
    const date = new Date(now);
    const hour = date.getHours() + date.getMinutes() / 60;

    const morningPeak = p.morningPeakHour ?? 8;
    const eveningPeak = morningPeak + 9;

    const morning = Math.exp(-Math.pow(hour - morningPeak, 2) / 2);
    const evening = Math.exp(-Math.pow(hour - eveningPeak, 2) / 2);
    const peakFactor = Math.max(morning, evening);

    // Late-night minimum (03:00) drops to ~10% of peak.
    const minFactor = 0.1;

    const dayLevel = p.peakLevel * (minFactor + (1 - minFactor) * peakFactor);

    // Deterministic noise — same minute, same level.
    const noise = Math.sin(now / 60_000 + this.hash(p.roadId)) * 4;

    const level = clamp(Math.round(dayLevel + noise), 0, 100) as TrafficLevel;
    const currentSpeed = Math.max(8, Math.round(p.freeFlowSpeed * (1 - level / 130)));

    return {
      roadId: p.roadId,
      roadName: p.roadName,
      center: p.center,
      level,
      freeFlowSpeed: p.freeFlowSpeed,
      currentSpeed,
      timestamp: now,
    };
  }

  /** Stable 0..100 hash for any string. Used to seed per-road noise. */
  private hashLevel(id: string, ts: number): TrafficLevel {
    return clamp(Math.round(20 + (Math.abs(this.hash(id) + ts / 3_600_000) % 60)), 0, 100) as TrafficLevel;
  }

  private hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
