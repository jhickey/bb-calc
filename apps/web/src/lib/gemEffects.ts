import type { Gem, GemShape } from 'bb-calc-js';
import { gemFromInventory } from 'bb-calc-js';

import type { CustomGemEffect, CustomGemInput, CustomGemRow } from '#/lib/customGems';
import type { Socket } from '#/lib/gems';

/**
 * The AR-contributing gem effects the creator can pick from a dropdown. Each
 * knows how to render itself as the in-game-style string the inventory parser
 * ({@link gemFromInventory}) understands, so custom gems read and calculate
 * exactly like save-parsed ones. Anything outside this list is a free-text
 * effect with no AR impact (the parser silently skips it).
 */
export type ArEffect =
  | { key: string; label: string; kind: 'mult'; unit: '%'; up: string; down?: string }
  | { key: string; label: string; kind: 'flat'; unit: 'pts'; name: string }
  | { key: string; label: string; kind: 'scale'; unit: 'pts'; name: string };

export const AR_EFFECTS: ReadonlyArray<ArEffect> = [
  { key: 'phys', label: 'Physical ATK', kind: 'mult', unit: '%', up: 'Physical ATK UP' },
  { key: 'blunt', label: 'Blunt ATK', kind: 'mult', unit: '%', up: 'Blunt ATK UP' },
  { key: 'thrust', label: 'Thrust ATK', kind: 'mult', unit: '%', up: 'Thrust ATK UP' },
  { key: 'arcane', label: 'Arcane ATK', kind: 'mult', unit: '%', up: 'Arcane ATK UP' },
  { key: 'fire', label: 'Fire ATK', kind: 'mult', unit: '%', up: 'Fire ATK UP' },
  { key: 'bolt', label: 'Bolt ATK', kind: 'mult', unit: '%', up: 'Bolt ATK UP' },
  { key: 'blood', label: 'Blood ATK', kind: 'mult', unit: '%', up: 'Blood ATK UP' },
  { key: 'overall', label: 'Overall ATK', kind: 'mult', unit: '%', up: 'ATK UP', down: 'ATK DOWN' },
  {
    key: 'beasts',
    label: 'ATK vs Beasts',
    kind: 'mult',
    unit: '%',
    up: 'ATK vs beasts UP',
    down: 'ATK vs beasts DOWN',
  },
  { key: 'kin', label: 'ATK vs Kin', kind: 'mult', unit: '%', up: 'ATK vs the kin UP', down: 'ATK vs the kin DOWN' },
  { key: 'openfoes', label: 'ATK vs Open Foes', kind: 'mult', unit: '%', up: 'ATK vs open foes UP' },
  { key: 'add-phys', label: 'Add Physical ATK', kind: 'flat', unit: 'pts', name: 'Add physical ATK' },
  { key: 'add-arcane', label: 'Add Arcane ATK', kind: 'flat', unit: 'pts', name: 'Add arcane ATK' },
  { key: 'add-fire', label: 'Add Fire ATK', kind: 'flat', unit: 'pts', name: 'Add fire ATK' },
  { key: 'add-bolt', label: 'Add Bolt ATK', kind: 'flat', unit: 'pts', name: 'Add bolt ATK' },
  { key: 'add-blood', label: 'Add Blood ATK', kind: 'flat', unit: 'pts', name: 'Add blood ATK' },
  { key: 'str-scale', label: 'STR scaling', kind: 'scale', unit: 'pts', name: 'STR scaling' },
  { key: 'skl-scale', label: 'SKL scaling', kind: 'scale', unit: 'pts', name: 'SKL scaling' },
  { key: 'blt-scale', label: 'Bloodtinge scaling', kind: 'scale', unit: 'pts', name: 'Bloodtinge scaling' },
  { key: 'arc-scale', label: 'Arcane scaling', kind: 'scale', unit: 'pts', name: 'Arcane scaling' },
];

/** Render a number with an explicit sign, trimming any trailing zeros. */
function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Build the in-game-style effect string for a chosen effect. A cursed effect is
 * applied as a reduction: effects with a dedicated "DOWN" name use it (so it
 * reads naturally and matches curse detection), others take a negative value.
 */
export function buildEffectText(effect: ArEffect, magnitude: number, cursed: boolean): string {
  const n = cursed ? -Math.abs(magnitude) : Math.abs(magnitude);
  if (effect.kind === 'mult') {
    const name = cursed && effect.down ? effect.down : effect.up;
    return `${name} ${signed(n)}%`;
  }
  return `${effect.name} ${signed(n)}`;
}

type CustomGemLike = Pick<CustomGemRow | CustomGemInput, 'name' | 'shape' | 'tier' | 'effects'>;

/** Resolve a custom gem's structured effects into a calc {@link Gem}. */
export function customGemToGem(gem: CustomGemLike): Gem {
  return gemFromInventory({
    id: 'custom',
    name: gem.name,
    shape: gem.shape as GemShape,
    rating: gem.tier,
    effects: gem.effects.map((e: CustomGemEffect) => e.text),
    inUse: false,
    inStorage: false,
  });
}

/** A custom gem as a socketable {@link Socket} (no `gemId`; it's not an owned instance). */
export function customGemToSocket(gem: CustomGemLike): Socket {
  return { gem: customGemToGem(gem), effects: gem.effects.map((e) => e.text) };
}
