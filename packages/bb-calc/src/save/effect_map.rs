//! Lookup from a save's numeric effect id to its in-game meaning.
//!
//! Backed by `data/gem-effects.json`, a pruned copy of the gem-effect table from
//! the open-source Noxde/Bloodborne-save-editor (GPL-3.0) — factual game data
//! (item ids ↔ descriptions), vendored with attribution (see README). bb-calc's
//! own parser code is an independent reimplementation, not ported from theirs.
//!
//! Like the weapon table, the JSON is code-generated into a `static EFFECTS` slice
//! by `build.rs` at compile time — no JSON is read at runtime. The slice is sorted
//! ascending by id so lookups are a binary search.

/// In-game meaning of a numeric effect id.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EffectInfo {
    pub name: &'static str,
    pub effect: &'static str,
    pub rating: u8,
    pub level: u8,
}

// `EFFECTS: &[(u32, EffectInfo)]` is code-generated from `data/gem-effects.json`,
// sorted ascending by id (see `build.rs`).
include!(concat!(env!("OUT_DIR"), "/effects_generated.rs"));

/// Resolve a numeric effect id to its info, or `None` if unknown.
pub fn lookup_effect(effect_id: u32) -> Option<&'static EffectInfo> {
    EFFECTS
        .binary_search_by_key(&effect_id, |(id, _)| *id)
        .ok()
        .map(|idx| &EFFECTS[idx].1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_known_effect_ids() {
        let temper = lookup_effect(26619).expect("26619 is a known effect");
        assert_eq!(temper.effect, "Physical ATK UP +27.2%");
        assert_eq!(temper.rating, 19);

        let abyssal = lookup_effect(17420).expect("17420 is a known effect");
        assert_eq!(abyssal.effect, "Add physical ATK +45");
        assert_eq!(abyssal.rating, 20);
    }

    #[test]
    fn returns_none_for_unknown_ids() {
        assert!(lookup_effect(999_999).is_none());
    }

    #[test]
    fn table_is_sorted_for_binary_search() {
        assert!(EFFECTS.windows(2).all(|w| w[0].0 < w[1].0));
    }
}
