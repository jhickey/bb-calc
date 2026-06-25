import test from 'ava';

import {
  computeAr,
  DamageTarget,
  getWeapons,
  GemShape,
  Mode,
  optimize,
  type Gem,
  type InventoryGem,
  type Stats,
} from '../index';

const ZERO_STATS: Stats = { str: 0, skl: 0, blt: 0, arc: 0 };

/** An identity gem: scales/flats are 0, every multiplier is 1 (no effect). */
function identityGem(): Gem {
  return {
    name: 'test',
    source: 'test',
    tier: 0,
    shape: GemShape.Radial,
    arcScale: 0,
    strScale: 0,
    sklScale: 0,
    bltScale: 0,
    dmgGeneral: 1,
    dmgArcane: 1,
    dmgFire: 1,
    dmgBolt: 1,
    dmgPhys: 1,
    dmgBlood: 1,
    dmgBlunt: 1,
    dmgThrust: 1,
    flatPhys: 0,
    flatArcane: 0,
    flatFire: 0,
    flatBolt: 0,
    flatBlood: 0,
    openFoes: 1,
    striking: 1,
    kinhunter: 1,
    beasthunter: 1,
  };
}

test('getWeapons returns all weapons', (t) => {
  const weapons = getWeapons();
  t.is(weapons.length, 83);
});

test('getWeapons exposes weapon fields, including baked-in gem slots', (t) => {
  const weapons = getWeapons();
  const arm = weapons.find((w) => w.id === 'amygdalan_arm');
  t.truthy(arm);
  t.is(arm?.name, 'Amygdalan Arm');
  t.is(arm?.phys, 160);
  t.is(arm?.arcane, 80);
  t.is(arm?.weaponType, 'Dual');
  t.is(arm?.gemSlot1, GemShape.Radial);
  t.is(arm?.gemSlot2, GemShape.Radial);
  t.is(arm?.gemSlot3, GemShape.Triangle);
});

test('computeAr sums physical and arcane for a Dual weapon at zero stats', (t) => {
  // Amygdalan Arm is Dual with phys 160 / arcane 80. With no scaling (zero
  // stats) and no gems, the Dual total is the sum of the two lines.
  const ar = computeAr('amygdalan_arm', [], ZERO_STATS);
  t.is(ar.physical, 160);
  t.is(ar.arcane, 80);
  t.is(ar.total, 240);
  t.is(ar.convertedElement, 'Phys');
});

test('computeAr applies gem general damage multiplier', (t) => {
  const gem = identityGem();
  gem.dmgGeneral = 2;
  const ar = computeAr('amygdalan_arm', [gem], ZERO_STATS);
  // Physical line doubles; arcane (an elemental line) is unaffected by general.
  t.is(ar.physical, 320);
  t.is(ar.arcane, 160);
});

test('computeAr rejects an unknown weapon id', (t) => {
  const err = t.throws(() => computeAr('nope', [], ZERO_STATS));
  t.regex(err!.message, /unknown weapon id/);
});

test('computeAr rejects more than three gems', (t) => {
  const gems = [identityGem(), identityGem(), identityGem(), identityGem()];
  const err = t.throws(() => computeAr('amygdalan_arm', gems, ZERO_STATS));
  t.regex(err!.message, /at most 3 gems/);
});

/** An owned gem described by its in-game effect strings. */
function inventoryGem(id: string, shape: GemShape, effects: Array<string>): InventoryGem {
  return { id, name: id, shape, rating: 19, effects, inUse: false, inStorage: false };
}

test('optimize echoes the weapon id and exposes its baked-in slot shapes', async (t) => {
  const [result] = await optimize(['amygdalan_arm'], [], ZERO_STATS, DamageTarget.Total, Mode.Compare);
  t.is(result?.weaponId, 'amygdalan_arm');
  t.deepEqual(
    result?.slots.map((s) => s.slotShape),
    [GemShape.Radial, GemShape.Radial, GemShape.Triangle],
  );
});

test('optimize places a fitting damage gem and raises Attack Rating', async (t) => {
  const gems = [inventoryGem('big-phys', GemShape.Radial, ['Physical ATK UP +50%'])];
  const [result] = await optimize(['amygdalan_arm'], gems, ZERO_STATS, DamageTarget.Total, Mode.Compare);

  // The gem fits a Radial slot, boosting the 160 physical line by 50% to 240.
  t.true(result!.slots.some((s) => s.gem?.id === 'big-phys'));
  t.is(result?.breakdown.physical, 240);
  t.is(result?.total, 320);
  t.is(result?.score, 320);
});

test('optimize leaves slots empty when the inventory is empty', async (t) => {
  const [result] = await optimize(['amygdalan_arm'], [], ZERO_STATS, DamageTarget.Total, Mode.Compare);
  t.true(result!.slots.every((s) => s.gem == null));
  t.is(result?.total, 240);
});
