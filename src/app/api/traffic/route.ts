import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTrafficForRegionUseCase } from '@/server/application/use-cases/get-traffic.use-case';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/traffic?south=&west=&north=&east=
 * ----------------------------------------------------------------------------
 * Returns the current simulated traffic readings that fall within (or near)
 * the requested bounding box. The MVP Traffic Engine caches readings for 30s
 * so this endpoint is cheap to poll.
 */
const QuerySchema = z.object({
  south: z.coerce.number(),
  west: z.coerce.number(),
  north: z.coerce.number(),
  east: z.coerce.number(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    south: url.searchParams.get('south'),
    west: url.searchParams.get('west'),
    north: url.searchParams.get('north'),
    east: url.searchParams.get('east'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid bounds', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const readings = await getTrafficForRegionUseCase(parsed.data);
  return NextResponse.json({ readings, generatedAt: Date.now() });
}
