import { NextResponse } from 'next/server';
import { USES_TOMTOM } from '@/server/application/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * ----------------------------------------------------------------------------
 * Liveness + readiness probe. Retorna qual provider de dados está ativo
 * para que o frontend e ferramentas de monitoria saibam se estão em modo
 * real (TomTom) ou simulado (OSRM/Nominatim/TrafficEngine).
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'trafficmind-api',
    version: '1.1.0-tomtom',
    timestamp: Date.now(),
    uptime: process.uptime(),
    provider: {
      routing: USES_TOMTOM ? 'tomtom' : 'osrm',
      geocoding: USES_TOMTOM ? 'tomtom' : 'nominatim',
      traffic: USES_TOMTOM ? 'tomtom-flow' : 'simulated',
      ai: 'mock',
    },
  });
}
