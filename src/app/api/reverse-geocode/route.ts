import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reverseGeocodeUseCase } from '@/server/application/use-cases/geocode.use-case';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/reverse-geocode?lat=<lat>&lng=<lng>
 * ----------------------------------------------------------------------------
 * Convert a coordinate into a human-readable label (used when the user
 * long-presses the map to drop a destination pin).
 */
const QuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    lat: url.searchParams.get('lat'),
    lng: url.searchParams.get('lng'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const result = await reverseGeocodeUseCase(parsed.data);
  return NextResponse.json({ result });
}
