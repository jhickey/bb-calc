import type { Gem } from 'bb-calc-js';
import { GemShape } from 'bb-calc-js';

/**
 * A gem socketed into a weapon slot: the calc {@link Gem} (fed to `computeAr`)
 * plus its human-readable effect strings, kept so the UI can tell otherwise
 * identically-named gems apart.
 */
export type Socket = {
  gem: Gem;
  effects: Array<string>;
  /**
   * The owned gem's instance id, when socketed from inventory. Lets Loadout mode
   * see which physical gems are already in use elsewhere. Absent for custom gems.
   */
  gemId?: string;
};

/** Every gem shape, in display order. */
export const GEM_SHAPES: ReadonlyArray<GemShape> = [
  GemShape.Radial,
  GemShape.Triangle,
  GemShape.Waning,
  GemShape.Circle,
  GemShape.Droplet,
];

/**
 * Imprint icon per gem shape. `Circle` gems are firearm gems (gun icon);
 * `Droplet` is the universal wildcard, which has no dedicated icon, so it
 * falls back to the placeholder.
 */
const SHAPE_ICON: Record<GemShape, string> = {
  Radial: '/imprints/radial.png',
  Triangle: '/imprints/triangle.png',
  Waning: '/imprints/waning.png',
  Circle: '/imprints/gun.png',
  Droplet: '/imprints/placeholder.png',
};

export const PLACEHOLDER_GEM_ICON = '/imprints/placeholder.png';

/** The imprint icon path for a gem shape, falling back to the placeholder. */
export function gemShapeIcon(shape: GemShape): string {
  return SHAPE_ICON[shape] ?? PLACEHOLDER_GEM_ICON;
}
