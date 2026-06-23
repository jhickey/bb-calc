//! Imprint-aware max-AR optimizer. Pure (no I/O) like the calc engine.
//!
//! Given a weapon, the slot shapes of one imprint variant, and the gems a player
//! owns (each with a shape), it finds the legal socketing that maximizes
//! [`compute_ar`]. "Legal" means each chosen gem instance is used at most once and
//! its shape fits the slot it goes in.

use crate::calc::compute_ar;
use crate::types::{ArBreakdown, Gem, GemShape, Stats, Weapon};
use crate::{gem_from_ingame_effects, InventoryGem};
use std::collections::HashMap;
use std::sync::mpsc;
use std::thread;

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
    pub weapon_id: String,
    /// The value of the optimized metric (see [`DamageTarget`]).
    pub score: f32,
    /// The full Attack Rating of the winning socketing, regardless of target.
    pub total: f32,
    pub breakdown: ArBreakdown,
    pub slots: Vec<SlotChoice>,
}

impl PartialEq for OptimizeResult {
    fn eq(&self, other: &Self) -> bool {
        self.score == other.score
    }
}

impl Eq for OptimizeResult {}

impl PartialOrd for OptimizeResult {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for OptimizeResult {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.total.total_cmp(&other.total)
    }
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
    fn gems_for(&self, chosen: &[Option<usize>]) -> [Option<&Gem>; 3] {
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
fn optimize_gems_for_weapon<'a>(
    weapon: &'a Weapon,
    candidates: &[Candidate],
    stats: &Stats,
    target: DamageTarget,
) -> OptimizeResult {
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

    let slot_shapes = [weapon.gem_slot_1, weapon.gem_slot_2, weapon.gem_slot_3];

    let mut search = Search {
        weapon,
        stats,
        target,
        slot_shapes: &slot_shapes,
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
            SlotChoice {
                slot,
                slot_shape,
                gem,
            }
        })
        .collect();

    let gems = search.gems_for(&search.best_chosen);
    let breakdown = compute_ar(weapon, gems, stats);
    OptimizeResult {
        weapon_id: weapon.id.clone().to_string(),
        score: search.best_score,
        total: breakdown.total,
        breakdown,
        slots,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{gem, weapon, ZERO_STATS};
    use crate::types::WeaponType;

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
        // Constrain to a single usable Radial slot so the two Radial gems compete
        // for it; the other two slots take a shape neither gem fits.
        w.gem_slot_1 = GemShape::Radial;
        w.gem_slot_2 = GemShape::Triangle;
        w.gem_slot_3 = GemShape::Triangle;

        let weak = candidate("weak", GemShape::Radial, |g| g.dmg_general = 1.2);
        let strong = candidate("strong", GemShape::Radial, |g| g.dmg_general = 2.0);

        let result =
            optimize_gems_for_weapon(&w, &[weak, strong], &ZERO_STATS, DamageTarget::Total);

        // Only the one Radial slot is fillable -> the 2.0x gem wins: floor(100 * 2.0) = 200.
        assert_eq!(result.score, 200.0);
        assert_eq!(result.total, 200.0);
        assert_eq!(result.slots.len(), 3);
        assert_eq!(result.slots[0].gem.as_ref().unwrap().id, "strong");
    }

    #[test]
    fn optimize_respects_shape_fit_with_droplet_wildcard() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;
        // Every slot is Triangle: the strong Radial gem fits none of them, while
        // the weaker Droplet wildcard fits any.
        w.gem_slot_1 = GemShape::Triangle;
        w.gem_slot_2 = GemShape::Triangle;
        w.gem_slot_3 = GemShape::Triangle;

        // A strong gem that does not fit a Triangle slot, and a weaker Droplet
        // wildcard that does.
        let mismatched = candidate("radial", GemShape::Radial, |g| g.dmg_general = 5.0);
        let droplet = candidate("droplet", GemShape::Droplet, |g| g.dmg_general = 1.5);

        let result =
            optimize_gems_for_weapon(&w, &[mismatched, droplet], &ZERO_STATS, DamageTarget::Total);

        // Only the single Droplet instance can be slotted: floor(100 * 1.5) = 150.
        assert_eq!(result.total, 150.0);
        let placed: Vec<&str> = result
            .slots
            .iter()
            .filter_map(|s| s.gem.as_ref().map(|g| g.id.as_str()))
            .collect();
        assert_eq!(placed, vec!["droplet"]);
    }

    #[test]
    fn optimize_does_not_reuse_a_gem_beyond_its_count() {
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;

        // Two slots but only one strong gem instance; the second slot must fall
        // back to a different (weaker) instance rather than re-using the strong one.
        let strong = candidate("strong", GemShape::Radial, |g| g.dmg_general = 3.0);
        let filler = candidate("filler", GemShape::Radial, |g| g.flat_phys = 10.0);

        let result =
            optimize_gems_for_weapon(&w, &[strong, filler], &ZERO_STATS, DamageTarget::Total);

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

        let result = optimize_gems_for_weapon(&w, &[a, b], &ZERO_STATS, DamageTarget::Total);

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
    fn optimize_uses_the_weapons_baked_in_slots() {
        // Two Radial slots and one Triangle, baked into the weapon. A strong Radial
        // gem fills both Radial slots; only a Droplet (or Triangle) can take slot 3.
        let mut w = weapon("Test Blade", WeaponType::Dual);
        w.phys = 100;
        w.gem_slot_1 = GemShape::Radial;
        w.gem_slot_2 = GemShape::Radial;
        w.gem_slot_3 = GemShape::Triangle;

        let radial = candidate("radial", GemShape::Radial, |g| g.dmg_general = 1.5);
        let radial2 = candidate("radial2", GemShape::Radial, |g| g.dmg_general = 1.5);
        let triangle = candidate("triangle", GemShape::Triangle, |g| g.dmg_general = 1.5);

        let result = optimize_gems_for_weapon(
            &w,
            &[radial, radial2, triangle],
            &ZERO_STATS,
            DamageTarget::Total,
        );

        // All three slots fill: 1.5^3 = 3.375 -> floor(100 * 3.375) = 337.
        assert_eq!(result.total, 337.0);
        assert_eq!(result.slots.len(), 3);
        assert_eq!(result.slots[2].slot_shape, GemShape::Triangle);
        // The Radial gem cannot land in the Triangle slot; the Triangle gem must.
        assert_eq!(result.slots[2].gem.as_ref().unwrap().id, "triangle");
    }

    #[test]
    fn optimize_targets_a_single_element_line() {
        // Conversion weapon: target fire output specifically.
        let mut w = weapon("Test Cannon", WeaponType::Conv);
        w.phys = 100;
        // A single usable Radial slot so the fire and bolt gems compete for it.
        w.gem_slot_1 = GemShape::Radial;
        w.gem_slot_2 = GemShape::Triangle;
        w.gem_slot_3 = GemShape::Triangle;

        let fire = candidate("fire", GemShape::Radial, |g| g.dmg_fire = 2.0);
        let bolt = candidate("bolt", GemShape::Radial, |g| g.dmg_bolt = 3.0);

        let result = optimize_gems_for_weapon(&w, &[fire, bolt], &ZERO_STATS, DamageTarget::Fire);

        // With one slot and a Fire target, the fire gem wins over the (higher
        // total) bolt gem: floor(elemBase(100) * 2.0) = 200.
        assert_eq!(result.score, 200.0);
        assert_eq!(result.breakdown.fire, 200.0);
        let placed: Vec<&str> = result
            .slots
            .iter()
            .filter_map(|s| s.gem.as_ref().map(|g| g.id.as_str()))
            .collect();
        assert_eq!(placed, vec!["fire"]);
    }
}

fn get_gem_candidates(
    gems: &Vec<InventoryGem>,
    excluded: Option<&Vec<String>>,
) -> (Vec<Candidate>, Vec<String>) {
    let mut skipped: Vec<String> = Vec::new();
    let candidates: Vec<Candidate> = gems
        .iter()
        .map(|g| {
            let (gem, mut unmapped) = gem_from_ingame_effects(&g.name, &g.effects);
            skipped.append(&mut unmapped);
            Candidate {
                gem,
                shape: g.shape,
                gem_ref: GemRef {
                    id: g.id.clone(),
                    name: g.name.clone(),
                    effects: g.effects.clone(),
                },
            }
        })
        .filter(|c| excluded.is_none() || !excluded.as_ref().unwrap().contains(&c.gem_ref.id))
        .collect();
    (candidates, skipped)
}

pub enum Mode {
    Compare,
    Plan,
}

pub fn optimize(
    weapons: Vec<&'static Weapon>,
    gems: Vec<InventoryGem>,
    stats: &Stats,
    target: DamageTarget,
    mode: Mode,
    excluded_gems: Option<Vec<String>>,
) -> Vec<OptimizeResult> {
    let (candidates, _) = get_gem_candidates(&gems, None);

    let (tx, rx) = mpsc::channel();

    match mode {
        Mode::Compare => {
            for w in weapons {
                let tx = tx.clone();
                let candidates = candidates.clone();
                let stats = stats.clone();
                thread::spawn(move || {
                    let result = optimize_gems_for_weapon(w, &candidates, &stats, target);
                    tx.send(result).unwrap();
                });
            }
            drop(tx);
            let mut results = rx.into_iter().collect::<Vec<_>>();
            results.sort();
            results
        }
        Mode::Plan => {
            let mut results: Vec<OptimizeResult> = Vec::new();
            let mut excluded: Vec<String> = excluded_gems.clone().unwrap_or_default();
            for weapon in weapons {
                let (candidates, _) = get_gem_candidates(&gems, Some(&excluded));
                let result = optimize_gems_for_weapon(weapon, &candidates, &stats, target);
                result.slots.iter().for_each(|slot| {
                    if let Some(gem) = &slot.gem {
                        excluded.push(gem.id.clone());
                    }
                });
                results.push(result);
            }
            results
        }
    }
}
