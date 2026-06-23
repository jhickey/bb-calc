/**
 * Public entry point for bb-calc-js.
 *
 * Re-exports the native NAPI bindings (from the auto-generated `../index`)
 * and layers any additional TypeScript helpers on top. Author new TS code
 * here or in sibling files under `lib/` — never edit the generated
 * `index.js` / `index.d.ts` at the repo root, as `napi build` overwrites them.
 */
export * from '../index'

import {
  computeAr,
  optimize as optimizeNative,
  type DamageTarget,
  type Gem,
  type InventoryGem,
  type Mode,
  type OptimizeResult,
  type Stats,
} from '../index'

/**
 * Finds the gem socketing that maximizes `target` for each weapon.
 *
 * Resolves to one {@link OptimizeResult} per weapon id. This runs the search on
 * a worker thread (it returns a `Promise`), which keeps the browser's main
 * thread unblocked — the underlying optimizer uses threads, and joining them
 * synchronously would call `Atomics.wait`, which is illegal on the main thread.
 *
 * Restores the precise return type that NAPI erases to `Promise<unknown>` for
 * async tasks; the runtime call is unchanged.
 */
export function optimize(
  weaponIds: Array<string>,
  gems: Array<InventoryGem>,
  stats: Stats,
  target: DamageTarget,
  mode: Mode,
  excludedGems?: Array<string> | undefined | null,
): Promise<Array<OptimizeResult>> {
  return optimizeNative(weaponIds, gems, stats, target, mode, excludedGems) as Promise<Array<OptimizeResult>>
}

/**
 * Computes the Attack Rating total for a weapon, ignoring the per-element
 * breakdown. Thin convenience wrapper over {@link computeAr}.
 */
export function computeArTotal(weaponId: string, gems: Array<Gem>, stats: Stats): number {
  return computeAr(weaponId, gems, stats).total
}
