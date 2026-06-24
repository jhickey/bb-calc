import type { GemShape } from '#/lib/bb-calc';

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
