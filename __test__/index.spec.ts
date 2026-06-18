import test from 'ava'

import {
  computeAr,
  DamageTarget,
  getWeapons,
  GemShape,
  optimizeForSlots,
  type Candidate,
  type Gem,
  type Stats,
} from '../index'

const ZERO_STATS: Stats = { str: 0, skl: 0, blt: 0, arc: 0 }

/** An identity gem: scales/flats are 0, every multiplier is 1 (no effect). */
function identityGem(): Gem {
  return {
    name: 'test',
    source: 'test',
    tier: 0,
    shape: GemShape.Radial,
    arcScale: 0,
    strScale: 0,
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
  }
}

test('getWeapons returns all weapons', (t) => {
  const weapons = getWeapons()
  t.is(weapons.length, 31)
})

test('getWeapons exposes weapon fields', (t) => {
  const weapons = getWeapons()
  const arm = weapons.find((w) => w.id === 'amygdalan_arm')
  t.truthy(arm)
  t.is(arm?.name, 'Amygdalan Arm')
  t.is(arm?.phys, 160)
  t.is(arm?.arcane, 80)
  t.is(arm?.weaponType, 'Dual')
})

test('computeAr sums physical and arcane for a Dual weapon at zero stats', (t) => {
  // Amygdalan Arm is Dual with phys 160 / arcane 80. With no scaling (zero
  // stats) and no gems, the Dual total is the sum of the two lines.
  const ar = computeAr('amygdalan_arm', [], ZERO_STATS)
  t.is(ar.physical, 160)
  t.is(ar.arcane, 80)
  t.is(ar.total, 240)
  t.is(ar.convertedElement, 'Phys')
})

test('computeAr applies gem general damage multiplier', (t) => {
  const gem = identityGem()
  gem.dmgGeneral = 2
  const ar = computeAr('amygdalan_arm', [gem], ZERO_STATS)
  // Physical line doubles; arcane (an elemental line) is unaffected by general.
  t.is(ar.physical, 320)
  t.is(ar.arcane, 160)
})

test('computeAr rejects an unknown weapon id', (t) => {
  const err = t.throws(() => computeAr('nope', [], ZERO_STATS))
  t.regex(err!.message, /unknown weapon id/)
})

test('computeAr rejects more than three gems', (t) => {
  const gems = [identityGem(), identityGem(), identityGem(), identityGem()]
  const err = t.throws(() => computeAr('amygdalan_arm', gems, ZERO_STATS))
  t.regex(err!.message, /at most 3 gems/)
})

/** Wraps a {@link Gem} as an owned optimizer candidate of the given shape. */
function candidate(id: string, gem: Gem, shape: GemShape): Candidate {
  return { gem, shape, gemRef: { id, name: gem.name, effects: [] } }
}

test('optimizeForSlots places a damage gem into a matching slot', (t) => {
  const gem = identityGem()
  gem.dmgGeneral = 2
  const candidates = [candidate('big-phys', gem, GemShape.Radial)]

  const result = optimizeForSlots('amygdalan_arm', [GemShape.Radial], candidates, ZERO_STATS, DamageTarget.Total)

  t.is(result.slots.length, 1)
  t.is(result.slots[0]?.gem?.id, 'big-phys')
  // dmgGeneral doubles every line: physical 160→320, arcane 80→160.
  t.is(result.breakdown.physical, 320)
  t.is(result.breakdown.arcane, 160)
  t.is(result.total, 480)
  t.is(result.score, 480)
})

test('optimizeForSlots leaves a slot empty when no gem fits its shape', (t) => {
  const gem = identityGem()
  gem.dmgGeneral = 2
  // A Radial gem cannot fit a Triangle slot.
  const candidates = [candidate('big-phys', gem, GemShape.Radial)]

  const result = optimizeForSlots('amygdalan_arm', [GemShape.Triangle], candidates, ZERO_STATS, DamageTarget.Total)

  t.is(result.slots[0]?.slotShape, GemShape.Triangle)
  t.is(result.slots[0]?.gem, undefined)
  t.is(result.total, 240)
})

test('optimizeForSlots rejects more than three slots', (t) => {
  const shapes = [GemShape.Radial, GemShape.Radial, GemShape.Radial, GemShape.Radial]
  const err = t.throws(() => optimizeForSlots('amygdalan_arm', shapes, [], ZERO_STATS, DamageTarget.Total))
  t.regex(err!.message, /at most 3 slots/)
})
