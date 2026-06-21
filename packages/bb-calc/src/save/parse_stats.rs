//! Read the four scaling stats (Strength, Skill, Bloodtinge, Arcane) from a
//! decrypted Bloodborne save. Pure, no I/O. Returns `None` if the stats block
//! can't be located or read (the optimizer then falls back to flag/defaults).
//!
//! Stats live near the character block, anchored off the FACE-derived username
//! (see [`find_username`]); each stat is a single byte at a fixed negative offset
//! from it.

use crate::save::anchor::find_username;
use crate::types::Stats;

/// Single-byte offsets from the username for each stat: str, skl, blt, arc.
const STAT_OFFSETS: [i64; 4] = [-79, -71, -63, -55];

pub fn parse_save_stats(bytes: &[u8]) -> Option<Stats> {
    let username = find_username(bytes)? as i64;

    let read = |rel: i64| -> Option<u8> {
        let offset = username + rel;
        if offset >= 0 && (offset as usize) < bytes.len() {
            Some(bytes[offset as usize])
        } else {
            None
        }
    };

    let values: [Option<u8>; 4] = [
        read(STAT_OFFSETS[0]),
        read(STAT_OFFSETS[1]),
        read(STAT_OFFSETS[2]),
        read(STAT_OFFSETS[3]),
    ];

    // A stat byte is 1..99; anything else means we mis-located the block.
    if values.iter().all(|v| matches!(v, Some(n) if (1..=99).contains(n))) {
        Some(Stats {
            str: values[0].unwrap() as u16,
            skl: values[1].unwrap() as u16,
            blt: values[2].unwrap() as u16,
            arc: values[3].unwrap() as u16,
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FACE_INDEX: usize = 34697; // → username 200
    const USERNAME: usize = FACE_INDEX - 34497;

    /// Build a buffer with "FACE" at FACE_INDEX and the four stat bytes in place.
    fn save_with(str_: u8, skl: u8, blt: u8, arc: u8) -> Vec<u8> {
        let mut b = vec![0u8; FACE_INDEX + 16];
        b[FACE_INDEX..FACE_INDEX + 4].copy_from_slice(&[0x46, 0x41, 0x43, 0x45]); // "FACE"
        b[USERNAME - 79] = str_;
        b[USERNAME - 71] = skl;
        b[USERNAME - 63] = blt;
        b[USERNAME - 55] = arc;
        b
    }

    #[test]
    fn reads_stats_relative_to_the_face_anchored_username() {
        let s = parse_save_stats(&save_with(50, 25, 10, 40)).expect("stats parse");
        assert_eq!((s.str, s.skl, s.blt, s.arc), (50, 25, 10, 40));
    }

    #[test]
    fn returns_none_when_there_is_no_face_marker() {
        assert!(parse_save_stats(&vec![0u8; 40000]).is_none());
    }

    #[test]
    fn returns_none_when_a_stat_byte_is_out_of_range() {
        let mut b = save_with(50, 25, 10, 40);
        b[USERNAME - 55] = 200; // arc impossible
        assert!(parse_save_stats(&b).is_none());
    }

    #[test]
    fn returns_none_for_a_too_small_buffer() {
        assert!(parse_save_stats(&[0u8; 10]).is_none());
    }
}
