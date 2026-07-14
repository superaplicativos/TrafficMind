import type {
  GeoCoordinate,
  GeocodingResult,
  GeocodingService,
} from '@/server/domain';

/**
 * NominatimGeocodingService
 * ============================================================================
 * Implements GeocodingService against the public OSM Nominatim endpoint.
 * Nominatim's usage policy requires a valid HTTP Referer / User-Agent; we set
 * a descriptive User-Agent and throttle to one request per keystroke group on
 * the client (debounce). For production deployments you should self-host
 * Nominatim or switch to Mapbox/Google via the same interface.
 * ============================================================================
 */
export class NominatimGeocodingService implements GeocodingService {
  constructor(
    private readonly endpoint = 'https://nominatim.openstreetmap.org',
    private readonly countryCodes = 'br', // bias toward Brazil — MVP focus
  ) {}

  async search(query: string): Promise<GeocodingResult[]> {
    const q = query.trim();
    if (q.length < 3) return [];

    const url = new URL(`${this.endpoint}/search`);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '6');
    if (this.countryCodes) url.searchParams.set('countrycodes', this.countryCodes);

    const res = await fetch(url, {
      headers: {
        // Nominatim policy requires a self-identifying UA / referer.
        'User-Agent': 'TrafficMind-MVP/1.0 (https://github.com/trafficmind)',
        'Accept-Language': 'pt-BR,en;q=0.8',
      },
      // next: { revalidate: 0 } would be valid in a route handler context.
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Nominatim search failed: ${res.status} ${res.statusText}`);
    }

    const items = (await res.json()) as NominatimPlace[];
    return items.map(this.toResult);
  }

  async reverse(coordinate: GeoCoordinate): Promise<GeocodingResult | null> {
    const url = new URL(`${this.endpoint}/reverse`);
    url.searchParams.set('lat', String(coordinate.lat));
    url.searchParams.set('lon', String(coordinate.lng));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');

    const res = await fetch(url, {
      headers: { 'User-Agent': 'TrafficMind-MVP/1.0 (https://github.com/trafficmind)' },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const place = (await res.json()) as NominatimPlace;
    return this.toResult(place);
  }

  private toResult = (p: NominatimPlace): GeocodingResult => ({
    label: p.display_name.split(',').slice(0, 2).join(',').trim(),
    secondary: p.display_name,
    coordinate: { lat: parseFloat(p.lat), lng: parseFloat(p.lon) },
    bbox: p.boundingbox
      ? [
          parseFloat(p.boundingbox[0]),
          parseFloat(p.boundingbox[1]),
          parseFloat(p.boundingbox[2]),
          parseFloat(p.boundingbox[3]),
        ]
      : undefined,
    osmId: p.osm_id != null ? `${p.osm_type}-${p.osm_id}` : undefined,
  });
}

interface NominatimPlace {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
}
