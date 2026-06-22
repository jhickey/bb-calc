//! Test-only constructors shared across the calc and optimizer test modules.

use crate::types::{Gem, GemShape, Stats, Weapon, WeaponType};

/// A weapon with no scaling and no base damage; tests override what they need.
pub(crate) fn weapon(name: &'static str, weapon_type: WeaponType) -> Weapon {
    Weapon {
        id: "",
        name,
        weapon_type,
        phys: 0,
        blood: 0,
        arcane: 0,
        fire: 0,
        bolt: 0,
        gem_slot_1: GemShape::Radial,
        gem_slot_2: GemShape::Radial,
        gem_slot_3: GemShape::Radial,
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
pub(crate) fn gem() -> Gem {
    Gem {
        name: "test".to_string(),
        source: "test".to_string(),
        tier: 0,
        shape: Some(GemShape::Radial),
        arc_scale: 0.0,
        str_scale: 0.0,
        skl_scale: 0.0,
        blt_scale: 0.0,
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

pub(crate) const ZERO_STATS: Stats = Stats {
    str: 0,
    skl: 0,
    blt: 0,
    arc: 0,
};
