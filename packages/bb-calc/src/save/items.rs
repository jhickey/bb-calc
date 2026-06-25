//! Parse a save's owned **weapons** (inventory + storage) and figure out which
//! gems are currently socketed in a weapon.
//!
//! Two regions cooperate (offsets/format reverse-engineered from the
//! Noxde/Bloodborne-save-editor, see README):
//!
//!   - The **article** regions (inventory and storage) are flat arrays of 16-byte
//!     slots anchored off the FACE-derived username. A weapon slot stores, at +8,
//!     a u32 "canonical id" that bakes in the weapon, its imprint, and its upgrade
//!     level (e.g. `2000900` = Chikage, Normal, +9).
//!
//!   - The **equipped-gems** region is a series of 60-byte blocks (one per owned
//!     weapon/armor) sitting between the gem/rune region and the username. Each
//!     block is keyed by the 8 bytes the matching article also carries at +4, and
//!     lists five gem slots. A weapon is only *real* if its key appears here —
//!     dropped/duplicate articles are left stale in the array, so this cross-
//!     reference is what separates owned weapons from garbage. It also tells us
//!     which gems are socketed.
//!
//! Every read is bounds-checked; a truncated or unexpected save yields fewer
//! weapons rather than panicking.

use crate::save::anchor::find_username;
use crate::save::parse_save::upgrades_region_end;
use crate::types::Weapon;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

include!(concat!(env!("OUT_DIR"), "/offhand_weapons_generated.rs"));

/// Look up a left-hand weapon's name by its canonical id (binary search).
fn offhand_name(canonical_id: u32) -> Option<&'static str> {
    OFFHAND_WEAPONS
        .binary_search_by_key(&canonical_id, |&(id, _)| id)
        .ok()
        .map(|i| OFFHAND_WEAPONS[i].1)
}

/// Which hand a weapon is wielded in. Left-hand weapons (firearms/shields) aren't
/// in the AR `WEAPONS` table, so they carry no `weapon_id`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WeaponHand {
    Right,
    Left,
}

/// A weapon's imprint, which determines its gem-slot shapes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WeaponImprint {
    Normal,
    Uncanny,
    Lost,
}

/// Where an owned item lives: the active inventory or the Hunter's Dream storage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ItemLocation {
    Inventory,
    Storage,
}

/// A weapon the player owns, decoded from a save.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OwnedWeapon {
    /// In-game id with the upgrade level stripped (base + imprint), e.g. `2000000`.
    pub canonical_id: u32,
    pub name: String,
    pub hand: WeaponHand,
    pub imprint: WeaponImprint,
    /// Upgrade level, 0..=10.
    pub level: u8,
    pub location: ItemLocation,
    /// The AR-table slug (e.g. `chikage`) when this is a right-hand weapon we can
    /// optimize; `None` for left-hand weapons not in the calc table.
    pub weapon_id: Option<String>,
    /// Instance ids (hex) of gems socketed in this weapon, in slot order. May
    /// include equipped runes, which callers filter against the gem inventory.
    pub gem_ids: Vec<String>,
}

/// The weapons a save owns plus the set of socketed gem instance ids (hex).
pub struct OwnedItems {
    pub weapons: Vec<OwnedWeapon>,
    pub socketed_gem_ids: Vec<String>,
}

const USERNAME_TO_INV: usize = 469;
const INV_TO_STORAGE: usize = 34268;
/// 1984 16-byte slots per region (the full-storage-glitch cap; the real arrays
/// are shorter and padded, so we rely on the slots cross-reference, not length).
const REGION_SLOTS: usize = 1984;
const ARTICLE_STRIDE: usize = 16;
const SLOT_BLOCK_LEN: usize = 60;
/// Health (-147) is the first username-block field; the slots region ends before it.
const USERNAME_CEILING_BACK: usize = 147;

const NO_GEM: u32 = 0xffff_ffff;
/// Garbage filler between slot blocks: little-endian `0xFFFFFFFF00000000`.
const SLOT_GARBAGE: u64 = 0xffff_ffff_0000_0000;

fn read_u32_le(bytes: &[u8], o: usize) -> u32 {
    u32::from_le_bytes([bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]])
}

fn read_u64_le(bytes: &[u8], o: usize) -> u64 {
    u64::from_le_bytes([
        bytes[o],
        bytes[o + 1],
        bytes[o + 2],
        bytes[o + 3],
        bytes[o + 4],
        bytes[o + 5],
        bytes[o + 6],
        bytes[o + 7],
    ])
}

/// Decode a slot-shape word; `Some(true)` = open slot, `Some(false)` = closed,
/// `None` = not a valid shape (so the candidate block is rejected).
fn slot_is_open(word: &[u8]) -> Option<bool> {
    match word {
        [0x00, 0x00, 0x00, 0x80] => Some(false), // Closed
        [0x01, 0x00, 0x00, 0x00] // Radial
        | [0x02, 0x00, 0x00, 0x00] // Triangle
        | [0x04, 0x00, 0x00, 0x00] // Waning
        | [0x08, 0x00, 0x00, 0x00] // Circle
        | [0x3f, 0x00, 0x00, 0x00] => Some(true), // Droplet
        _ => None,
    }
}

/// If `offset` begins a valid 60-byte equipped-gems block, return its key and the
/// gem ids sitting in its open slots. A block is valid only if its key is non-zero
/// and all five slot-shape words decode — a strong signature that rejects filler.
fn read_slot_block(bytes: &[u8], offset: usize) -> Option<(u64, Vec<u32>)> {
    if offset + SLOT_BLOCK_LEN > bytes.len() {
        return None;
    }
    let key = read_u64_le(bytes, offset);
    if key == 0 {
        return None;
    }
    let mut gems = Vec::new();
    // Five slots of 8 bytes (4 shape + 4 gem id) starting 20 bytes into the block.
    for slot in (offset + 20..offset + SLOT_BLOCK_LEN).step_by(8) {
        let open = slot_is_open(&bytes[slot..slot + 4])?;
        if open {
            let gem_id = read_u32_le(bytes, slot + 4);
            if gem_id != 0 && gem_id != NO_GEM {
                gems.push(gem_id);
            }
        }
    }
    Some((key, gems))
}

/// Build the map of equipped-gems block keys → socketed gem ids by walking the
/// region between the gem/rune area and the username block.
fn parse_equipped_slots(bytes: &[u8], username: usize) -> HashMap<u64, Vec<u32>> {
    let mut map = HashMap::new();
    let Some(ceiling) = username.checked_sub(USERNAME_CEILING_BACK) else {
        return map;
    };

    // Find the first valid block at or after the gem/rune region.
    let start = upgrades_region_end(bytes);
    let mut index = None;
    let mut scan = start;
    while scan < ceiling {
        if read_slot_block(bytes, scan).is_some() {
            index = Some(scan);
            break;
        }
        scan += 1;
    }
    let Some(mut index) = index else {
        return map;
    };

    while index < ceiling {
        let previous = index;

        // Consume consecutive blocks.
        while let Some((key, gems)) = read_slot_block(bytes, index) {
            map.insert(key, gems);
            index += SLOT_BLOCK_LEN;
        }

        // Skip the 8-byte garbage filler that separates runs of blocks.
        while index + 8 <= bytes.len() && read_u64_le(bytes, index) == SLOT_GARBAGE {
            index += 8;
        }

        // Never stall on data we don't recognise.
        if index == previous {
            index += 1;
        }
    }

    map
}

/// Decode the upgrade level and imprint from a weapon's canonical id.
/// Returns `None` for an imprint value we don't recognise.
fn level_and_imprint(canonical_with_level: u32) -> Option<(u8, WeaponImprint, u32)> {
    let level_part = canonical_with_level % 10_000;
    let level = (level_part / 100) as u8;
    let imprint = match (canonical_with_level % 100_000) - level_part {
        0 | 80_000 => WeaponImprint::Normal,
        10_000 => WeaponImprint::Uncanny,
        20_000 => WeaponImprint::Lost,
        _ => return None,
    };
    // Canonical id with the level digits stripped (base + imprint).
    let canonical_id = canonical_with_level - level_part;
    Some((level, imprint, canonical_id))
}

/// Walk one 16-byte article region, collecting real weapons (those whose key is in
/// `slots`). Armor and consumables are skipped via their type signature.
fn collect_weapons(
    bytes: &[u8],
    start: usize,
    location: ItemLocation,
    slots: &HashMap<u64, Vec<u32>>,
    out: &mut Vec<OwnedWeapon>,
) {
    let end = (start + REGION_SLOTS * ARTICLE_STRIDE).min(bytes.len());
    let mut i = start;
    while i + ARTICLE_STRIDE <= end {
        let signature = (bytes[i + 7], bytes[i + 11]);
        // (0xB0, 0x40) = consumable/material, (_, 0x10) = armor — neither is a weapon.
        let is_weapon_slot = !matches!(signature, (0xB0, 0x40) | (_, 0x10));
        let canonical_with_level = read_u32_le(bytes, i + 8);

        if is_weapon_slot && canonical_with_level != 0 {
            let key = read_u64_le(bytes, i + 4);
            if let Some(gem_ids) = slots.get(&key) {
                if let Some((level, imprint, canonical_id)) =
                    level_and_imprint(canonical_with_level)
                {
                    let (name, hand, weapon_id) =
                        if let Some(w) = Weapon::by_canonical_id(canonical_id) {
                            (w.name.to_string(), WeaponHand::Right, Some(w.id.to_string()))
                        } else if let Some(n) = offhand_name(canonical_id) {
                            (n.to_string(), WeaponHand::Left, None)
                        } else {
                            i += ARTICLE_STRIDE;
                            continue; // a real slot, but a weapon id we don't know
                        };

                    out.push(OwnedWeapon {
                        canonical_id,
                        name,
                        hand,
                        imprint,
                        level,
                        location,
                        weapon_id,
                        gem_ids: gem_ids.iter().map(|id| format!("{id:08x}")).collect(),
                    });
                }
            }
        }
        i += ARTICLE_STRIDE;
    }
}

/// Parse every owned weapon (inventory + storage) and the set of socketed gem ids.
pub fn parse_owned_items(bytes: &[u8]) -> Option<OwnedItems> {
    let username = find_username(bytes)?;
    let slots = parse_equipped_slots(bytes, username);

    let inv_start = username + USERNAME_TO_INV;
    let storage_start = inv_start + INV_TO_STORAGE;

    let mut weapons = Vec::new();
    collect_weapons(bytes, inv_start, ItemLocation::Inventory, &slots, &mut weapons);
    collect_weapons(bytes, storage_start, ItemLocation::Storage, &slots, &mut weapons);

    // Every gem id referenced by any equipped slot (callers intersect with the
    // gem inventory, which drops equipped runes that also live here).
    let mut socketed_gem_ids: Vec<String> = slots
        .values()
        .flatten()
        .map(|id| format!("{id:08x}"))
        .collect();
    socketed_gem_ids.sort();
    socketed_gem_ids.dedup();

    Some(OwnedItems {
        weapons,
        socketed_gem_ids,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_level_and_imprint_from_canonical_id() {
        // Chikage +9 Normal.
        assert_eq!(
            level_and_imprint(2_000_900),
            Some((9, WeaponImprint::Normal, 2_000_000))
        );
        // Beasthunter Saif +10 Lost.
        assert_eq!(
            level_and_imprint(23_021_000),
            Some((10, WeaponImprint::Lost, 23_020_000))
        );
        // Uncanny, +0.
        assert_eq!(
            level_and_imprint(38_010_000),
            Some((0, WeaponImprint::Uncanny, 38_010_000))
        );
    }

    #[test]
    fn offhand_lookup_resolves_firearms() {
        assert_eq!(offhand_name(14_000_000), Some("Hunter Pistol"));
        assert_eq!(offhand_name(14_100_000), Some("Evelyn"));
        assert_eq!(offhand_name(999), None);
    }

    /// A 60-byte equipped-gems block: 8-byte key, then five (shape, gem id) slots
    /// starting at +20. `shapes` gives each slot's 4-byte shape word.
    fn slot_block(key: u64, slots: &[([u8; 4], u32)]) -> [u8; 60] {
        let mut b = [0u8; 60];
        b[0..8].copy_from_slice(&key.to_le_bytes());
        b[16..20].copy_from_slice(&[0x01, 0x00, 0x00, 0x00]); // slots-start marker
        // Default all five slots to Closed; real blocks always carry valid shapes.
        for idx in 0..5 {
            b[20 + idx * 8..24 + idx * 8].copy_from_slice(&[0x00, 0x00, 0x00, 0x80]);
        }
        for (idx, (shape, gem)) in slots.iter().enumerate() {
            let o = 20 + idx * 8;
            b[o..o + 4].copy_from_slice(shape);
            b[o + 4..o + 8].copy_from_slice(&gem.to_le_bytes());
        }
        b
    }

    #[test]
    fn reads_open_slot_gems_and_rejects_invalid_blocks() {
        let radial = [0x01, 0x00, 0x00, 0x00];
        let closed = [0x00, 0x00, 0x00, 0x80];
        let block = slot_block(
            0x004c_4c6c_8080_01d0,
            &[(radial, 0xc080_0074), (radial, 0xc080_006f), (closed, 0)],
        );
        let (key, gems) = read_slot_block(&block, 0).expect("valid block");
        assert_eq!(key, 0x004c_4c6c_8080_01d0);
        assert_eq!(gems, vec![0xc080_0074, 0xc080_006f]);

        // A zero key is not a block.
        assert!(read_slot_block(&[0u8; 60], 0).is_none());
        // A bad shape word invalidates the whole block.
        let mut bad = block;
        bad[20] = 0x99;
        assert!(read_slot_block(&bad, 0).is_none());
    }
}
