'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Loader2, Navigation, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDebouncedGeocode } from '@/hooks/navigation/use-debounced-geocode';
import { useNavigationStore } from '@/hooks/navigation/use-navigation-store';
import { toast } from 'sonner';
import type { GeocodingResult } from '@/lib/navigation/types';

interface SearchPanelProps {
  onLocateMe: () => void;
  locating: boolean;
}

/**
 * SearchPanel — painel superior de busca.
 * ----------------------------------------------------------------------------
 * Mostra:
 *   - barra de busca de destino (Nominatim com debounce)
 *   - botão grande "Minha localização" com texto (não só ícone)
 *   - dropdown de candidatos
 *   - indicador visual de progresso (Passo 1 de 2)
 *
 * Linguagem simples, sem jargão.
 */
export function SearchPanel({ onLocateMe, locating }: SearchPanelProps) {
  const { query, setQuery, results, isFetching, clear } = useDebouncedGeocode();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const origin = useNavigationStore((s) => s.origin);
  const destination = useNavigationStore((s) => s.destination);

  // Fecha dropdown ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus na busca ao carregar a página.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pick = (r: GeocodingResult) => {
    setDestination(r.coordinate, r.label);
    setOpen(false);
    clear();
    toast.success('Destino definido!', { description: r.label });
  };

  const hasOrigin = !!origin;
  const hasDestination = !!destination;

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto absolute left-1/2 top-3 z-30 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 sm:left-3 sm:translate-x-0"
    >
      <div className="glass-panel-strong rounded-2xl p-2.5 shadow-2xl">
        {/* Indicador de progresso: Passo 1 e 2 */}
        <div className="mb-2 flex items-center gap-2 px-1">
          <StepDot active={!hasDestination} done={hasDestination} label="1" />
          <div className={cn('h-px flex-1', hasDestination ? 'bg-primary' : 'bg-muted-foreground/30')} />
          <StepDot active={hasDestination && !hasOrigin} done={hasOrigin} label="2" />
          <div className={cn('h-px flex-1', hasOrigin ? 'bg-primary' : 'bg-muted-foreground/30')} />
          <StepDot active={hasOrigin && hasDestination} done={false} label="✓" last />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Para onde você quer ir?"
              className="h-12 rounded-xl border-transparent bg-secondary/60 pl-9 pr-9 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Busca de destino"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => {
                  clear();
                  setOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            variant="secondary"
            className={cn(
              'h-12 shrink-0 gap-2 rounded-xl px-4 text-sm font-medium',
              hasOrigin
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-secondary/60 hover:bg-secondary',
              !hasOrigin && !locating && 'ring-2 ring-primary animate-pulse',
            )}
            onClick={onLocateMe}
            disabled={locating}
            aria-label="Usar minha localização"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : hasOrigin ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Navigation className="size-4" />
            )}
            <span className="hidden sm:inline">
              {hasOrigin ? 'Origem OK' : locating ? 'Localizando…' : 'Minha localização'}
            </span>
          </Button>
        </div>
      </div>

      {/* Dropdown de resultados */}
      {open && (results.length > 0 || isFetching) && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-popover/95 backdrop-blur scrollbar-thin">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Buscando endereços…</span>
            </div>
          )}
          {!isFetching &&
            results.map((r) => (
              <button
                key={r.osmId ?? r.label}
                onClick={() => pick(r)}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
                  'hover:bg-secondary/60 focus:bg-secondary/60 focus:outline-none',
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{r.label}</div>
                  {r.secondary && (
                    <div className="truncate text-xs text-muted-foreground">{r.secondary}</div>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** Bolinha do indicador de progresso. */
function StepDot({
  active,
  done,
  label,
  last,
}: {
  active: boolean;
  done: boolean;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
        done
          ? 'bg-emerald-500 text-white'
          : active
            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {done ? '✓' : label}
      {last && <span className="sr-only">Rotas</span>}
    </div>
  );
}
