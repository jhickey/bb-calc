//! Pure parser for the "upgrades" region of a **decrypted** Bloodborne save.
//!
//! bb-calc never decrypts saves (it has no keys) — the user produces a decrypted
//! `userdataNNNN` file externally (Save Wizard or a community resign bot; a PS4
//! title's save decrypts the same way even when run on a PS5) and feeds it here.
//!
//! Gems and runes share one fixed-layout region at the very start of the save, so
//! the gem list is the simplest thing in the file to read — no username/appearance
//! anchoring needed. The byte format below is fact, reverse-engineered and validated
//! against the open-source Noxde/Bloodborne-save-editor fixtures (see README).
//!
//!   - region starts at byte 84, one record every 40 bytes
//!   - the region ends at the first record whose type+shape signature is neither a
//!     gem nor a rune (matching the editor's own end-detection)
//!   - per 40-byte record:
//!       +0   u32 LE  id      (unique per instance — our stable inventory key)
//!       +4   u32 LE  source  (provenance; unused for AR)
//!       +8   u8      type    0x01 = gem, 0x02 = rune
//!       +12  u8      shape   0x01 Radial / 0x02 Triangle / 0x04 Waning / 0x08 Circle / 0x3F Droplet
//!       +16  6×u32 LE effect ids (slots 0-5); 0xFFFFFFFF = "No Effect" (padding)
//!
//! The input is untrusted: every read is bounds-checked and a truncated/garbage
//! file yields an empty/short list rather than panicking.

use crate::types::GemShape;

/// A gem as it appears in the save: identity, shape, and raw effect ids.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawSaveGem {
    /// u32 (little-endian) rendered as lowercase hex, e.g. "c0800041". Stable key.
    pub id: String,
    pub shape: GemShape,
    /// Non-padding effect ids in slot order (the "No Effect" 0xFFFFFFFF slots dropped).
    pub effect_ids: Vec<u32>,
}

const REGION_START: usize = 84;
const STRIDE: usize = 40;
const TYPE_GEM: u8 = 0x01;
const TYPE_RUNE: u8 = 0x02;
const NO_EFFECT: u32 = 0xffff_ffff;

/// Map a shape byte to its [`GemShape`], or `None` if it isn't a known gem shape.
fn gem_shape(shape_byte: u8) -> Option<GemShape> {
    match shape_byte {
        0x01 => Some(GemShape::Radial),
        0x02 => Some(GemShape::Triangle),
        0x04 => Some(GemShape::Waning),
        0x08 => Some(GemShape::Circle),
        0x3f => Some(GemShape::Droplet),
        _ => None,
    }
}

fn read_u32_le(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

/// A record is a valid upgrade only if its type+shape pair is a known gem or rune.
fn is_upgrade_record(type_byte: u8, shape_byte: u8) -> bool {
    match type_byte {
        TYPE_GEM => gem_shape(shape_byte).is_some(),
        TYPE_RUNE => shape_byte == 0x01 || shape_byte == 0x02,
        _ => false,
    }
}

/// The byte offset just past the gem/rune (upgrades) region — i.e. the first
/// record that is neither a gem nor a rune, or the buffer end. The equipped-gem
/// "slots" blocks begin somewhere after this point.
pub fn upgrades_region_end(bytes: &[u8]) -> usize {
    let mut i = REGION_START;
    while i + STRIDE <= bytes.len() {
        let clean_words = bytes[i + 9] == 0
            && bytes[i + 10] == 0
            && bytes[i + 11] == 0
            && bytes[i + 13] == 0
            && bytes[i + 14] == 0
            && bytes[i + 15] == 0;
        if !clean_words || !is_upgrade_record(bytes[i + 8], bytes[i + 12]) {
            break;
        }
        i += STRIDE;
    }
    i
}

/// Extract every gem in the save (equipped and stored alike). Runes are walked
/// through — they share the region — but filtered out of the result.
pub fn parse_save_gems(bytes: &[u8]) -> Vec<RawSaveGem> {
    let mut gems = Vec::new();

    let mut i = REGION_START;
    while i + STRIDE <= bytes.len() {
        let type_byte = bytes[i + 8];
        let shape_byte = bytes[i + 12];

        // The 3 high bytes of the type/shape words are always zero for a real
        // record; any other pattern means we've walked off the end of the region.
        let clean_words = bytes[i + 9] == 0
            && bytes[i + 10] == 0
            && bytes[i + 11] == 0
            && bytes[i + 13] == 0
            && bytes[i + 14] == 0
            && bytes[i + 15] == 0;
        if !clean_words || !is_upgrade_record(type_byte, shape_byte) {
            break;
        }

        if type_byte == TYPE_GEM {
            let mut effect_ids = Vec::new();
            for slot in 0..6 {
                let id = read_u32_le(bytes, i + 16 + slot * 4);
                if id != NO_EFFECT {
                    effect_ids.push(id);
                }
            }
            gems.push(RawSaveGem {
                id: format!("{:08x}", read_u32_le(bytes, i)),
                // `is_upgrade_record` guaranteed this is a known gem shape.
                shape: gem_shape(shape_byte).expect("gem shape validated above"),
                effect_ids,
            });
        }

        i += STRIDE;
    }

    gems
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_u32_le(arr: &mut [u8], offset: usize, value: u32) {
        arr[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    /// Build a 40-byte upgrade record. type 0x01 = gem, 0x02 = rune.
    fn record(type_byte: u8, id: u32, shape: u8, effect_ids: &[u32]) -> [u8; 40] {
        let mut r = [0u8; 40];
        write_u32_le(&mut r, 0, id);
        write_u32_le(&mut r, 4, 0x8001_6026); // source — arbitrary
        r[8] = type_byte;
        r[12] = shape;
        for slot in 0..6 {
            write_u32_le(&mut r, 16 + slot * 4, effect_ids.get(slot).copied().unwrap_or(NO_EFFECT));
        }
        r
    }

    /// 84-byte preamble (skipped) + the given records.
    fn save(records: &[[u8; 40]]) -> Vec<u8> {
        let mut v = vec![0u8; 84];
        for r in records {
            v.extend_from_slice(r);
        }
        v
    }

    #[test]
    fn reads_a_gems_id_shape_and_non_padding_effect_ids() {
        let bytes = save(&[record(0x01, 0xc080_0041, 0x01, &[26619])]);
        assert_eq!(
            parse_save_gems(&bytes),
            vec![RawSaveGem {
                id: "c0800041".to_string(),
                shape: GemShape::Radial,
                effect_ids: vec![26619],
            }]
        );
    }

    #[test]
    fn maps_every_shape_byte() {
        let bytes = save(&[
            record(0x01, 0x01, 0x01, &[1]),
            record(0x01, 0x02, 0x02, &[1]),
            record(0x01, 0x03, 0x04, &[1]),
            record(0x01, 0x04, 0x08, &[1]),
            record(0x01, 0x05, 0x3f, &[1]),
        ]);
        let shapes: Vec<GemShape> = parse_save_gems(&bytes).iter().map(|g| g.shape).collect();
        assert_eq!(
            shapes,
            vec![
                GemShape::Radial,
                GemShape::Triangle,
                GemShape::Waning,
                GemShape::Circle,
                GemShape::Droplet,
            ]
        );
    }

    #[test]
    fn keeps_distinct_effect_slots_drops_padding() {
        let bytes = save(&[record(0x01, 0xc080_0067, 0x3f, &[26619, 17420])]);
        assert_eq!(parse_save_gems(&bytes)[0].effect_ids, vec![26619, 17420]);
    }

    #[test]
    fn walks_past_runes_but_excludes_them() {
        let bytes = save(&[
            record(0x01, 0xc080_0041, 0x01, &[26619]),
            record(0x02, 0xc080_0042, 0x01, &[1_100_000]), // rune
            record(0x01, 0xc080_0067, 0x3f, &[17420]),
        ]);
        let ids: Vec<String> = parse_save_gems(&bytes).into_iter().map(|g| g.id).collect();
        assert_eq!(ids, vec!["c0800041".to_string(), "c0800067".to_string()]);
    }

    #[test]
    fn stops_at_the_first_non_upgrade_record() {
        let mut garbage = [0u8; 40];
        garbage[8] = 0x99; // not a gem or rune type
        let bytes = save(&[
            record(0x01, 0xc080_0041, 0x01, &[26619]),
            garbage,
            record(0x01, 0x9, 0x01, &[1]),
        ]);
        let ids: Vec<String> = parse_save_gems(&bytes).into_iter().map(|g| g.id).collect();
        assert_eq!(ids, vec!["c0800041".to_string()]);
    }

    #[test]
    fn returns_nothing_for_empty_or_non_save_bytes() {
        assert!(parse_save_gems(&[0u8; 10]).is_empty());
        assert!(parse_save_gems(&[0u8; 200]).is_empty());
    }
}
