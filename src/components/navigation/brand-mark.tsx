'use client';

import { BrainCircuit } from 'lucide-react';

/**
 * BrandMark — badge flutuante no canto superior esquerdo (desktop).
 */
export function BrandMark() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 hidden md:block">
      <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 shadow-lg">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15">
          <BrainCircuit className="size-4 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">TrafficMind</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Rotas inteligentes
          </div>
        </div>
      </div>
    </div>
  );
}
