'use client';

import maplibregl, { Map as MaplibreMap, Marker, Popup } from 'maplibre-gl';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { GeoBounds, Route, TrafficReading } from '@/lib/navigation/types';
import { STRATEGY_META } from '@/lib/navigation/types';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';

/**
 * MapLibre tiles we use. DataDemuX is a free, no-key, dark OSM raster
 * provider; if it is rate-limited in your environment, swap for any
 * OSM-compatible tile URL (the contract is `{z}/{x}/{y}.png`).
 */
const DARK_TILES = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a> ' +
  '&copy; <a href="https://trafficmind.dev">TrafficMind</a>';

/** Default map center — São Paulo (Av. Paulista). */
const SP_CENTER: [number, number] = [-46.6563, -23.5613];

interface NavigationMapProps {
  traffic: TrafficReading[];
  onMapLongPress?: (coord: { lat: number; lng: number }) => void;
}

/**
 * NavigationMap
 * ----------------------------------------------------------------------------
 * The interactive MapLibre map. Responsibilities:
 *   - render the dark tile basemap
 *   - show the user's GPS location (with pulsing marker)
 *   - show the destination pin
 *   - render every calculated route as a separate layer
 *   - highlight the selected route
 *   - render traffic readings as colored dots
 *   - emit long-press events so the parent can drop a destination pin
 *
 * The map is intentionally "dumb" — it doesn't know about React Query. All
 * data arrives via props. The store only carries what the map needs to
 * react to (selected route id, origin, destination).
 */
export function NavigationMap({ traffic, onMapLongPress }: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const destMarkerRef = useRef<Marker | null>(null);
  const trafficMarkersRef = useRef<Array<{ marker: Marker; popup: Popup }>>([]);

  const origin = useNavigationStore((s) => s.origin);
  const destination = useNavigationStore((s) => s.destination);
  const routes = useNavigationStore((s) => s.routes);
  const selectedRouteId = useNavigationStore((s) => s.selectedRouteId);

  const [ready, setReady] = useState(false);

  // ----- map init (once) -------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-dark': {
            type: 'raster',
            tiles: [DARK_TILES],
            tileSize: 256,
            attribution: ATTRIBUTION,
            maxzoom: 20,
          },
        },
        layers: [
          {
            id: 'osm-dark-tiles',
            type: 'raster',
            source: 'osm-dark',
            minzoom: 0,
            maxzoom: 22,
            paint: {
              'raster-opacity': 0.96,
              'raster-contrast': 0.1,
              'raster-saturation': -0.2,
            },
          },
        ],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      },
      center: SP_CENTER,
      zoom: 13,
      pitch: 0,
      attributionControl: { compact: true },
      dragRotate: false,
      touchPitch: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      setReady(true);
    });

    // Long-press support — drop a destination pin.
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStart: { x: number; y: number } | null = null;
    const LONG_PRESS_MS = 450;
    const MOVE_TOLERANCE_PX = 8;

    map.on('mousedown', (e) => {
      pressStart = { x: e.point.x, y: e.point.y };
      pressTimer = setTimeout(() => {
        if (!pressStart) return;
        onMapLongPress?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        pressStart = null;
      }, LONG_PRESS_MS);
    });
    map.on('mousemove', (e) => {
      if (!pressStart) return;
      if (Math.abs(e.point.x - pressStart.x) > MOVE_TOLERANCE_PX || Math.abs(e.point.y - pressStart.y) > MOVE_TOLERANCE_PX) {
        if (pressTimer) clearTimeout(pressTimer);
        pressStart = null;
      }
    });
    map.on('mouseup', () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressStart = null;
    });
    // Touch variant for mobile.
    map.on('touchstart', (e) => {
      const t = e.originalEvent.touches[0];
      if (!t) return;
      pressStart = { x: t.clientX, y: t.clientY };
      pressTimer = setTimeout(() => {
        if (!pressStart) return;
        const lngLat = map.unproject([pressStart.x, pressStart.y]);
        onMapLongPress?.({ lat: lngLat.lat, lng: lngLat.lng });
        pressStart = null;
      }, LONG_PRESS_MS);
    });
    map.on('touchmove', (e) => {
      if (!pressStart) return;
      const t = e.originalEvent.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - pressStart.x) > MOVE_TOLERANCE_PX || Math.abs(t.clientY - pressStart.y) > MOVE_TOLERANCE_PX) {
        if (pressTimer) clearTimeout(pressTimer);
        pressStart = null;
      }
    });
    map.on('touchend', () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressStart = null;
    });

    mapRef.current = map;
    // Expose on window so the parent page can poll viewport bounds. MVP
    // shortcut — a ref-forwarding wrapper would be cleaner but adds boilerplate.
    (window as unknown as { __map?: MaplibreMap }).__map = map;

    return () => {
      map.remove();
      mapRef.current = null;
      delete (window as unknown as { __map?: MaplibreMap }).__map;
    };
     
  }, []);

  // ----- user marker -----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!origin) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div style="position: relative; width: 22px; height: 22px;">
          <div style="position:absolute; inset:0; border-radius:50%; background: oklch(0.78 0.15 195); opacity:0.3;" class="location-pulse"></div>
          <div style="position:absolute; inset:3px; border-radius:50%; background: oklch(0.78 0.15 195); border:3px solid white; box-shadow:0 0 12px oklch(0.78 0.15 195);"></div>
        </div>
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([origin.lng, origin.lat]);
    }

    // Fly to origin the first time we get a fix.
    if (map.getCenter().distanceTo(maplibregl.LngLat.convert(SP_CENTER)) < 1) {
      map.flyTo({ center: [origin.lng, origin.lat], zoom: 14, duration: 1200 });
    }
  }, [origin, ready]);

  // ----- destination marker ---------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!destination) {
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      return;
    }

    if (!destMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translateY(-6px);">
          <div style="width:32px; height:32px; border-radius:50% 50% 50% 0; background: oklch(0.75 0.18 75); transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.5);"></div>
        </div>
      `;
      destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map);
    } else {
      destMarkerRef.current.setLngLat([destination.lng, destination.lat]);
    }

    // Frame both origin (if any) and destination.
    if (origin) {
      // Calcula distância entre origem e destino.
      const dist = haversineMeters(origin, destination);

      // Lógica de zoom baseada em distância. fitBounds do MapLibre tem bugs
      // conhecidos com minZoom em bounds pequenos (ignora o constraint e
      // afasta até zoom 0, mostrando o mundo inteiro). Solução: calcular
      // o zoom manualmente baseado na distância haversine e fazer flyTo
      // para o centro do segmento.
      const midLat = (origin.lat + destination.lat) / 2;
      const midLng = (origin.lng + destination.lng) / 2;
      let zoom: number;
      if (dist < 500) zoom = 16;        // mesma rua
      else if (dist < 1500) zoom = 15;  // mesmo bairro
      else if (dist < 5000) zoom = 13;  // mesma cidade
      else if (dist < 20000) zoom = 12; // cidades vizinhas
      else if (dist < 60000) zoom = 10; // região metropolitana
      else if (dist < 200000) zoom = 8; // estado
      else zoom = 6;                     // país+

      map.flyTo({
        center: [midLng, midLat],
        zoom,
        duration: 800,
      });
    } else {
      map.flyTo({ center: [destination.lng, destination.lat], zoom: 14, duration: 800 });
    }
  }, [destination, origin, ready]);

  // ----- route layers ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Drop any previous route layers/sources.
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
      if (layer.id.startsWith('route-')) map.removeLayer(layer.id);
    }
    const sources = Object.keys(map.getStyle()?.sources ?? {});
    for (const src of sources) {
      if (src.startsWith('route-')) map.removeSource(src);
    }

    // Add every route. Drawn in reverse priority order so the selected one ends on top.
    const ordered = [...routes].sort((a, b) => {
      // selected last (top), recommended second-last, then by score
      const rank = (r: Route) => (r.id === selectedRouteId ? 2 : r.isRecommended ? 1 : 0);
      return rank(a) - rank(b);
    });

    for (const route of ordered) {
      const id = `route-${route.strategy}`;
      const isSelected = route.id === selectedRouteId;
      const meta = STRATEGY_META[route.strategy];

      map.addSource(id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.geometry.map((p) => [p.lng, p.lat]),
          },
          properties: {},
        },
      });

      // Halo / casing under the line for a polished look
      map.addLayer({
        id: `${id}-casing`,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0a0e14',
          'line-width': isSelected ? 10 : 6,
          'line-opacity': isSelected ? 0.85 : 0.5,
        },
      });
      map.addLayer({
        id: `${id}-line`,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': meta.color,
          'line-width': isSelected ? 6 : 3.5,
          'line-opacity': isSelected ? 1 : 0.65,
          'line-dasharray': route.strategy === 'experimental' ? [1.5, 1] : [1, 0],
        },
      });
    }
  }, [routes, selectedRouteId, ready]);

  // ----- traffic readings ----------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Clear previous traffic markers.
    for (const { marker, popup } of trafficMarkersRef.current) {
      marker.remove();
      popup.remove();
    }
    trafficMarkersRef.current = [];

    for (const reading of traffic) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 14px; height: 14px; border-radius: 50%;
        background: ${trafficColor(reading.level)};
        border: 2px solid rgba(255,255,255,0.6);
        box-shadow: 0 0 8px ${trafficColor(reading.level)};
        cursor: pointer;
      `;
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="font-family: var(--font-geist-sans, system-ui); padding: 4px 6px; min-width: 160px;">
           <div style="font-weight: 600; font-size: 13px; color: white;">${escapeHtml(reading.roadName)}</div>
           <div style="margin-top: 4px; display:flex; justify-content:space-between; font-size: 11px; color: rgba(255,255,255,0.7);">
             <span>Traffic</span><span style="color: ${trafficColor(reading.level)}; font-weight:600;">${reading.level}/100</span>
           </div>
           <div style="display:flex; justify-content:space-between; font-size: 11px; color: rgba(255,255,255,0.7);">
             <span>Speed</span><span style="color: white;">${reading.currentSpeed} km/h</span>
           </div>
         </div>`,
      );
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([reading.center.lng, reading.center.lat])
        .setPopup(popup)
        .addTo(map);
      trafficMarkersRef.current.push({ marker, popup });
    }
  }, [traffic, ready]);

  // ----- expose imperative flyTo for the parent --------------------------
  const flyTo = useCallback((lat: number, lng: number, zoom?: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom ?? 14, duration: 800 });
  }, []);

  // Expose via ref-like prop pattern by attaching to window for now (kept simple for MVP).
  useEffect(() => {
    (window as unknown as { __trafficmindFlyTo?: typeof flyTo }).__trafficmindFlyTo = flyTo;
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="Interactive navigation map"
      role="application"
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Distância em metros entre dois pontos WGS84 (fórmula de Haversine).
 * Usada para decidir entre fitBounds e flyTo quando origem e destino
 * estão muito próximos (evita o bug do "mapa do mundo inteiro").
 */
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function trafficColor(level: number): string {
  if (level < 30) return '#10b981'; // green
  if (level < 55) return '#f59e0b'; // amber
  if (level < 75) return '#f97316'; // orange
  return '#ef4444';                  // red
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

/** Helper for the parent to ask the map for the current viewport bounds. */
export function getMapBounds(map: MaplibreMap): GeoBounds | null {
  const b = map.getBounds();
  return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
}

/** Type-only export to keep `maplibregl` import used for the helper above. */
export type { MaplibreMap };
