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

/**
 * The five in-game "curse" effects. A gem carrying any of these is a Cursed gem
 * (in-game its name is prefixed "Cursed …"). This set is exactly equivalent to
 * the "Cursed"-prefixed effect entries in the gem data, so matching the effect
 * string is enough to identify a curse — no extra save data is needed.
 */
const CURSE_PREFIXES = [
  'ATK DOWN',
  'ATK vs beasts DOWN',
  'ATK vs the kin DOWN',
  'WPN durability DOWN',
  'HP gradually depletes',
] as const;

/** Whether an effect string is one of the five in-game curses. */
export function isCurseEffect(effect: string): boolean {
  return CURSE_PREFIXES.some((prefix) => effect.startsWith(prefix));
}

/**
 * Whether an effect is a drawback — the five curses plus "Increases stamina
 * costs". In-game all of these mark a gem "Cursed", so they're treated alike
 * here. The AR calc ignores the non-percentage ones, so they're invisible to the
 * optimizer; surfacing them helps the player decide whether to exclude a gem.
 */
export function isDrawbackEffect(effect: string): boolean {
  return isCurseEffect(effect) || effect.startsWith('Increases stamina costs');
}

/** Whether a gem carries a drawback (drives the "Cursed" badge). */
export function isCursed(gem: { effects: ReadonlyArray<string> }): boolean {
  return gem.effects.some(isDrawbackEffect);
}
