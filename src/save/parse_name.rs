//! Read the character (hunter) name from a decrypted Bloodborne save. Pure, no
//! I/O. Returns `None` if the name can't be located or looks mis-read.
//!
//! The name is a left-aligned, null-padded UTF-16LE string that starts 1 byte
//! after the FACE-anchored username (see [`find_username`]) and runs up to the
//! in-game 16-character limit. Reading stops at the first NUL code unit.

use crate::save::anchor::find_username;

const NAME_OFFSET: usize = 1; // bytes after the username anchor where the string starts
const MAX_NAME_CHARS: usize = 16; // in-game hunter name limit

pub fn parse_save_name(bytes: &[u8]) -> Option<String> {
    let username = find_username(bytes)?;
    let start = username + NAME_OFFSET;

    let mut code_units: Vec<u16> = Vec::new();
    for i in 0..MAX_NAME_CHARS {
        let lo = start + i * 2;
        if lo + 1 >= bytes.len() {
            break;
        }
        let code = bytes[lo] as u16 | ((bytes[lo + 1] as u16) << 8);
        if code == 0 {
            break;
        }
        code_units.push(code);
    }

    let name = String::from_utf16_lossy(&code_units).trim().to_string();
    // Empty or any control char means we mis-located the block — reject it.
    let ok = !name.is_empty() && name.chars().all(|c| c as u32 >= 0x20);
    if ok {
        Some(name)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FACE_INDEX: usize = 34697; // → username 200
    const USERNAME: usize = FACE_INDEX - 34497;
    const NAME_START: usize = USERNAME + 1;

    /// Build a buffer with "FACE" at FACE_INDEX and a UTF-16LE name in place.
    fn save_with_name(name: &str) -> Vec<u8> {
        let mut b = vec![0u8; FACE_INDEX + 16];
        b[FACE_INDEX..FACE_INDEX + 4].copy_from_slice(&[0x46, 0x41, 0x43, 0x45]); // "FACE"
        for (i, code) in name.encode_utf16().enumerate() {
            b[NAME_START + i * 2] = (code & 0xff) as u8;
            b[NAME_START + i * 2 + 1] = (code >> 8) as u8;
        }
        b
    }

    #[test]
    fn reads_the_utf16le_name_relative_to_the_username() {
        assert_eq!(parse_save_name(&save_with_name("franq")).as_deref(), Some("franq"));
    }

    #[test]
    fn stops_at_the_nul_terminator_and_trims_space() {
        assert_eq!(parse_save_name(&save_with_name(" Eileen ")).as_deref(), Some("Eileen"));
    }

    #[test]
    fn caps_at_the_16_character_in_game_limit() {
        assert_eq!(
            parse_save_name(&save_with_name("0123456789ABCDEFGHIJ")).as_deref(),
            Some("0123456789ABCDEF"),
        );
    }

    #[test]
    fn returns_none_when_there_is_no_face_marker() {
        assert!(parse_save_name(&vec![0u8; 40000]).is_none());
    }

    #[test]
    fn returns_none_for_an_empty_name() {
        assert!(parse_save_name(&save_with_name("")).is_none());
    }

    #[test]
    fn returns_none_when_the_name_holds_a_control_char() {
        assert!(parse_save_name(&save_with_name("ab\u{01}cd")).is_none());
    }

    #[test]
    fn returns_none_for_a_too_small_buffer() {
        assert!(parse_save_name(&[0u8; 10]).is_none());
    }
}
