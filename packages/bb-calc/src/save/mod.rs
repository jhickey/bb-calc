//! Parsers for a **decrypted** Bloodborne save (`userdataNNNN`). bb-calc never
//! decrypts saves; the user supplies an already-decrypted file (see
//! [`parse_save`] for the byte format and provenance).

mod anchor;
pub mod effect_map;
pub mod parse_name;
pub mod parse_save;
pub mod parse_stats;

pub use effect_map::{lookup_effect, EffectInfo};
pub use parse_name::parse_save_name;
pub use parse_save::{parse_save_gems, RawSaveGem};
pub use parse_stats::parse_save_stats;
