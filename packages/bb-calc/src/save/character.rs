//! Read a hunter's scalar character data from a decrypted Bloodborne save.
//! Pure, no I/O. Returns `None` if the character block can't be located.
//!
//! Most fields live near the character block and are anchored off the
//! FACE-derived username (see [`find_username`]); each is a little-endian value
//! at a fixed signed offset from it. Offsets were taken from the open-source
//! Noxde/Bloodborne-save-editor (the same reference the gem/stat parsing is
//! validated against) and re-verified against a real save:
//!
//!   relative to the username anchor (u32 LE):
//!     -147 health      -119 stamina     -103 vitality    -95 endurance
//!      -79 strength      -71 skill        -63 bloodtinge  -55 arcane
//!      -35 insight       -23 level        -19 blood echoes
//!   relative to the username anchor (single byte):
//!     +68831 new-game cycle (0 = NG, 1 = NG+1, …)
//!
//! Playtime is the exception: it is **not** username-relative. It sits in the
//! save header as a u32 LE millisecond counter at a fixed absolute offset.

use crate::save::anchor::find_username;
use crate::types::Stats;

/// Signed u32 offsets from the username anchor for each scalar field.
const HEALTH: i64 = -147;
const STAMINA: i64 = -119;
const VITALITY: i64 = -103;
const ENDURANCE: i64 = -95;
const STRENGTH: i64 = -79;
const SKILL: i64 = -71;
const BLOODTINGE: i64 = -63;
const ARCANE: i64 = -55;
const INSIGHT: i64 = -35;
const LEVEL: i64 = -23;
const BLOOD_ECHOES: i64 = -19;

/// The new-game cycle byte, relative to the username anchor.
const NEW_GAME: i64 = 68831;

/// Absolute offset of the playtime u32 LE (milliseconds) in the save header.
const PLAYTIME_OFFSET: usize = 0x08;

/// A hunter's scalar character data, read from a save. Excludes the name, which
/// has its own parser (see [`parse_save_name`](super::parse_save_name)).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CharacterStats {
    /// Soul level as stored in the save (the in-game level, not the stat sum).
    pub level: u32,
    pub vitality: u32,
    pub endurance: u32,
    pub strength: u32,
    pub skill: u32,
    pub bloodtinge: u32,
    pub arcane: u32,
    pub health: u32,
    pub stamina: u32,
    pub insight: u32,
    pub blood_echoes: u32,
    /// New-game cycle: 0 = NG, 1 = NG+1, 2 = NG+2, …
    pub new_game: u32,
    /// Total playtime in milliseconds.
    pub playtime_ms: u32,
}

/// Read a little-endian u32 at an absolute offset, or `None` if out of bounds.
fn read_u32_at(bytes: &[u8], offset: usize) -> Option<u32> {
    let end = offset.checked_add(4)?;
    if end <= bytes.len() {
        Some(u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]))
    } else {
        None
    }
}

/// Read the full scalar character block from a decrypted save.
///
/// The four scaling stats plus vitality and endurance are validated to be in
/// 1..=99; if any are out of range we assume the block was mis-located and
/// return `None`. The remaining fields are best-effort: a field that falls
/// outside the buffer (a truncated save, or playtime in a tiny test fixture)
/// reads as 0 rather than failing the whole parse.
pub fn parse_save_character(bytes: &[u8]) -> Option<CharacterStats> {
    let username = find_username(bytes)? as i64;

    // Read a u32 LE at a username-relative offset.
    let rel = |off: i64| -> Option<u32> {
        let abs = username.checked_add(off)?;
        if abs < 0 {
            return None;
        }
        read_u32_at(bytes, abs as usize)
    };

    let vitality = rel(VITALITY)?;
    let endurance = rel(ENDURANCE)?;
    let strength = rel(STRENGTH)?;
    let skill = rel(SKILL)?;
    let bloodtinge = rel(BLOODTINGE)?;
    let arcane = rel(ARCANE)?;

    // A leveled stat is 1..=99; anything else means we mis-located the block.
    let in_range = |v: u32| (1..=99).contains(&v);
    if ![vitality, endurance, strength, skill, bloodtinge, arcane]
        .iter()
        .all(|&v| in_range(v))
    {
        return None;
    }

    let new_game = username
        .checked_add(NEW_GAME)
        .filter(|&abs| abs >= 0)
        .and_then(|abs| bytes.get(abs as usize).copied())
        .map(u32::from)
        .unwrap_or(0);

    Some(CharacterStats {
        level: rel(LEVEL).unwrap_or(0),
        vitality,
        endurance,
        strength,
        skill,
        bloodtinge,
        arcane,
        health: rel(HEALTH).unwrap_or(0),
        stamina: rel(STAMINA).unwrap_or(0),
        insight: rel(INSIGHT).unwrap_or(0),
        blood_echoes: rel(BLOOD_ECHOES).unwrap_or(0),
        new_game,
        playtime_ms: read_u32_at(bytes, PLAYTIME_OFFSET).unwrap_or(0),
    })
}

/// Read just the four scaling stats (Strength, Skill, Bloodtinge, Arcane) that
/// drive weapon AR. A thin projection of [`parse_save_character`].
pub fn parse_save_stats(bytes: &[u8]) -> Option<Stats> {
    parse_save_character(bytes).map(|c| Stats {
        str: c.strength as u16,
        skl: c.skill as u16,
        blt: c.bloodtinge as u16,
        arc: c.arcane as u16,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // FACE must sit at/after the 0xF000 floor `find_username` scans from once a
    // buffer is large (real saves put it well past there); username 27000 keeps
    // the username+68831 new-game byte in bounds for the full-field test.
    const FACE_INDEX: usize = 61497; // → username 27000
    const USERNAME: usize = FACE_INDEX - 34497;

    /// A buffer with "FACE" at FACE_INDEX and the six leveling stats set so the
    /// block validates; callers can poke additional fields before parsing.
    fn save_with_stats(vit: u8, end: u8, str_: u8, skl: u8, blt: u8, arc: u8) -> Vec<u8> {
        // Sized to comfortably include the username+68831 new-game byte.
        let mut b = vec![0u8; USERNAME + 70_000];
        b[FACE_INDEX..FACE_INDEX + 4].copy_from_slice(&[0x46, 0x41, 0x43, 0x45]); // "FACE"
        b[USERNAME - 103] = vit;
        b[USERNAME - 95] = end;
        b[USERNAME - 79] = str_;
        b[USERNAME - 71] = skl;
        b[USERNAME - 63] = blt;
        b[USERNAME - 55] = arc;
        b
    }

    fn write_u32_le(b: &mut [u8], offset: usize, value: u32) {
        b[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    #[test]
    fn reads_every_scalar_field_off_the_anchor_and_header() {
        let mut b = save_with_stats(59, 40, 57, 60, 29, 27);
        write_u32_le(&mut b, USERNAME - 147, 1580); // health
        write_u32_le(&mut b, USERNAME - 119, 160); // stamina
        write_u32_le(&mut b, USERNAME - 35, 18); // insight
        write_u32_le(&mut b, USERNAME - 23, 222); // level
        write_u32_le(&mut b, USERNAME - 19, 3630); // blood echoes
        b[USERNAME + 68831] = 2; // new-game cycle (NG+2)
        write_u32_le(&mut b, 0x08, 241_456_050); // playtime ms (67:04:16)

        let c = parse_save_character(&b).expect("character parses");
        assert_eq!(
            c,
            CharacterStats {
                level: 222,
                vitality: 59,
                endurance: 40,
                strength: 57,
                skill: 60,
                bloodtinge: 29,
                arcane: 27,
                health: 1580,
                stamina: 160,
                insight: 18,
                blood_echoes: 3630,
                new_game: 2,
                playtime_ms: 241_456_050,
            }
        );
    }

    #[test]
    fn projects_the_four_scaling_stats() {
        let b = save_with_stats(59, 40, 57, 60, 29, 27);
        assert_eq!(
            parse_save_stats(&b),
            Some(Stats {
                str: 57,
                skl: 60,
                blt: 29,
                arc: 27
            })
        );
    }

    #[test]
    fn returns_none_when_a_leveling_stat_is_out_of_range() {
        let mut b = save_with_stats(59, 40, 57, 60, 29, 27);
        b[USERNAME - 103] = 0; // vitality can't be 0
        assert!(parse_save_character(&b).is_none());
    }

    #[test]
    fn returns_none_when_there_is_no_face_marker() {
        assert!(parse_save_character(&vec![0u8; 40000]).is_none());
    }

    #[test]
    fn defaults_out_of_bounds_fields_to_zero_without_failing() {
        // A buffer just large enough to validate the stats but too short to hold
        // the new-game byte: parse still succeeds with new_game defaulted to 0.
        let mut b = vec![0u8; FACE_INDEX + 16];
        b[FACE_INDEX..FACE_INDEX + 4].copy_from_slice(&[0x46, 0x41, 0x43, 0x45]);
        b[USERNAME - 103] = 50; // vit
        b[USERNAME - 95] = 50; // end
        b[USERNAME - 79] = 50; // str
        b[USERNAME - 71] = 50; // skl
        b[USERNAME - 63] = 50; // blt
        b[USERNAME - 55] = 50; // arc
        let c = parse_save_character(&b).expect("parses despite short buffer");
        assert_eq!(c.new_game, 0);
    }
}
