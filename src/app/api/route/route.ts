import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateRoutesUseCase } from '@/server/application/use-cases/calculate-routes.use-case';
import type { Route, RouteStrategy } from '@/server/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/route
 * ----------------------------------------------------------------------------
 * Body:
 *   {
 *     "origin":      { "lat": -23.5613, "lng": -46.6565 },
 *     "destination": { "lat": -23.5889, "lng": -46.7178 },
 *     "strategies":  ["fastest","shortest","scenic","least_turns","experimental"] // optional
 *   }
 *
 * Response:
 *   {
 *     "routes": Route[],
 *     "recommendedId": string,
 *     "generatedAt": number
 *   }
 *
 * Errors:
 *   400 — invalid body
 *   500 — upstream routing engine failure (still returns whatever we got)
 */
const RouteRequestSchema = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  strategies: z
    .array(
      z.enum(['fastest', 'shortest', 'scenic', 'least_turns', 'experimental']) as z.ZodEnum<[RouteStrategy, ...RouteStrategy[]]>,
    )
    .optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RouteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { origin, destination, strategies } = parsed.data;
  const routes = await calculateRoutesUseCase(origin, destination, strategies);
  const recommended = routes.find((r: Route) => r.isRecommended) ?? routes[0];

  return NextResponse.json({
    routes,
    recommendedId: recommended?.id ?? null,
    generatedAt: Date.now(),
  });
}

/** OPTIONS handler for CORS preflight. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
