import type { Weapon } from 'bb-calc-js';
import { getWeapons } from 'bb-calc-js';

/** The thumbnail shown when a weapon has no matching image. */
export const PLACEHOLDER_WEAPON_ICON = '/imprints/placeholder.png';

let byIdCache: Map<string, Weapon> | null = null;

/** Look up a weapon by id from the static table (cached). */
export function weaponById(weaponId: string): Weapon | undefined {
  byIdCache ??= new Map(getWeapons().map((weapon) => [weapon.id, weapon]));
  return byIdCache.get(weaponId);
}

/**
 * Variant/form suffixes layered onto a base weapon id. Normal/Uncanny/Lost and
 * special forms (e.g. Tricked, Embrace, Milkweed) all share the base weapon's
 * thumbnail, so we strip these to find the image.
 */
const VARIANT_SUFFIXES = ['_uncanny', '_lost', '_tricked', '_embrace', '_milkweed'];

/** Strip variant/form suffixes to get the base weapon id. */
export function baseWeaponId(weaponId: string): string {
  for (const suffix of VARIANT_SUFFIXES) {
    if (weaponId.endsWith(suffix)) return weaponId.slice(0, -suffix.length);
  }
  return weaponId;
}

/** The thumbnail path for a weapon (shared across its variants). */
export function weaponThumbnail(weaponId: string): string {
  return `/weapons/${baseWeaponId(weaponId)}.png`;
}

let nameCache: Map<string, string> | null = null;

/** The display name for a weapon id (e.g. `church_pick_lost` -> `Lost Church Pick`). */
export function weaponName(weaponId: string): string {
  nameCache ??= new Map(getWeapons().map((weapon) => [weapon.id, weapon.name]));
  return nameCache.get(weaponId) ?? weaponId;
}
