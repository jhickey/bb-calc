//! Build a player's gem [`Inventory`] from the bytes of a decrypted save.

use crate::save::{lookup_effect, parse_save_gems, parse_save_name, parse_save_stats};
use crate::types::{GemShape, Stats};
use serde::{Deserialize, Serialize};

/// Result that pairs produced data with non-fatal notes for the user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WithWarnings<T> {
    pub value: T,
    pub warnings: Vec<String>,
}

/// A gem the player owns, captured from a decrypted save.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryGem {
    /// Save instance id (hex u32) — stable and unique per physical gem.
    pub id: String,
    pub name: String,
    pub shape: GemShape,
    pub rating: u8,
    /// In-game effect strings, primary first (e.g. "Physical ATK UP +27.2%").
    pub effects: Vec<String>,
}

/// A player's gem collection plus where it came from.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Inventory {
    pub character: String,
    /// The four scaling stats read from the save, if available (optimizer default).
    pub stats: Stats,
    pub gems: Vec<InventoryGem>,
}

const UNKNOWN_GEM: &str = "Unknown gem";

/// Build an [`Inventory`] from the bytes of a decrypted save. Resolves each gem's
/// raw effect ids to their in-game strings; duplicate effect ids on one gem are
/// collapsed (a single-effect gem can store the same id in several slots).
pub fn build_inventory_from_save(bytes: &[u8]) -> WithWarnings<Inventory> {
    let mut warnings: Vec<String> = Vec::new();
    // Insertion-ordered set of effect ids that weren't in the effect map.
    let mut unknown_ids: Vec<u32> = Vec::new();

    let gems: Vec<InventoryGem> = parse_save_gems(bytes)
        .into_iter()
        .map(|raw| {
            let mut seen: Vec<u32> = Vec::new();
            let mut effects: Vec<String> = Vec::new();
            let mut name = UNKNOWN_GEM.to_string();
            let mut rating: u8 = 0;

            for (index, &effect_id) in raw.effect_ids.iter().enumerate() {
                if seen.contains(&effect_id) {
                    continue;
                }
                seen.push(effect_id);

                match lookup_effect(effect_id) {
                    None => {
                        if !unknown_ids.contains(&effect_id) {
                            unknown_ids.push(effect_id);
                        }
                    }
                    Some(info) => {
                        effects.push(info.effect.to_string());
                        // Slot 0 (the first resolvable effect) names the gem and
                        // sets its rating.
                        if index == 0 || name == UNKNOWN_GEM {
                            name = info.name.to_string();
                            rating = info.rating;
                        }
                    }
                }
            }

            InventoryGem {
                id: raw.id,
                name,
                shape: raw.shape,
                rating,
                effects,
            }
        })
        .collect();

    if !unknown_ids.is_empty() {
        let ids = unknown_ids
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(", ");
        warnings.push(format!(
            "{} effect id(s) not found in the effect map (kept as the gems that carry them, but their effect text is missing): {ids}",
            unknown_ids.len(),
        ));
    }

    let stats = parse_save_stats(bytes);
    if stats.is_none() {
        warnings.push(
            "Could not read character stats from the save; optimize will use defaults unless overridden."
                .to_string(),
        );
    }

    // The save is the source of truth for the character name.
    let character = parse_save_name(bytes);

    WithWarnings {
        value: Inventory {
            character: character.unwrap_or_else(|| "Unknown character".to_string()),
            stats: stats.unwrap_or_else(|| Stats {
                str: 0,
                skl: 0,
                blt: 0,
                arc: 0,
            }),
            gems,
        },
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NO_EFFECT: u32 = 0xffff_ffff;

    fn write_u32_le(arr: &mut [u8], offset: usize, value: u32) {
        arr[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    /// A 40-byte gem record (type 0x01) with the given id, shape, and effect ids.
    fn gem(id: u32, shape: u8, effect_ids: &[u32]) -> [u8; 40] {
        let mut r = [0u8; 40];
        write_u32_le(&mut r, 0, id);
        r[8] = 0x01;
        r[12] = shape;
        for slot in 0..6 {
            write_u32_le(
                &mut r,
                16 + slot * 4,
                effect_ids.get(slot).copied().unwrap_or(NO_EFFECT),
            );
        }
        r
    }

    /// 84-byte preamble + the given gem records.
    fn save(records: &[[u8; 40]]) -> Vec<u8> {
        let mut v = vec![0u8; 84];
        for r in records {
            v.extend_from_slice(r);
        }
        v
    }

    #[test]
    fn resolves_effect_ids_to_in_game_strings_name_and_rating() {
        let WithWarnings { value, .. } =
            build_inventory_from_save(&save(&[gem(0xc080_0041, 0x01, &[26619])]));
        assert_eq!(value.gems.len(), 1);
        let g = &value.gems[0];
        assert_eq!(g.id, "c0800041");
        assert_eq!(g.shape, GemShape::Radial);
        assert_eq!(g.rating, 19);
        assert_eq!(g.effects, vec!["Physical ATK UP +27.2%".to_string()]);
        assert_ne!(g.name, "Unknown gem");
    }

    #[test]
    fn collapses_duplicate_effect_ids_on_a_single_gem() {
        // A real save can repeat the same effect id across slots; count it once.
        let WithWarnings { value, .. } =
            build_inventory_from_save(&save(&[gem(0x1, 0x3f, &[17420, 17420, 17420, 17420])]));
        assert_eq!(
            value.gems[0].effects,
            vec!["Add physical ATK +45".to_string()]
        );
        assert_eq!(value.gems[0].rating, 20);
    }

    #[test]
    fn warns_about_unknown_effect_ids_but_keeps_the_gem() {
        let WithWarnings { value, warnings } =
            build_inventory_from_save(&save(&[gem(0x1, 0x01, &[999_999])]));
        assert_eq!(value.gems.len(), 1);
        assert!(value.gems[0].effects.is_empty());
        assert_eq!(value.gems[0].name, "Unknown gem");
        assert!(warnings.join(" ").contains("999999"));
    }

    #[test]
    fn reads_character_stats_from_the_save_when_present() {
        // Gems at the start and a FACE-anchored stat block well past them
        // (username ~1000, clear of the upgrades region at offset 84).
        const FACE_INDEX: usize = 35497; // username = 1000
        let u = FACE_INDEX - 34497;
        let mut buf = vec![0u8; FACE_INDEX + 16];
        buf[84..84 + 40].copy_from_slice(&gem(0xc080_0041, 0x01, &[26619])); // one gem
        buf[FACE_INDEX..FACE_INDEX + 4].copy_from_slice(&[0x46, 0x41, 0x43, 0x45]); // "FACE"
        buf[u - 79] = 50; // STR
        buf[u - 71] = 25; // SKL
        buf[u - 63] = 12; // BLT
        buf[u - 55] = 44; // ARC
        let WithWarnings { value, .. } = build_inventory_from_save(&buf);
        assert_eq!(value.gems.len(), 1);
        assert_eq!(
            value.stats,
            Stats {
                str: 50,
                skl: 25,
                blt: 12,
                arc: 44
            }
        );
    }

    #[test]
    fn omits_stats_and_warns_when_they_cant_be_read() {
        let WithWarnings { value, warnings } =
            build_inventory_from_save(&save(&[gem(0x1, 0x01, &[26619])]));
        assert_eq!(
            value.stats,
            Stats {
                str: 50,
                skl: 50,
                blt: 50,
                arc: 50
            }
        );
        assert!(
            warnings
                .join(" ")
                .contains("Could not read character stats")
        );
    }

    #[test]
    fn reads_the_character_name_from_the_save_when_present() {
        const FACE_INDEX: usize = 35497; // username = 1000
        let u = FACE_INDEX - 34497;
        let mut buf = vec![0u8; FACE_INDEX + 16];
        buf[84..84 + 40].copy_from_slice(&gem(0xc080_0041, 0x01, &[26619]));
        buf[FACE_INDEX..FACE_INDEX + 4].copy_from_slice(&[0x46, 0x41, 0x43, 0x45]); // "FACE"
        let name = "franq";
        for (i, code) in name.encode_utf16().enumerate() {
            buf[u + 1 + i * 2] = (code & 0xff) as u8;
            buf[u + 1 + i * 2 + 1] = (code >> 8) as u8;
        }
        let WithWarnings { value, .. } = build_inventory_from_save(&buf);
        assert_eq!(value.character, "franq");
    }
}
