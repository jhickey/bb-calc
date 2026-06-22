//! Build script: parses the JSON tables under `data/` at compile time and
//! code-generates Rust source into `$OUT_DIR`, which the matching modules pull in
//! with `include!`:
//!   - `data/weapons.json`     → `weapons_generated.rs`  (`static WEAPONS`)
//!   - `data/gem-effects.json` → `effects_generated.rs`  (`static EFFECTS`)
//! The JSON is read only during the build, so the compiled artifact carries the
//! data with no runtime parsing or file access.

use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawWeapon {
    id: String,
    name: String,
    #[serde(rename = "type")]
    kind: String,
    phys: u16,
    blood: u16,
    arcane: u16,
    fire: u16,
    bolt: u16,
    str_scale: f32,
    skl_scale: f32,
    blt_scale: f32,
    arc_scale: f32,
    serrated: f32,
    righteous: f32,
    serrated_tricked: f32,
    righteous_tricked: f32,
    gem_slot1: String,
    gem_slot2: String,
    gem_slot3: String,
}

fn weapon_type_variant(kind: &str) -> &'static str {
    match kind {
        "Dual" => "WeaponType::Dual",
        "Conv" => "WeaponType::Conv",
        "Blood" => "WeaponType::Blood",
        other => panic!("unknown weapon type {other:?} in data/weapons.json"),
    }
}

fn gem_shape_variant(shape: &str) -> &'static str {
    match shape {
        "Radial" => "GemShape::Radial",
        "Triangle" => "GemShape::Triangle",
        "Waning" => "GemShape::Waning",
        "Circle" => "GemShape::Circle",
        "Droplet" => "GemShape::Droplet",
        other => panic!("unknown gem slot shape {other:?} in data/weapons.json"),
    }
}

/// One gem-effect row keyed by its numeric save id (the JSON object's keys).
#[derive(Deserialize)]
struct RawEffect {
    name: String,
    effect: String,
    rating: u8,
    level: u8,
}

/// Code-generate `static EFFECTS: &[(u32, EffectInfo)]`, sorted ascending by id so
/// `lookup_effect` can binary-search it. `EffectInfo` is defined in the module that
/// `include!`s this output (`src/save/effect_map.rs`).
fn generate_effects(out_dir: &str) {
    let json = fs::read_to_string("data/gem-effects.json").expect("read data/gem-effects.json");
    let effects: BTreeMap<u32, RawEffect> =
        serde_json::from_str(&json).expect("parse data/gem-effects.json");

    // BTreeMap iterates keys in ascending order, which is exactly the order the
    // generated table needs for the binary search in `lookup_effect`.
    let mut out = String::new();
    out.push_str("static EFFECTS: &[(u32, EffectInfo)] = &[\n");
    for (id, e) in &effects {
        write!(
            out,
            "    ({id}, EffectInfo {{ name: {name:?}, effect: {effect:?}, rating: {rating}, level: {level} }}),\n",
            id = id,
            name = e.name,
            effect = e.effect,
            rating = e.rating,
            level = e.level,
        )
        .unwrap();
    }
    out.push_str("];\n");

    let dest = Path::new(out_dir).join("effects_generated.rs");
    fs::write(&dest, out).expect("write effects_generated.rs");
}

fn main() {
    println!("cargo:rerun-if-changed=data/weapons.json");
    println!("cargo:rerun-if-changed=data/gem-effects.json");
    println!("cargo:rerun-if-changed=build.rs");

    let json = fs::read_to_string("data/weapons.json").expect("read data/weapons.json");
    let weapons: Vec<RawWeapon> = serde_json::from_str(&json).expect("parse data/weapons.json");

    let mut seen = HashSet::new();
    for w in &weapons {
        if !seen.insert(w.id.as_str()) {
            panic!("duplicate weapon id {:?} in data/weapons.json", w.id);
        }
    }

    let mut out = String::new();
    out.push_str("static WEAPONS: &[Weapon] = &[\n");
    for w in &weapons {
        write!(
            out,
            "    Weapon {{\n\
             \x20       id: {id:?},\n\
             \x20       name: {name:?},\n\
             \x20       weapon_type: {kind},\n\
             \x20       phys: {phys},\n\
             \x20       blood: {blood},\n\
             \x20       arcane: {arcane},\n\
             \x20       fire: {fire},\n\
             \x20       bolt: {bolt},\n\
             \x20       gem_slot_1: {gem_slot_1},\n\
             \x20       gem_slot_2: {gem_slot_2},\n\
             \x20       gem_slot_3: {gem_slot_3},\n\
             \x20       str_scale: {str_scale}f32,\n\
             \x20       skl_scale: {skl_scale}f32,\n\
             \x20       blt_scale: {blt_scale}f32,\n\
             \x20       arc_scale: {arc_scale}f32,\n\
             \x20       serrated: {serrated}f32,\n\
             \x20       righteous: {righteous}f32,\n\
             \x20       serrated_tricked: {serrated_tricked}f32,\n\
             \x20       righteous_tricked: {righteous_tricked}f32,\n\
             \x20   }},\n",
            id = w.id,
            name = w.name,
            kind = weapon_type_variant(&w.kind),
            phys = w.phys,
            blood = w.blood,
            arcane = w.arcane,
            fire = w.fire,
            bolt = w.bolt,
            gem_slot_1 = gem_shape_variant(&w.gem_slot1),
            gem_slot_2 = gem_shape_variant(&w.gem_slot2),
            gem_slot_3 = gem_shape_variant(&w.gem_slot3),
            str_scale = w.str_scale,
            skl_scale = w.skl_scale,
            blt_scale = w.blt_scale,
            arc_scale = w.arc_scale,
            serrated = w.serrated,
            righteous = w.righteous,
            serrated_tricked = w.serrated_tricked,
            righteous_tricked = w.righteous_tricked,
        )
        .unwrap();
    }
    out.push_str("];\n");

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR");
    let dest = Path::new(&out_dir).join("weapons_generated.rs");
    fs::write(&dest, out).expect("write weapons_generated.rs");

    generate_effects(&out_dir);
}
