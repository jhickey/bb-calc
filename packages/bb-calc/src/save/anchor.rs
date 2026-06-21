//! Shared anchoring for the character block of a decrypted Bloodborne save.
//!
//! The stats and the character name both live near the character block, which is
//! located off the "FACE" appearance marker (reverse-engineered + validated
//! against the Noxde/Bloodborne-save-editor fixtures, see README):
//!   - find "FACE" (the appearance section start)
//!   - inventory start = (FACE index + 4) − 4 − 34028   ⇒  FACE − 34028
//!   - username        = inventory start − 469          ⇒  FACE − 34497
//!
//! The "username" offset is the reference point both parsers hang off of (stats
//! sit at fixed negative offsets from it; the name string starts just before it).

const FACE: [u8; 4] = [0x46, 0x41, 0x43, 0x45]; // "FACE"
const APPEARANCE_TO_INVENTORY: i64 = 34028;
const USERNAME_TO_INVENTORY: i64 = 469;

fn find_face(bytes: &[u8]) -> Option<usize> {
    // Real saves are large and may contain "FACE"-like bytes early on, so the
    // reference scans from 0xF000; tiny buffers (tests) scan from the start.
    let start = if bytes.len() > 0xf000 { 0xf000 } else { 0 };
    let mut i = start;
    while i + 4 <= bytes.len() {
        if bytes[i..i + 4] == FACE {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// The FACE-anchored username offset, or `None` if the block can't be located.
pub fn find_username(bytes: &[u8]) -> Option<usize> {
    let face = find_face(bytes)? as i64;
    let username = face - APPEARANCE_TO_INVENTORY - USERNAME_TO_INVENTORY;
    if username >= 0 {
        Some(username as usize)
    } else {
        None
    }
}
