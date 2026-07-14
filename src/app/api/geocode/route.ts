import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchPlacesUseCase } from '@/server/application/use-cases/geocode.use-case';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/geocode?q=<query>
 * ----------------------------------------------------------------------------
 * Forward geocoding via OSM Nominatim. Returns up to 6 candidates biased
 * toward Brazil (the MVP focus). See NominatimGeocodingService for the
 * upstream contract.
 */
const QuerySchema = z.object({
  q: z.string().min(3).max(200),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const results = await searchPlacesUseCase(parsed.data.q);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: 'Geocoding failed', message: (err as Error).message },
      { status: 502 },
    );
  }
}
