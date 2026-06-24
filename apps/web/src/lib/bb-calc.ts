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
import { parseSave as parseSaveNative } from 'bb-calc-js';
import type { Inventory } from 'bb-calc-js';

export {
  computeAr,
  getWeapons,
  optimize,
  ConvertedElement,
  DamageTarget,
  GemShape,
  Mode,
  WeaponType,
} from 'bb-calc-js';

export type {
  ArBreakdown,
  Candidate,
  Gem,
  GemRef,
  Inventory,
  InventoryGem,
  OptimizeResult,
  SlotChoice,
  Stats,
  Weapon,
} from 'bb-calc-js';

/**
 * Parse a decrypted Bloodborne save into an {@link Inventory}.
 *
 * The generated binding types the argument as a Node `Buffer`, but the WASM
 * build accepts any `Uint8Array` at runtime (and there is no `Buffer` in the
 * browser), so we widen the parameter and cast at the call site.
 */
export function parseSave(saveFile: Uint8Array): Promise<Inventory> {
  return parseSaveNative(saveFile as Parameters<typeof parseSaveNative>[0]) as Promise<Inventory>;
}
