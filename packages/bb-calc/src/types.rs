//! Core data types shared across the calc, optimizer, and save/inventory layers.

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
    // Scaling/enemy coefficients: read by the calc engine but not part of the
    // public surface, so they stay crate-visible (the generated `WEAPONS` table
    // and `compute_ar` both live in this crate).
    pub(crate) str_scale: f32,
    pub(crate) skl_scale: f32,
    pub(crate) blt_scale: f32,
    pub(crate) arc_scale: f32,
    pub(crate) serrated: f32,
    pub(crate) righteous: f32,
    pub(crate) serrated_tricked: f32,
    pub(crate) righteous_tricked: f32,
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
    /// `None` until a per-gem shape is sourced (e.g. from an inventory import).
    /// The calc never reads a gem's shape; the optimizer tracks it separately.
    pub shape: Option<GemShape>,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weapons_are_generated_from_json() {
        assert_eq!(WEAPONS.len(), 31);
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
