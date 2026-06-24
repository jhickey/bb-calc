/**
 * Integration point for the `bb-calc-js` calculator library.
 *
 * `bb-calc-js` ships a native Node addon and a WebAssembly build from the same
 * Rust source. This app runs the calculator in the browser, where Vite resolves
 * `bb-calc-js` to its WASM binding (see the alias + cross-origin-isolation
 * headers in `vite.config.ts`). The WASM loader uses `fetch`/`Worker`, so call
 * this API client-side, not during SSR.
 *
 * UI code should import from here rather than reaching into `bb-calc-js`
 * directly, so the wiring lives in one place.
 */
export {
  computeAr,
  getWeapons,
  optimize,
  ConvertedElement,
  DamageTarget,
  GemShape,
  Mode,
  WeaponType,
  parseSave,
} from 'bb-calc-js';

export type {
  ArBreakdown,
  Candidate,
  Gem,
  GemRef,
  InventoryGem,
  OptimizeResult,
  SlotChoice,
  Stats,
  Weapon,
} from 'bb-calc-js';
