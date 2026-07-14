import { Injectable } from '@nestjs/common';
import type { GeoBounds, TrafficLevel, TrafficReading, TrafficRepository } from '@/domain';

interface RoadProfile {
  roadId: string;
  roadName: string;
  center: { lat: number; lng: number };
  freeFlowSpeed: number;
  peakLevel: number;
  morningPeakHour?: number;
}

const KNOWN_ROADS: RoadProfile[] = [
  { roadId: 'av-paulista',    roadName: 'Av. Paulista',          center: { lat: -23.5613, lng: -46.6565 }, freeFlowSpeed: 60, peakLevel: 82 },
  { roadId: 'marginal-pinh',  roadName: 'Marginal Pinheiros',    center: { lat: -23.5889, lng: -46.7178 }, freeFlowSpeed: 80, peakLevel: 90 },
  { roadId: 'marginal-tiete', roadName: 'Marginal Tietê',        center: { lat: -23.5189, lng: -46.6889 }, freeFlowSpeed: 80, peakLevel: 88 },
  { roadId: 'av-faria-lima',  roadName: 'Av. Faria Lima',        center: { lat: -23.5774, lng: -46.6890 }, freeFlowSpeed: 60, peakLevel: 80 },
  { roadId: 'r-jardins',      roadName: 'Jardins residential',   center: { lat: -23.5697, lng: -46.6639 }, freeFlowSpeed: 30, peakLevel: 30 },
  { roadId: 'av-23-maio',     roadName: 'Av. 23 de Maio',        center: { lat: -23.5547, lng: -46.6410 }, freeFlowSpeed: 60, peakLevel: 72 },
];

/**
 * TrafficEngine — NestJS mirror of the Next.js traffic simulator.
 * Implements TrafficRepository so it can be injected wherever the domain
 * port is required. Caches readings for 30s to keep region queries cheap.
 */
@Injectable()
export class TrafficEngine implements TrafficRepository {
  private cache: { ts: number; readings: TrafficReading[] } = { ts: 0, readings: [] };
  private readonly cacheTtlMs = 30_000;

  async getTrafficForRegion(_bounds: GeoBounds): Promise<TrafficReading[]> {
    const now = Date.now();
    if (now - this.cache.ts < this.cacheTtlMs && this.cache.readings.length > 0) {
      return this.cache.readings;
    }
    const readings = KNOWN_ROADS.map((p) => this.simulate(p, now));
    this.cache = { ts: now, readings };
    return readings;
  }

  async getTrafficForRoad(roadId: string): Promise<TrafficReading | null> {
    const profile = KNOWN_ROADS.find((r) => r.roadId === roadId);
    if (profile) return this.simulate(profile, Date.now());
    const level = this.hashLevel(roadId);
    return {
      roadId,
      roadName: roadId,
      center: { lat: -23.55, lng: -46.65 },
      level,
      freeFlowSpeed: 50,
      currentSpeed: Math.round(50 * (1 - level / 130)),
      timestamp: Date.now(),
    };
  }

  private simulate(p: RoadProfile, now: number): TrafficReading {
    const date = new Date(now);
    const hour = date.getHours() + date.getMinutes() / 60;
    const morningPeak = p.morningPeakHour ?? 8;
    const eveningPeak = morningPeak + 9;
    const morning = Math.exp(-Math.pow(hour - morningPeak, 2) / 2);
    const evening = Math.exp(-Math.pow(hour - eveningPeak, 2) / 2);
    const peakFactor = Math.max(morning, evening);
    const minFactor = 0.1;
    const dayLevel = p.peakLevel * (minFactor + (1 - minFactor) * peakFactor);
    const noise = Math.sin(now / 60_000 + this.hash(p.roadId)) * 4;
    const level = Math.max(0, Math.min(100, Math.round(dayLevel + noise))) as TrafficLevel;
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

  private hashLevel(id: string): TrafficLevel {
    return Math.max(0, Math.min(100, Math.round(20 + (Math.abs(this.hash(id)) % 60)))) as TrafficLevel;
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
