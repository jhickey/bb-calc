//! Parsers for a **decrypted** Bloodborne save (`userdataNNNN`). bb-calc never
//! decrypts saves; the user supplies an already-decrypted file (see
//! [`parse_save`] for the byte format and provenance).

mod anchor;
pub mod character;
pub mod effect_map;
pub mod items;
pub mod parse_name;
pub mod parse_save;
pub mod runes;

pub use character::{parse_save_character, parse_save_stats, CharacterStats};
pub use effect_map::{lookup_effect, EffectInfo};
pub use items::{
    parse_owned_items, ArmorKind, ItemCategory, ItemLocation, OwnedArmor, OwnedItem, OwnedItems,
    OwnedWeapon, WeaponHand, WeaponImprint,
};
pub use parse_name::parse_save_name;
pub use parse_save::{parse_save_gems, parse_save_runes, upgrades_region_end, RawSaveGem, RawSaveRune};
pub use runes::{lookup_rune_effect, RuneEffectInfo};
