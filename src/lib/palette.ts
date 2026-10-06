import type { CSSProperties } from 'react';
import type { LayerId } from './types';

/** Layer hues. All layers share the same lightness/chroma so they read at equal weight. */
const HUE: Record<LayerId, number> = { ui: 275, bff: 190, data: 140, gql: 335, sf: 225 };

export interface LayerPalette {
  /** Swatch. */
  c: string;
  ink: string;
  tint: string;
  rail: string;
}

const MONO: LayerPalette = {
  c: 'var(--color-accent)',
  ink: 'var(--color-accent-700)',
  tint: 'transparent',
  rail: 'var(--color-accent-300)',
};

export function layerPalette(layer: LayerId, layerColors: boolean): LayerPalette {
  const h = HUE[layer];
  if (!layerColors || h === undefined) return MONO;
  return {
    c: `oklch(0.6 0.11 ${h})`,
    ink: `oklch(0.42 0.09 ${h})`,
    tint: `oklch(0.965 0.018 ${h})`,
    rail: `oklch(0.85 0.05 ${h})`,
  };
}

/** Exposes a layer palette as CSS custom properties consumed by `app.css`. */
export function layerVars(layer: LayerId, layerColors: boolean): CSSProperties {
  const p = layerPalette(layer, layerColors);
  return { '--layer-c': p.c, '--layer-ink': p.ink, '--layer-tint': p.tint, '--layer-rail': p.rail } as CSSProperties;
}
