import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * ----------------------------------------------------------------------------
 * Liveness + readiness probe for docker-compose. Returns 200 if the Node
 * process is up; downstream services (postgres, redis, osrm) are checked
 * lazily by their first request, not here, to keep this cheap.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'trafficmind-api',
    version: '1.0.0-mvp',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
}
