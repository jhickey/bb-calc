//! Bloodborne Attack Rating calculator.
//!
//! The crate is split into focused modules:
//!   - [`types`]     — core data types (weapons, gems, stats, AR breakdown)
//!   - [`calc`]      — the pure AR calc engine ([`compute_ar`])
//!   - [`optimizer`] — imprint-aware max-AR gem socketing ([`optimize_for_slots`])
//!   - [`gem_parser`]— parse friendly effect specs into gems ([`parse_gem_effects`])
//!   - [`save`]      — parsers for a decrypted save (gems, stats, name, effect map)
//!   - [`inventory`] — build a gem [`Inventory`] from a save ([`build_inventory_from_save`])
//!
//! The weapon and gem-effect tables are code-generated from `data/*.json` at
//! compile time (see `build.rs`); no JSON is read at runtime.

pub mod calc;
pub mod gem_parser;
pub mod inventory;
pub mod optimizer;
pub mod save;
pub mod types;

#[cfg(test)]
mod test_support;

// Flat re-export of the public surface so callers can use `bb_calc::Foo`.
pub use calc::{compute_ar, gem_sum};
pub use gem_parser::{base_gem, gem_from_ingame_effects, parse_gem_effects};
pub use inventory::{build_inventory_from_save, Inventory, InventoryGem, WithWarnings};
pub use optimizer::{
    optimize, shape_fits, Candidate, DamageTarget, GemRef, Mode, OptimizeResult, SlotChoice,
};
pub use save::{
    lookup_effect, parse_save_gems, parse_save_name, parse_save_stats, EffectInfo, RawSaveGem,
};
pub use types::{ArBreakdown, ConvertedElement, Gem, GemShape, Stats, Weapon, WeaponType};
