//! Resolve a rune's raw effect ids to their in-game name and effect text.
//!
//! The table is code-generated from `data/runes.json` at compile time (ported
//! from the Noxde/Bloodborne-save-editor `runeEffects`); no JSON is read at
//! runtime.

/// One rune-effect row: the rune's name, its effect text, and its rating.
#[derive(Debug, Clone, Copy)]
pub struct RuneEffectInfo {
    pub name: &'static str,
    pub effect: &'static str,
    pub rating: u8,
}

include!(concat!(env!("OUT_DIR"), "/runes_generated.rs"));

/// Look up a rune effect by its numeric id (binary search; the table is sorted).
pub fn lookup_rune_effect(id: u32) -> Option<&'static RuneEffectInfo> {
    RUNE_EFFECTS
        .binary_search_by_key(&id, |&(eid, _)| eid)
        .ok()
        .map(|i| &RUNE_EFFECTS[i].1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_known_rune_effects() {
        let moon = lookup_rune_effect(1_100_000).expect("Moon rune effect");
        assert_eq!(moon.name, "Moon");
        assert_eq!(moon.rating, 0);

        let clawmark = lookup_rune_effect(1_107_002).expect("Clawmark rune effect");
        assert_eq!(clawmark.name, "Clawmark");
        assert_eq!(clawmark.rating, 2);

        assert!(lookup_rune_effect(999).is_none());
    }
}
