const NUMBERS: &'static [f32] = &[
    0.0,
    0.0, 0.0, 0.0, 0.0, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05,
    0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35,
    0.38, 0.41, 0.44, 0.47, 0.5, 0.514, 0.528, 0.542, 0.556, 0.57,
    0.584, 0.598, 0.612, 0.626, 0.64, 0.654, 0.668, 0.682, 0.696, 0.71,
    0.724, 0.738, 0.752, 0.766, 0.78, 0.794, 0.808, 0.822, 0.836, 0.85,
    0.853, 0.856, 0.859, 0.862, 0.865, 0.868, 0.871, 0.874, 0.878, 0.881,
    0.884, 0.887, 0.89, 0.893, 0.896, 0.899, 0.902, 0.905, 0.908, 0.911,
    0.914, 0.917, 0.92, 0.923, 0.927, 0.93, 0.933, 0.936, 0.939, 0.942,
    0.945, 0.948, 0.951, 0.954, 0.957, 0.96, 0.963, 0.966, 0.969, 0.972,
    0.975, 0.979, 0.982, 0.98, 0.988, 0.991, 0.994, 0.997, 1.0,
];
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WeaponType {
    Dual,
    Conv,
    Blood,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum GemShape {
    Radial,
    Triangle,
    Waning,
    Circle,
    /// Universal wildcard: a Droplet gem fits any slot.
    Droplet,
}

#[derive(Debug, Clone)]
pub struct Weapon {
    pub id: &'static str,
    pub name: &'static str,
    pub weapon_type: WeaponType,
    pub phys: u16,
    pub blood: u16,
    pub arcane: u16,
    pub fire: u16,
    pub bolt: u16,
    str_scale: f32,
    skl_scale: f32,
    blt_scale: f32,
    arc_scale: f32,
    serrated: f32,
    righteous: f32,
    serrated_tricked: f32,
    righteous_tricked: f32,
}

// `WEAPONS: &[Weapon]` is code-generated from `data/weapons.json` by `build.rs` at
// compile time and baked into the binary; no JSON is read at runtime.
include!(concat!(env!("OUT_DIR"), "/weapons_generated.rs"));

impl Weapon {
    /// All weapons, generated from `data/weapons.json` at compile time.
    pub fn all() -> &'static [Weapon] {
        WEAPONS
    }

    /// Look up a weapon by its normalized `id` (see `data/weapons.json`).
    pub fn by_id(id: &str) -> Option<&'static Weapon> {
        WEAPONS.iter().find(|w| w.id == id)
    }
}

#[derive(Debug, Clone)]
pub struct Gem {
    pub name: String,
    pub source: String,
    pub tier: u8,
    pub shape: GemShape,
    pub arc_scale: f32,
    pub str_scale: f32,
    pub dmg_general: f32,
    pub dmg_arcane: f32,
    pub dmg_fire: f32,
    pub dmg_bolt: f32,
    pub dmg_phys: f32,
    pub dmg_blood: f32,
    pub dmg_blunt: f32,
    pub dmg_thrust: f32,
    pub flat_phys: f32,
    pub flat_arcane: f32,
    pub flat_fire: f32,
    pub flat_bolt: f32,
    pub flat_blood: f32,
    pub open_foes: f32,
    pub striking: f32,
    pub kinhunter: f32,
    pub beasthunter: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConvertedElement {
    Phys,
    Bolt,
    Fire,
    Arc,
}

pub struct Stats {
    pub str: u16,
    pub skl: u16,
    pub blt: u16,
    pub arc: u16,
}

#[derive(Debug, Clone)]
pub struct ArBreakdown {
    pub total: f32,
    pub physical: f32,
    pub blunt: f32,
    pub thrust: f32,
    pub arcane: f32,
    pub fire: f32,
    pub bolt: f32,
    pub blood: f32,
    pub converted_element: ConvertedElement,
}

pub fn gem_sum(gems: &[Option<&Gem>]) -> f32 {
    gems.iter().map(|g| g.as_ref().map(|g| g.dmg_general)).sum::<Option<f32>>().unwrap_or(0.0)
}

fn get_sat(stat: u16) -> f32 {
    if (stat as usize) >= NUMBERS.len() {
        return 1.0;
    }
    NUMBERS[stat as usize]
}

pub fn compute_ar(weapon: &Weapon, gems: [Option<&Gem>; 3], stats: &Stats) -> ArBreakdown {
    let sum = |f: fn(&Gem) -> f32| gems.iter().flatten().copied().map(f).sum::<f32>();
    let prod = |f: fn(&Gem) -> f32| gems.iter().flatten().copied().map(f).product::<f32>();

    let arc_scale_sum = sum(|g| g.arc_scale);
    let str_scale_sum = sum(|g| g.str_scale);
    let dmg = prod(|g| g.dmg_general);
    let phys_mult = prod(|g| g.dmg_phys);
    let arc_mult = prod(|g| g.dmg_arcane);
    let fire_mult = prod(|g| g.dmg_fire);
    let bolt_mult = prod(|g| g.dmg_bolt);
    let blood_mult = prod(|g| g.dmg_blood);
    let blunt_mult = prod(|g| g.dmg_blunt);
    let thrust_mult = prod(|g| g.dmg_thrust);
    let flat_phys = sum(|g| g.flat_phys);
    let flat_arc_gems = sum(|g| g.flat_arcane);
    let flat_fire = sum(|g| g.flat_fire);
    let flat_bolt = sum(|g| g.flat_bolt);
    let flat_blood = sum(|g| g.flat_blood);

    let sat_str = get_sat(stats.str);
    let sat_skl = get_sat(stats.skl);
    let sat_blt = get_sat(stats.blt);
    let sat_arc = get_sat(stats.arc);

    // --- Weapon-specific special cases
    let tricked = weapon.name == "Logarius' Wheel (Tricked)";
    let dg_bolt = if weapon.name == "Tonitrus (Tricked)" { 1.7 } else { 1.0 };
    let (dh_phys, di_arc, flat_arc_mod) = if tricked {(0.7, 3.0, 20.0)} else { (1.0, 1.0, 0.0) };
    let flat_arc = flat_arc_gems + flat_arc_mod;

    // --- Conversion element for "Conv" weapons (sheet AE).
    // Priority via weighted flags (Arc > Fire > Bolt) so multi-element gem sets
    // resolve to the dominant element rather than collapsing to Phys.
    let arc_flag = if arc_mult > 1.0 || flat_arc_gems > 0.0 { 100 } else { 0 };
    let fire_flag = if fire_mult > 1.0 || flat_fire > 0.0 { 10 } else { 0 };
    let bolt_flag = if bolt_mult > 1.0 || flat_bolt > 0.0 { 1 } else { 0 };
    let ai = arc_flag + fire_flag + bolt_flag;
    let converted_element = if ai < 1 {
        ConvertedElement::Phys
    } else if ai < 10 {
        ConvertedElement::Bolt
    } else if ai < 100 {
        ConvertedElement::Fire
    } else {
        ConvertedElement::Arc
    };

    let is_dual = weapon.weapon_type == WeaponType::Dual;
    let is_conv = weapon.weapon_type == WeaponType::Conv;

    // base = P * (1 + (weaponStrScale + gemStrScale)*sat(Str) + weaponSklScale*sat(Skl))
    let phys_base = |p: f32| {
        p + (p * (weapon.str_scale + str_scale_sum) * sat_str + p * weapon.skl_scale * sat_skl)
    };
    // base = E * (1 + (weaponArcScale + gemArcScale)*sat(Arc))
    let elem_base = |e: f32| e + e * (weapon.arc_scale + arc_scale_sum) * sat_arc;

    let phys_converted = is_conv && converted_element != ConvertedElement::Phys;

    // --- Physical / Blunt / Thrust
    let phys_core = phys_base(weapon.phys as f32) * phys_mult * dmg * dh_phys;
    let physical = if phys_converted {
        flat_phys.floor()
    } else {
        (phys_core + flat_phys).floor()
    };
    let blunt = if phys_converted {
        flat_phys.floor()
    } else {
        (phys_core * blunt_mult + flat_phys).floor()
    };
    let thrust = if phys_converted {
        flat_phys.floor()
    } else {
        (phys_core * thrust_mult + flat_phys).floor()
    };

    // --- Arcane
    let arcane = if is_conv && converted_element == ConvertedElement::Arc {
        (elem_base(weapon.phys as f32) * arc_mult * dmg * di_arc + flat_arc).floor()
    } else if is_dual {
        (elem_base(weapon.arcane as f32) * arc_mult * dmg * di_arc + flat_arc).floor()
    } else {
        flat_arc.floor()
    };

    // --- Fire
    let fire = if is_conv && converted_element == ConvertedElement::Fire {
        (elem_base(weapon.phys as f32) * fire_mult * dmg + flat_fire).floor()
    } else if weapon.name == "Boom Hammer" {
        (elem_base(weapon.fire as f32) * fire_mult * dmg + flat_fire).floor()
    } else {
        flat_fire.floor()
    };

    // --- Bolt (non-bolt weapons have bolt base 0 -> collapses to flat bolt; Tonitrus scales)
    let bolt = if is_conv && converted_element == ConvertedElement::Bolt {
        (elem_base(weapon.phys as f32) * bolt_mult * dmg * dg_bolt + flat_bolt).floor()
    } else {
        (elem_base(weapon.bolt as f32) * bolt_mult * dmg * dg_bolt + flat_bolt).floor()
    };

    // --- Blood (adds flat-physical + flat-blood gem bonuses per the sheet)
    let blood = ((weapon.blood as f32 + weapon.blood as f32 * weapon.blt_scale * sat_blt)
        * phys_mult
        * blood_mult
        * dmg
        + flat_phys
        + flat_blood)
        .floor();

    // --- Total: SUM for "Dual" weapons, else MAX dominant element
    let total = if is_dual {
        physical + arcane + fire + bolt + blood
    } else {
        [arcane, fire, bolt, blood]
            .iter()
            .fold(physical, |acc, &x| acc.max(x))
    };

    ArBreakdown {
        total,
        physical,
        blunt,
        thrust,
        arcane,
        fire,
        bolt,
        blood,
        converted_element,
    }
}

// ===========================================================================
// Imprint-aware max-AR optimizer. Pure (no I/O) like the calc engine above.
//
// Given a weapon, the slot shapes of one imprint variant, and the gems a player
// owns (each with a shape), it finds the legal socketing that maximizes
// `compute_ar`. "Legal" means each chosen gem instance is used at most once and
// its shape fits the slot it goes in.
// ===========================================================================

use std::collections::HashMap;

/// Which figure the optimizer maximizes. `Total` is the full Attack Rating; the
/// rest target a single damage line of [`ArBreakdown`] (e.g. optimize a
/// conversion weapon's fire output).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DamageTarget {
    #[default]
    Total,
    Phys,
    Blunt,
    Thrust,
    Arcane,
    Fire,
    Bolt,
    Blood,
}

impl DamageTarget {
    /// The [`ArBreakdown`] line this target reads.
    fn score(self, b: &ArBreakdown) -> f32 {
        match self {
            DamageTarget::Total => b.total,
            DamageTarget::Phys => b.physical,
            DamageTarget::Blunt => b.blunt,
            DamageTarget::Thrust => b.thrust,
            DamageTarget::Arcane => b.arcane,
            DamageTarget::Fire => b.fire,
            DamageTarget::Bolt => b.bolt,
            DamageTarget::Blood => b.blood,
        }
    }
}

/// Minimal identity for reporting which owned gem was chosen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GemRef {
    pub id: String,
    pub name: String,
    pub effects: Vec<String>,
}

/// A gem the player owns, ready to feed the calc, plus how to refer to it.
///
/// `shape` is the inventory-sourced shape (authoritative for slotting); it is
/// kept separate from [`Gem`] because the calc never reads a gem's shape.
#[derive(Debug, Clone)]
pub struct Candidate {
    pub gem: Gem,
    pub shape: GemShape,
    pub gem_ref: GemRef,
}

/// One imprint slot in the result: its shape and the owned gem placed in it.
#[derive(Debug, Clone)]
pub struct SlotChoice {
    pub slot: usize,
    pub slot_shape: GemShape,
    pub gem: Option<GemRef>,
}

#[derive(Debug, Clone)]
pub struct OptimizeResult {
    /// The value of the optimized metric (see [`DamageTarget`]).
    pub score: f32,
    /// The full Attack Rating of the winning socketing, regardless of target.
    pub total: f32,
    pub breakdown: ArBreakdown,
    pub slots: Vec<SlotChoice>,
}

/// Shape compatibility (per Bloodborne): a gem fits a slot when their shapes
/// match exactly, with Droplet gems acting as a universal wildcard.
pub fn shape_fits(gem_shape: GemShape, slot_shape: GemShape) -> bool {
    gem_shape == slot_shape || gem_shape == GemShape::Droplet
}

/// The gem fields `compute_ar` actually reads — used to pool equivalent gems.
/// `f32` has no `Hash`/`Eq`, so we key on the raw bit patterns.
fn ar_signature(g: &Gem) -> [u32; 15] {
    [
        g.arc_scale,
        g.str_scale,
        g.dmg_general,
        g.dmg_arcane,
        g.dmg_fire,
        g.dmg_bolt,
        g.dmg_phys,
        g.dmg_blood,
        g.dmg_blunt,
        g.dmg_thrust,
        g.flat_phys,
        g.flat_arcane,
        g.flat_fire,
        g.flat_bolt,
        g.flat_blood,
    ]
    .map(f32::to_bits)
}

/// Distinct gem "type": calc-equivalent gems with the same shape, pooled so the
/// search is over distinct types, not hundreds of identical rolls.
struct GemType {
    gem: Gem,
    shape: GemShape,
    refs: Vec<GemRef>,
}

/// Immutable search context plus the running best, threaded through `fill`.
struct Search<'a> {
    weapon: &'a Weapon,
    stats: &'a Stats,
    target: DamageTarget,
    slot_shapes: &'a [GemShape],
    types: &'a [GemType],
    /// Available count per type index; decremented/restored as we recurse.
    remaining: Vec<usize>,
    best_score: f32,
    /// One entry per slot: the chosen type index, or `None` for an empty slot.
    best_chosen: Vec<Option<usize>>,
}

impl Search<'_> {
    /// Pack the chosen type indices into the calc's fixed 3-slot gem array.
    /// `compute_ar` is order-independent, so empties just stay `None`.
    fn gems_for<'g>(&'g self, chosen: &[Option<usize>]) -> [Option<&'g Gem>; 3] {
        let mut arr: [Option<&Gem>; 3] = [None, None, None];
        let mut i = 0;
        for ti in chosen.iter().flatten() {
            if i < arr.len() {
                arr[i] = Some(&self.types[*ti].gem);
                i += 1;
            }
        }
        arr
    }

    /// Try every legal way to fill slot `slot` onward, recording the best score.
    fn fill(&mut self, slot: usize, chosen: &mut Vec<Option<usize>>) {
        if slot == self.slot_shapes.len() {
            let breakdown = compute_ar(self.weapon, self.gems_for(chosen), self.stats);
            let s = self.target.score(&breakdown);
            if s > self.best_score {
                self.best_score = s;
                self.best_chosen = chosen.clone();
            }
            return;
        }

        // Option 1: leave this slot empty.
        chosen.push(None);
        self.fill(slot + 1, chosen);
        chosen.pop();

        // Option 2: place a compatible, still-available type.
        for ti in 0..self.types.len() {
            if self.remaining[ti] > 0 && shape_fits(self.types[ti].shape, self.slot_shapes[slot]) {
                self.remaining[ti] -= 1;
                chosen.push(Some(ti));
                self.fill(slot + 1, chosen);
                chosen.pop();
                self.remaining[ti] += 1;
            }
        }
    }
}

/// Find the socketing of `candidates` into `slot_shapes` that maximizes
/// `target` (defaulting to total AR), respecting shape fit and per-gem counts.
///
/// Supports up to the calc's 3 slots; imprints always have exactly 3.
pub fn optimize_for_slots(
    weapon: &Weapon,
    slot_shapes: &[GemShape],
    candidates: &[Candidate],
    stats: &Stats,
    target: DamageTarget,
) -> OptimizeResult {
    debug_assert!(slot_shapes.len() <= 3, "compute_ar supports at most 3 slots");

    let zero = compute_ar(weapon, [None, None, None], stats);
    let zero_score = target.score(&zero);

    // Keep gems that can help — either the targeted line or the overall total —
    // on their own. Filtering on total too (not just the target) keeps generic
    // ATK%/scaling gems: on a conversion weapon they raise the converted element
    // only once a converter gem is also slotted, so they look inert in isolation
    // for an element target but are still worth searching. A gem that improves
    // neither (a pure curse, or one the AR calc ignores) can never improve the
    // bundle, since gems combine by summing flats/scaling and multiplying mults.
    let helpful = candidates.iter().filter(|c| {
        let solo = compute_ar(weapon, [Some(&c.gem), None, None], stats);
        target.score(&solo) > zero_score || solo.total > zero.total
    });

    // Pool calc-equivalent gems of the same shape into distinct types.
    let mut by_key: HashMap<(GemShape, [u32; 15]), usize> = HashMap::new();
    let mut types: Vec<GemType> = Vec::new();
    for c in helpful {
        let key = (c.shape, ar_signature(&c.gem));
        match by_key.get(&key) {
            Some(&idx) => types[idx].refs.push(c.gem_ref.clone()),
            None => {
                by_key.insert(key, types.len());
                types.push(GemType {
                    gem: c.gem.clone(),
                    shape: c.shape,
                    refs: vec![c.gem_ref.clone()],
                });
            }
        }
    }

    let mut search = Search {
        weapon,
        stats,
        target,
        slot_shapes,
        types: &types,
        remaining: types.iter().map(|t| t.refs.len()).collect(),
        best_score: -1.0,
        best_chosen: Vec::new(),
    };
    search.fill(0, &mut Vec::new());

    // Reconstruct which owned instance fills each slot (distinct refs per type).
    let mut used: Vec<usize> = vec![0; types.len()];
    let slots: Vec<SlotChoice> = slot_shapes
        .iter()
        .enumerate()
        .map(|(slot, &slot_shape)| {
            let gem = search.best_chosen.get(slot).copied().flatten().map(|ti| {
                let i = used[ti];
                used[ti] += 1;
                types[ti].refs[i].clone()
            });
            SlotChoice { slot, slot_shape, gem }
        })
        .collect();

    let gems = search.gems_for(&search.best_chosen);
    let breakdown = compute_ar(weapon, gems, stats);
    OptimizeResult {
        score: search.best_score,
        total: breakdown.total,
        breakdown,
        slots,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A weapon with no scaling and no base damage; tests override what they need.
    fn weapon(name: &'static str, weapon_type: WeaponType) -> Weapon {
        Weapon {
            id: "",
            name,
            weapon_type,
            phys: 0,
            blood: 0,
            arcane: 0,
            fire: 0,
            bolt: 0,
            str_scale: 0.0,
            skl_scale: 0.0,
            blt_scale: 0.0,
            arc_scale: 0.0,
            serrated: 0.0,
            righteous: 0.0,
            serrated_tricked: 0.0,
            righteous_tricked: 0.0,
        }
    }

    /// An identity gem: scales/flats are 0, every multiplier is 1 (no effect).
    fn gem() -> Gem {
        Gem {
            name: "test".to_string(),
            source: "test".to_string(),
            tier: 0,
            shape: GemShape::Radial,
            arc_scale: 0.0,
            str_scale: 0.0,
            dmg_general: 1.0,
            dmg_arcane: 1.0,
            dmg_fire: 1.0,
            dmg_bolt: 1.0,
            dmg_phys: 1.0,
            dmg_blood: 1.0,
            dmg_blunt: 1.0,
            dmg_thrust: 1.0,
            flat_phys: 0.0,
            flat_arcane: 0.0,
            flat_fire: 0.0,
            flat_bolt: 0.0,
            flat_blood: 0.0,
            open_foes: 1.0,
            striking: 1.0,
            kinhunter: 1.0,
            beasthunter: 1.0,
        }
    }

    const ZERO_STATS: Stats = Stats {
        str: 0,
        skl: 0,
        blt: 0,
        arc: 0,
    };

    #[test]
    fn dual_no_gems_sums_physical_and_elements() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;
        w.arcane = 50;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // No scaling (stats 0), identity gems: phys=100, arcane=50, rest 0.
        assert_eq!(ar.physical, 100.0);
        assert_eq!(ar.blunt, 100.0);
        assert_eq!(ar.thrust, 100.0);
        assert_eq!(ar.arcane, 50.0);
        assert_eq!(ar.fire, 0.0);
        assert_eq!(ar.bolt, 0.0);
        assert_eq!(ar.blood, 0.0);
        // Dual total is the sum of physical + all elements.
        assert_eq!(ar.total, 150.0);
        assert_eq!(ar.converted_element, ConvertedElement::Phys);
    }

    #[test]
    fn str_scaling_uses_saturation_table() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;
        w.str_scale = 0.2;
        let stats = Stats {
            str: 25, // saturation = 0.5
            skl: 0,
            blt: 0,
            arc: 0,
        };

        let ar = compute_ar(&w, [None, None, None], &stats);

        // physBase = 100 + 100 * 0.2 * 0.5 = 110
        assert_eq!(ar.physical, 110.0);
    }

    #[test]
    fn gems_aggregate_sum_and_product() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;

        let mut g1 = gem();
        g1.dmg_general = 2.0;
        g1.flat_phys = 10.0;
        let mut g2 = gem();
        g2.dmg_general = 1.5;
        g2.flat_phys = 5.0;

        let ar = compute_ar(&w, [Some(&g1), Some(&g2), None], &ZERO_STATS);

        // gen = 2.0 * 1.5 = 3.0; flat_phys = 10 + 5 = 15
        // physCore = 100 * 3.0 = 300; physical = floor(300 + 15) = 315
        assert_eq!(ar.physical, 315.0);
    }

    #[test]
    fn conv_weapon_converts_physical_to_element() {
        let mut w = weapon("Test Cannon", WeaponType::Conv);
        w.phys = 100;

        let mut g = gem();
        g.dmg_fire = 1.5;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        assert_eq!(ar.converted_element, ConvertedElement::Fire);
        // Physical line collapses to flat physical (0) once converted.
        assert_eq!(ar.physical, 0.0);
        // fire = floor(elemBase(100) * 1.5) = 150
        assert_eq!(ar.fire, 150.0);
        // Non-dual total is the max line.
        assert_eq!(ar.total, 150.0);
    }

    #[test]
    fn converted_element_priority_is_arc_over_fire_over_bolt() {
        let w = weapon("Test Cannon", WeaponType::Conv);

        let mut g = gem();
        g.dmg_arcane = 1.5;
        g.dmg_fire = 1.5;
        g.dmg_bolt = 1.5;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        // All three flags set -> arcane wins.
        assert_eq!(ar.converted_element, ConvertedElement::Arc);
    }

    #[test]
    fn logarius_wheel_tricked_applies_modifiers() {
        let mut w = weapon("Logarius' Wheel (Tricked)", WeaponType::Dual);
        w.phys = 100;
        w.arcane = 10;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // dhPhys = 0.7 -> physical = floor(100 * 0.7) = 70
        assert_eq!(ar.physical, 70.0);
        // diArc = 3, flatArc += 20 -> arcane = floor(10 * 3 + 20) = 50
        assert_eq!(ar.arcane, 50.0);
        assert_eq!(ar.total, 120.0);
    }

    #[test]
    fn tonitrus_tricked_scales_bolt() {
        let mut w = weapon("Tonitrus (Tricked)", WeaponType::Dual);
        w.bolt = 100;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // dgBolt = 1.7 -> bolt = floor(100 * 1.7) = 170
        assert_eq!(ar.bolt, 170.0);
    }

    #[test]
    fn boom_hammer_scales_fire_off_weapon_fire() {
        let mut w = weapon("Boom Hammer", WeaponType::Dual);
        w.fire = 80;

        let ar = compute_ar(&w, [None, None, None], &ZERO_STATS);

        // Boom Hammer routes weapon.fire through the elemental line.
        assert_eq!(ar.fire, 80.0);
    }

    #[test]
    fn blood_line_adds_flat_phys_and_flat_blood() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.blood = 100;

        let mut g = gem();
        g.flat_phys = 10.0;
        g.flat_blood = 5.0;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        // blood = floor(100 * 1 * 1 * 1 + flatPhys(10) + flatBlood(5)) = 115
        assert_eq!(ar.blood, 115.0);
    }

    #[test]
    fn non_dual_total_is_max_line() {
        let mut w = weapon("Test Cannon", WeaponType::Conv);
        w.phys = 100;

        let mut g = gem();
        g.dmg_bolt = 2.0;

        let ar = compute_ar(&w, [Some(&g), None, None], &ZERO_STATS);

        assert_eq!(ar.converted_element, ConvertedElement::Bolt);
        // bolt = floor(elemBase(100) * 2.0) = 200, which dominates the max.
        assert_eq!(ar.bolt, 200.0);
        assert_eq!(ar.total, 200.0);
    }

    #[test]
    fn weapons_are_generated_from_json() {
        assert_eq!(WEAPONS.len(), 31);
    }

    fn gem_ref(id: &str) -> GemRef {
        GemRef {
            id: id.to_string(),
            name: format!("gem {id}"),
            effects: vec![],
        }
    }

    fn candidate(id: &str, shape: GemShape, configure: impl FnOnce(&mut Gem)) -> Candidate {
        let mut g = gem();
        configure(&mut g);
        Candidate {
            gem: g,
            shape,
            gem_ref: gem_ref(id),
        }
    }

    #[test]
    fn optimize_picks_highest_total_within_slot() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;

        let weak = candidate("weak", GemShape::Radial, |g| g.dmg_general = 1.2);
        let strong = candidate("strong", GemShape::Radial, |g| g.dmg_general = 2.0);

        let result = optimize_for_slots(
            &w,
            &[GemShape::Radial],
            &[weak, strong],
            &ZERO_STATS,
            DamageTarget::Total,
        );

        // One Radial slot -> the 2.0x gem wins: floor(100 * 2.0) = 200.
        assert_eq!(result.score, 200.0);
        assert_eq!(result.total, 200.0);
        assert_eq!(result.slots.len(), 1);
        assert_eq!(result.slots[0].gem.as_ref().unwrap().id, "strong");
    }

    #[test]
    fn optimize_respects_shape_fit_with_droplet_wildcard() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;

        // A strong gem that does not fit the Triangle slot, and a weaker Droplet
        // wildcard that does.
        let mismatched = candidate("radial", GemShape::Radial, |g| g.dmg_general = 5.0);
        let droplet = candidate("droplet", GemShape::Droplet, |g| g.dmg_general = 1.5);

        let result = optimize_for_slots(
            &w,
            &[GemShape::Triangle],
            &[mismatched, droplet],
            &ZERO_STATS,
            DamageTarget::Total,
        );

        // Only the Droplet fits the Triangle slot: floor(100 * 1.5) = 150.
        assert_eq!(result.total, 150.0);
        assert_eq!(result.slots[0].gem.as_ref().unwrap().id, "droplet");
    }

    #[test]
    fn optimize_does_not_reuse_a_gem_beyond_its_count() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;

        // Two slots but only one strong gem instance; the second slot must fall
        // back to a different (weaker) instance rather than re-using the strong one.
        let strong = candidate("strong", GemShape::Radial, |g| g.dmg_general = 3.0);
        let filler = candidate("filler", GemShape::Radial, |g| g.flat_phys = 10.0);

        let result = optimize_for_slots(
            &w,
            &[GemShape::Radial, GemShape::Radial],
            &[strong, filler],
            &ZERO_STATS,
            DamageTarget::Total,
        );

        // physical = floor(100 * 3.0 + flat_phys 10) = 310; on a Dual weapon the
        // filler's flat_phys also feeds the blood line (floor(0 + 10) = 10), so
        // total = 310 + 10 = 320. Both distinct instances are used.
        assert_eq!(result.total, 320.0);
        let ids: Vec<&str> = result
            .slots
            .iter()
            .filter_map(|s| s.gem.as_ref().map(|g| g.id.as_str()))
            .collect();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"strong") && ids.contains(&"filler"));
    }

    #[test]
    fn optimize_pools_equivalent_gems_across_instances() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;

        // Two calc-identical gems with distinct refs fill two slots.
        let a = candidate("a", GemShape::Radial, |g| g.dmg_general = 1.5);
        let b = candidate("b", GemShape::Radial, |g| g.dmg_general = 1.5);

        let result = optimize_for_slots(
            &w,
            &[GemShape::Radial, GemShape::Radial],
            &[a, b],
            &ZERO_STATS,
            DamageTarget::Total,
        );

        // gen = 1.5 * 1.5 = 2.25 -> floor(100 * 2.25) = 225, using both instances.
        assert_eq!(result.total, 225.0);
        let ids: Vec<&str> = result
            .slots
            .iter()
            .filter_map(|s| s.gem.as_ref().map(|g| g.id.as_str()))
            .collect();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"a") && ids.contains(&"b"));
    }

    #[test]
    fn optimize_targets_a_single_element_line() {
        // Conversion weapon: target fire output specifically.
        let mut w = weapon("Test Cannon", WeaponType::Conv);
        w.phys = 100;

        let fire = candidate("fire", GemShape::Radial, |g| g.dmg_fire = 2.0);
        let bolt = candidate("bolt", GemShape::Radial, |g| g.dmg_bolt = 3.0);

        let result = optimize_for_slots(
            &w,
            &[GemShape::Radial],
            &[fire, bolt],
            &ZERO_STATS,
            DamageTarget::Fire,
        );

        // The fire gem maximizes the fire line: floor(elemBase(100) * 2.0) = 200.
        assert_eq!(result.score, 200.0);
        assert_eq!(result.breakdown.fire, 200.0);
        assert_eq!(result.slots[0].gem.as_ref().unwrap().id, "fire");
    }

    #[test]
    fn by_id_finds_generated_weapon() {
        let w = Weapon::by_id("amygdalan_arm").expect("amygdalan_arm exists");
        assert_eq!(w.name, "Amygdalan Arm");
        assert_eq!(w.phys, 160);
        assert_eq!(w.arcane, 80);
        assert_eq!(w.weapon_type, WeaponType::Dual);

        assert!(Weapon::by_id("nope").is_none());
    }
}
