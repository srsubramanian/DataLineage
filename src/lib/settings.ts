/** Display options (prototype tweaks). Pass overrides to `<App settings={…} />`. */
export interface DisplaySettings {
  /** Per-layer hues; off = monochrome accent. */
  layerColors: boolean;
  /** Show the type line under each node chip. */
  showTypes: boolean;
  /** Show the ƒ / = / ! markers on connector gutters. */
  showConnectors: boolean;
  /** Show the impact section when a non-UI node is selected. */
  showImpact: boolean;
}

export const DEFAULT_SETTINGS: DisplaySettings = {
  layerColors: true,
  showTypes: true,
  showConnectors: true,
  showImpact: true,
};
