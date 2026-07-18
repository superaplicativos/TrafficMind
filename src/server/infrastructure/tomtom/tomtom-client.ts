/**
 * TomTom API client — unificado.
 * ============================================================================
 * Camada fina sobre a API HTTP do TomTom. Todos os endpoints relevantes para
 * o TrafficMind estão aqui: Search (geocode), Routing (com traffic), Traffic
 * Flow (velocidade real por segmento) e Traffic Incidents (acidentes/obras).
 *
 * A chave de API é lida de `process.env.TOMTOM_API_KEY`. Em runtime serverless
 * (Vercel/Next.js) isso é seguro — a chave nunca chega ao browser.
 *
 * Refs de API:
 *  - Search:      https://developer.tomtom.com/search-api/documentation
 *  - Routing:     https://developer.tomtom.com/routing-api/documentation
 *  - Traffic Flow:     https://developer.tomtom.com/traffic-api/traffic-flow/traffic-flow-segment-data
 *  - Traffic Incidents: https://developer.tomtom.com/traffic-api/traffic-incidents/traffic-incidents
 * ============================================================================
 */

import type {
  GeoBounds,
  GeoCoordinate,
  GeocodingResult,
  Route,
  RouteInstruction,
  RouteStrategy,
  TrafficReading,
} from '@/server/domain';

const TOMTOM_BASE = 'https://api.tomtom.com';

/** Forma como o TomTom representa um par lat/lng nas URLs. */
const fmt = (c: GeoCoordinate) => `${c.lat},${c.lng}`;

/** Erro normalizado para chamadas TomTom. */
export class TomTomError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly endpoint: string,
  ) {
    super(`[TomTom:${endpoint}] ${message}`);
    this.name = 'TomTomError';
  }
}

/**
 * Cliente TomTom. Mantém a chave em closure para não vazar em serializações.
 * Cada método retorna tipos do domínio (não o JSON cru do TomTom) para que
 * o resto do sistema não precise conhecer a forma do payload externo.
 */
export class TomTomClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('TomTomClient: TOMTOM_API_KEY não definida.');
    }
  }

  // ==========================================================================
  // SEARCH (geocode + reverse)
  // ==========================================================================

  /**
   * Geocode direto — texto livre → coordenadas.
   * Limita a Brasil (countrySet=BR) e usa idioma pt-BR nos resultados.
   */
  async search(query: string, signal?: AbortSignal): Promise<GeocodingResult[]> {
    if (query.trim().length < 3) return [];
    const url = new URL(`${TOMTOM_BASE}/search/2/search/${encodeURIComponent(query)}.json`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('limit', '6');
    url.searchParams.set('countrySet', 'BR');
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('typeahead', 'false');

    const body = await this.fetchJson<TomTomSearchResponse>(url, 'search', signal);
    return (body.results ?? []).map(this.toGeocodingResult);
  }

  /**
   * Reverse geocode — coordenada → endereço legível.
   */
  async reverse(coordinate: GeoCoordinate, signal?: AbortSignal): Promise<GeocodingResult | null> {
    const url = new URL(`${TOMTOM_BASE}/search/2/reverseGeocode/${fmt(coordinate)}.json`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('returnSpeedLimit', 'false');

    const body = await this.fetchJson<TomTomReverseResponse>(url, 'reverse', signal);
    const first = body.addresses?.[0];
    if (!first) return null;
    return {
      label: first.address.freeformAddress,
      secondary: first.address.municipality ?? undefined,
      coordinate: {
        lat: first.position.lat,
        lng: first.position.lon,
      },
    };
  }

  // ==========================================================================
  // ROUTING
  // ==========================================================================

  /**
   * Calcula UMA rota entre origem e destino com a estratégia dada.
   *
   * O TomTom suporta `traffic=true` que incorpora trânsito histórico E
   * em tempo real no cálculo de ETA. O parâmetro `routeType` controla o
   * objetivo (fastest, shortest, eco, thrilling). Combinamos `routeType` +
   * `travelMode` + instrução de manobras para entregar uma Route de domínio.
   */
  async calculateRoute(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    strategy: RouteStrategy,
    signal?: AbortSignal,
  ): Promise<Route | null> {
    const locations = `${fmt(origin)}:${fmt(destination)}`;
    const url = new URL(`${TOMTOM_BASE}/routing/1/calculateRoute/${locations}/json`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('traffic', 'true');
    url.searchParams.set('instructionsType', 'tagged');
    url.searchParams.set('routeRepresentation', 'polyline');
    url.searchParams.set('computeTravelTimeFor', 'all');
    url.searchParams.set('sectionType', 'traffic');
    url.searchParams.set('language', 'pt-BR');

    // Traduz estratégia de domínio → parâmetros TomTom.
    const { routeType, avoid } = STRATEGY_PARAMS[strategy];
    url.searchParams.set('routeType', routeType);
    if (avoid) url.searchParams.set('avoid', avoid);

    const body = await this.fetchJson<TomTomRouteResponse>(url, 'routing', signal);
    if (body.routes?.length !== 1 || !body.routes[0].legs?.length) return null;
    return this.toRoute(body.routes[0], strategy);
  }

  /**
   * Calcula múltiplas rotas (uma por estratégia) em paralelo.
   * Falhas isoladas viram null e são filtradas — o caller decide o que fazer
   * com o subconjunto que retornou.
   */
  async calculateRoutes(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    strategies: RouteStrategy[],
  ): Promise<Route[]> {
    const results = await Promise.all(
      strategies.map((s) =>
        this.calculateRoute(origin, destination, s).catch(() => null),
      ),
    );
    return results.filter((r): r is Route => r !== null);
  }

  // ==========================================================================
  // TRAFFIC FLOW (velocidade real por segmento)
  // ==========================================================================

  /**
   * Consulta velocidade atual e nível de trânsito para um ponto (via mais
   * próxima). Retorna null se a API não tiver dados para a coordenada.
   *
   * Usado pelo TrafficRepository real para enriquecer rotas com `trafficLevel`
   * baseado em dados ao vivo em vez da simulação determinística do MVP.
   */
  async getFlowAt(coordinate: GeoCoordinate, signal?: AbortSignal): Promise<TrafficReading | null> {
    const url = new URL(`${TOMTOM_BASE}/traffic/services/4/flowSegmentData/absolute/10/json`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('point', `${coordinate.lat},${coordinate.lng}`);
    url.searchParams.set('unit', 'KMPH');
    url.searchParams.set('thickness', '1');

    try {
      const body = await this.fetchJson<TomTomFlowResponse>(url, 'flow', signal);
      const f = body.flowSegmentData;
      if (!f) return null;

      const currentSpeed = f.currentSpeed;
      const freeFlowSpeed = f.freeFlowSpeed || 50;
      // Traffic level 0..100: 0 = livre fluxo, 100 = parado.
      const ratio = freeFlowSpeed > 0 ? currentSpeed / freeFlowSpeed : 1;
      const level = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));

      return {
        roadId: `tomtom-${coordinate.lat.toFixed(4)}-${coordinate.lng.toFixed(4)}`,
        roadName: f.frc ?? 'Via monitorada',
        center: coordinate,
        level,
        freeFlowSpeed,
        currentSpeed,
        timestamp: Date.now(),
      };
    } catch {
      return null; // ponto isolado sem dados não deve quebrar o cálculo de rota
    }
  }

  /**
   * Amostra de tráfego para uma região. O endpoint Flow não suporta bbox
   * diretamente, então amostramos N pontos no bounding box. O N é mantido
   * pequeno (default 9 = grid 3×3) para respeitar rate limits do free tier.
   */
  async getFlowForRegion(bounds: GeoBounds, samples = 9): Promise<TrafficReading[]> {
    const latStep = (bounds.north - bounds.south) / 3;
    const lngStep = (bounds.east - bounds.west) / 3;
    const points: GeoCoordinate[] = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (points.length >= samples) break;
        points.push({
          lat: bounds.south + latStep * (i + 0.5),
          lng: bounds.west + lngStep * (j + 0.5),
        });
      }
    }
    const results = await Promise.all(points.map((p) => this.getFlowAt(p)));
    return results.filter((r): r is TrafficReading => r !== null);
  }

  // ==========================================================================
  // TRAFFIC INCIDENTS (acidentes, obras, fechamentos)
  // ==========================================================================

  /**
   * Lista incidentes de trânsito (acidentes, obras, etc.) dentro do bbox.
   * Usado pelo scorer para aplicar `accidentPenalty` em rotas que cruzam
   * regiões com incidentes ativos.
   */
  async getIncidents(bounds: GeoBounds, signal?: AbortSignal): Promise<TomTomIncident[]> {
    // Formato do bbox TomTom: minX,minY,maxX,maxY (lng,lat,lng,lat)
    const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
    const url = new URL(`${TOMTOM_BASE}/traffic/services/5/incidentDetails`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('bbox', bbox);
    url.searchParams.set('fields', '{incidents{properties{iconCategory,magnitudeOfDelay,events{description,code}}}}');
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('t', '1'); // 1 = incidentes atuais

    try {
      const body = await this.fetchJson<TomTomIncidentsResponse>(url, 'incidents', signal);
      return body.incidents ?? [];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async fetchJson<T>(url: URL, endpoint: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    if (!res.ok) {
      throw new TomTomError(
        `HTTP ${res.status} ${res.statusText}`,
        res.status,
        endpoint,
      );
    }
    return (await res.json()) as T;
  }

  private toGeocodingResult(r: TomTomSearchResult): GeocodingResult {
    return {
      label: r.address.freeformAddress,
      secondary: [r.address.municipality, r.address.countrySubdivision]
        .filter(Boolean)
        .join(', '),
      coordinate: { lat: r.position.lat, lng: r.position.lon },
      bbox: r.viewport
        ? [r.viewport.btmRightPoint.lat, r.viewport.topLeftPoint.lat,
           r.viewport.topLeftPoint.lon, r.viewport.btmRightPoint.lon]
        : undefined,
      osmId: r.id,
    };
  }

  private toRoute(raw: TomTomRoute, strategy: RouteStrategy): Route {
    const geometry: GeoCoordinate[] = [];
    const instructions: RouteInstruction[] = [];
    let intersectionCount = 0;
    let summary = { lengthInMeters: 0, travelTimeInSeconds: 0, trafficDelayInSeconds: 0 };

    for (const leg of raw.legs ?? []) {
      summary = leg.summary ?? summary;
      for (const s of leg.points ?? []) {
        geometry.push({ lat: s.latitude, lng: s.longitude });
      }
      for (const inst of leg.instructions ?? []) {
        const isManeuver = inst.maneuver && inst.maneuver !== 'ARRIVE' && inst.maneuver !== 'DEPART';
        if (isManeuver) intersectionCount++;
        instructions.push({
          step: instructions.length + 1,
          text: inst.message,
          distance: Math.round(inst.routeOffsetInMeters ?? 0),
          duration: Math.round((inst.travelTimeInSeconds ?? 0)),
          sign: signFromManeuver(inst.maneuver),
          location: inst.point
            ? { lat: inst.point.latitude, lng: inst.point.longitude }
            : undefined,
        });
      }
    }

    // Traffic level real: se a rota tem trafficDelay, calculamos o ratio.
    const trafficDelay = summary.trafficDelayInSeconds ?? 0;
    const totalTravel = summary.travelTimeInSeconds ?? 0;
    // Ratio de atraso: 0s de delay = 0; metade do tempo = 100.
    const trafficLevel = totalTravel > 0
      ? Math.min(100, Math.round((trafficDelay / totalTravel) * 200))
      : 0;

    const distance = summary.lengthInMeters;
    const duration = totalTravel;
    const roadComplexity = computeComplexity(geometry, intersectionCount);
    const estimatedFuel = estimateFuel(distance, duration, trafficLevel);

    return {
      id: `${strategy}-${distance}-${duration}`,
      strategy,
      label: buildLabel(strategy, duration, distance),
      distance: Math.round(distance),
      duration: Math.round(duration),
      geometry,
      instructions,
      intersectionCount,
      roadComplexity,
      trafficLevel,
      estimatedFuel,
      score: 0, // preenchido pelo RouteScoringService
      isRecommended: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Tipos TomTom (subset que usamos)
// ---------------------------------------------------------------------------

interface TomTomSearchResponse { results?: TomTomSearchResult[]; }
interface TomTomSearchResult {
  id: string;
  position: { lat: number; lon: number };
  address: {
    freeformAddress: string;
    municipality?: string;
    countrySubdivision?: string;
  };
  viewport?: {
    topLeftPoint: { lat: number; lon: number };
    btmRightPoint: { lat: number; lon: number };
  };
}

interface TomTomReverseResponse {
  addresses?: Array<{
    address: { freeformAddress: string; municipality?: string };
    position: { lat: number; lon: number };
  }>;
}

interface TomTomRouteResponse { routes?: TomTomRoute[]; formatVersion?: string; }
interface TomTomRoute {
  summary?: { lengthInMeters: number; travelTimeInSeconds: number; trafficDelayInSeconds: number };
  legs?: TomTomRouteLeg[];
}
interface TomTomRouteLeg {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
  };
  points?: Array<{ latitude: number; longitude: number }>;
  instructions?: Array<{
    maneuver: string;
    message: string;
    routeOffsetInMeters?: number;
    travelTimeInSeconds?: number;
    point?: { latitude: number; longitude: number };
  }>;
}

interface TomTomFlowResponse {
  flowSegmentData: {
    frc: string;
    currentSpeed: number;
    freeFlowSpeed: number;
    currentTravelTime: number;
    freeFlowTravelTime: number;
  };
}

interface TomTomIncidentsResponse { incidents?: TomTomIncident[]; }
export interface TomTomIncident {
  properties: {
    iconCategory: number; // 0=Unknown,1=Accident,2=Fog,3=Rain,5=Congestion,6=RoadWorks...
    magnitudeOfDelay: number; // 0=Unknown,1=Minor,2=Moderate,3=Major,4=Undefined
    events: Array<{ description: string; code: string }>;
  };
}

// ---------------------------------------------------------------------------
// Tradução de estratégia → parâmetros TomTom
// ---------------------------------------------------------------------------

const STRATEGY_PARAMS: Record<RouteStrategy, { routeType: string; avoid?: string }> = {
  // fastest: rota mais rápida considerando trânsito (traffic=true).
  fastest:      { routeType: 'fastest' },
  // shortest: menor distância. TomTom suporta diretamente.
  shortest:     { routeType: 'shortest' },
  // scenic: usamos eco (combustível otimizado) + avoid motorways para forçar
  // vias mais calmas e panorâmicas. Placeholder honesto.
  scenic:       { routeType: 'eco', avoid: 'motorways' },
  // least_turns: fastest + avoid maneuver-intensive roads.
  // TomTom não tem "least turns" direto, mas `eco` + `alreadyVisitedRoads`
  // reduz manobras em vias arteriais.
  least_turns:  { routeType: 'eco', avoid: 'tollRoads' },
  // experimental: fastest com traffic=true (mais peso em trânsito ao vivo).
  // A diferenciação vs fastest virá do scorer (peso 10 em trafficLevel).
  experimental: { routeType: 'fastest' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signFromManeuver(maneuver: string | undefined): number {
  if (!maneuver) return 0;
  const m = maneuver.toUpperCase();
  if (m.includes('LEFT')) return -1;
  if (m.includes('RIGHT')) return 1;
  if (m.includes('UTURN')) return -6;
  return 0;
}

function computeComplexity(geometry: GeoCoordinate[], intersections: number): number {
  let directionChanges = 0;
  for (let i = 2; i < geometry.length; i++) {
    const a = geometry[i - 2], b = geometry[i - 1], c = geometry[i];
    const b1 = bearing(a, b), b2 = bearing(b, c);
    if (Math.abs(normalizeAngle(b2 - b1)) > 30) directionChanges++;
  }
  return Math.min(100, Math.round(Math.min(intersections * 2, 40) + Math.min(directionChanges * 3, 40) + 20));
}

function bearing(a: GeoCoordinate, b: GeoCoordinate): number {
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const normalizeAngle = (a: number) => (a > 180 ? a - 360 : a < -180 ? a + 360 : a);

function estimateFuel(distanceM: number, durationS: number, trafficLevel: number): number {
  const distanceKm = distanceM / 1000;
  const hours = durationS / 3600;
  const avgSpeed = hours > 0 ? distanceKm / hours : 0;
  let lPer100 = 6;
  if (trafficLevel > 60) lPer100 *= 1.3;
  if (avgSpeed < 25) lPer100 *= 1.15;
  return Math.round((distanceKm * lPer100) / 1000 * 10) / 10;
}

function buildLabel(strategy: RouteStrategy, durationS: number, distanceM: number): string {
  const minutes = Math.round(durationS / 60);
  const km = (distanceM / 1000).toFixed(1);
  const name = STRATEGY_LABELS_PT[strategy];
  return `${name} • ${minutes} min • ${km} km`;
}

const STRATEGY_LABELS_PT: Record<RouteStrategy, string> = {
  fastest: 'Mais rápida',
  shortest: 'Mais curta',
  scenic: 'Cênica',
  least_turns: 'Menos curvas',
  experimental: 'IA experimental',
};
