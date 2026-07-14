'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useGeolocation
 * ----------------------------------------------------------------------------
 * Wraps the browser Geolocation API in a React-friendly subscription.
 * - `permission` reflects the current permission state.
 * - `position` is the latest fix (or null).
 * - `error` captures errors (denied, unavailable, timeout).
 * - `request()` triggers an explicit permission prompt when called by a user
 *   gesture (e.g. tapping the "locate me" button).
 *
 * The hook keeps the watch alive across re-renders and tears it down on
 * unmount.
 */
export interface GeoState {
  position: { lat: number; lng: number; accuracy: number; heading: number | null } | null;
  permission: PermissionState | 'unknown';
  error: string | null;
  request: () => void;
}

const isClient = typeof navigator !== 'undefined';
const hasGeo = isClient && !!navigator.geolocation;

export function useGeolocation(options?: PositionOptions): GeoState {
  const [position, setPosition] = useState<GeoState['position']>(null);
  const [permission, setPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [error, setError] = useState<string | null>(hasGeo ? null : 'Geolocation not supported by this browser.');
  const watchId = useRef<number | null>(null);

  const stopWatch = useCallback(() => {
    if (watchId.current != null && hasGeo) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!hasGeo) return;
    if (watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        });
      },
      (err) => {
        setError(err.message);
        if (err.code === err.PERMISSION_DENIED) setPermission('denied');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 10_000,
        ...options,
      },
    );
  }, [options]);

  useEffect(() => {
    if (!hasGeo) return;

    // Best-effort permission probe (Firefox < 46 falls back gracefully).
    if (navigator.permissions) {
      let active = true;
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((p) => {
          if (!active) return;
          setPermission(p.state);
          p.onchange = () => setPermission(p.state);
        })
        .catch(() => {
          /* some browsers reject the query — ignore */
        });
    }

    startWatch();
    return () => stopWatch();
  }, [startWatch, stopWatch]);

  const request = useCallback(() => {
    setError(null);
    stopWatch();
    startWatch();
  }, [startWatch, stopWatch]);

  return { position, permission, error, request };
}
