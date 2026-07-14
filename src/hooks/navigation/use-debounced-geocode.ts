'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { geocode } from '@/lib/navigation/api';

/**
 * useDebouncedGeocode
 * ----------------------------------------------------------------------------
 * Debounced forward-geocoding hook for the search box. Returns:
 *   - `query` / `setQuery` for the controlled input
 *   - `results` from Nominatim
 *   - `isFetching` while the request is in flight
 *   - `clear` to reset
 */
export function useDebouncedGeocode(delayMs = 350) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), delayMs);
    return () => clearTimeout(t);
  }, [query, delayMs]);

  const enabled = debounced.length >= 3;

  const { data, isFetching, error } = useQuery({
    queryKey: ['geocode', debounced],
    queryFn: ({ signal }) => geocode(debounced, signal),
    enabled,
    staleTime: 60_000,
  });

  return {
    query,
    setQuery,
    results: data?.results ?? [],
    isFetching: isFetching && enabled,
    error: error as Error | null,
    clear: () => {
      setQuery('');
      setDebounced('');
    },
  };
}
