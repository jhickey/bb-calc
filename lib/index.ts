/**
 * Public entry point for bb-calc-js.
 *
 * Re-exports the native NAPI bindings (from the auto-generated `../index`)
 * and layers any additional TypeScript helpers on top. Author new TS code
 * here or in sibling files under `lib/` — never edit the generated
 * `index.js` / `index.d.ts` at the repo root, as `napi build` overwrites them.
 */
export * from '../index'

import { computeAr, type Gem, type Stats } from '../index'

/**
 * Computes the Attack Rating total for a weapon, ignoring the per-element
 * breakdown. Thin convenience wrapper over {@link computeAr}.
 */
export function computeArTotal(weaponId: string, gems: Array<Gem>, stats: Stats): number {
  return computeAr(weaponId, gems, stats).total
}
