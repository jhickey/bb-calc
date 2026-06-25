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
    /// In-game numeric id for matching owned weapons from a save; `null` for
    /// calc-only variants (tricked / rune transforms) that aren't distinct items.
    canonical_id: Option<u32>,
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

/// One armor row keyed by its numeric save id (the JSON object's keys).
#[derive(Deserialize)]
struct RawArmor {
    name: String,
    kind: String,
}

fn armor_kind_variant(kind: &str) -> &'static str {
    match kind {
        "Head" => "ArmorKind::Head",
        "Chest" => "ArmorKind::Chest",
        "Hands" => "ArmorKind::Hands",
        "Legs" => "ArmorKind::Legs",
        "Other" => "ArmorKind::Other",
        other => panic!("unknown armor kind {other:?} in data/armor.json"),
    }
}

/// One rune-effect row keyed by its numeric effect id (the JSON object's keys).
#[derive(Deserialize)]
struct RawRune {
    name: String,
    effect: String,
    rating: u8,
}

/// Code-generate `static RUNE_EFFECTS: &[(u32, RuneEffectInfo)]`, sorted ascending
/// by id for binary search. `RuneEffectInfo` is defined in `save::runes`.
fn generate_runes(out_dir: &str) {
    let json = fs::read_to_string("data/runes.json").expect("read data/runes.json");
    let runes: BTreeMap<u32, RawRune> =
        serde_json::from_str(&json).expect("parse data/runes.json");

    let mut out = String::new();
    out.push_str("static RUNE_EFFECTS: &[(u32, RuneEffectInfo)] = &[\n");
    for (id, r) in &runes {
        write!(
            out,
            "    ({id}, RuneEffectInfo {{ name: {name:?}, effect: {effect:?}, rating: {rating} }}),\n",
            id = id,
            name = r.name,
            effect = r.effect,
            rating = r.rating,
        )
        .unwrap();
    }
    out.push_str("];\n");

    let dest = Path::new(out_dir).join("runes_generated.rs");
    fs::write(&dest, out).expect("write runes_generated.rs");
}

/// One item row keyed by its numeric save id (the JSON object's keys).
#[derive(Deserialize)]
struct RawItem {
    name: String,
    category: String,
}

fn item_category_variant(category: &str) -> &'static str {
    match category {
        "Consumable" => "ItemCategory::Consumable",
        "Material" => "ItemCategory::Material",
        "Key" => "ItemCategory::Key",
        "Chalice" => "ItemCategory::Chalice",
        other => panic!("unknown item category {other:?} in data/items.json"),
    }
}

/// Code-generate `static ITEMS: &[(u32, ItemInfo)]`, sorted ascending by id for
/// binary search. `ItemInfo`/`ItemCategory` are defined in `save::items`.
fn generate_items(out_dir: &str) {
    let json = fs::read_to_string("data/items.json").expect("read data/items.json");
    let items: BTreeMap<u32, RawItem> =
        serde_json::from_str(&json).expect("parse data/items.json");

    let mut out = String::new();
    out.push_str("static ITEMS: &[(u32, ItemInfo)] = &[\n");
    for (id, it) in &items {
        write!(
            out,
            "    ({id}, ItemInfo {{ name: {name:?}, category: {category} }}),\n",
            id = id,
            name = it.name,
            category = item_category_variant(&it.category),
        )
        .unwrap();
    }
    out.push_str("];\n");

    let dest = Path::new(out_dir).join("items_generated.rs");
    fs::write(&dest, out).expect("write items_generated.rs");
}

/// Code-generate `static ARMORS: &[(u32, ArmorInfo)]`, sorted ascending by id for
/// binary search. `ArmorInfo`/`ArmorKind` are defined in `save::items`, which
/// `include!`s this output.
fn generate_armor(out_dir: &str) {
    let json = fs::read_to_string("data/armor.json").expect("read data/armor.json");
    let armor: BTreeMap<u32, RawArmor> =
        serde_json::from_str(&json).expect("parse data/armor.json");

    let mut out = String::new();
    out.push_str("static ARMORS: &[(u32, ArmorInfo)] = &[\n");
    for (id, a) in &armor {
        write!(
            out,
            "    ({id}, ArmorInfo {{ name: {name:?}, kind: {kind} }}),\n",
            id = id,
            name = a.name,
            kind = armor_kind_variant(&a.kind),
        )
        .unwrap();
    }
    out.push_str("];\n");

    let dest = Path::new(out_dir).join("armor_generated.rs");
    fs::write(&dest, out).expect("write armor_generated.rs");
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

/// Code-generate `static OFFHAND_WEAPONS: &[(u32, &str)]`, sorted ascending by the
/// in-game canonical id so it can be binary-searched. These are left-hand weapons
/// (firearms/shields), which have no entry in the AR `WEAPONS` table but still need
/// a name when listing a save's owned weapons. The lookup lives in `save::items`.
fn generate_offhand_weapons(out_dir: &str) {
    let json =
        fs::read_to_string("data/weapons_offhand.json").expect("read data/weapons_offhand.json");
    // BTreeMap parses the JSON's string keys into u32 and keeps them ascending.
    let names: BTreeMap<u32, String> =
        serde_json::from_str(&json).expect("parse data/weapons_offhand.json");

    let mut out = String::new();
    out.push_str("static OFFHAND_WEAPONS: &[(u32, &str)] = &[\n");
    for (id, name) in &names {
        write!(out, "    ({id}, {name:?}),\n").unwrap();
    }
    out.push_str("];\n");

    let dest = Path::new(out_dir).join("offhand_weapons_generated.rs");
    fs::write(&dest, out).expect("write offhand_weapons_generated.rs");
}

fn main() {
    println!("cargo:rerun-if-changed=data/weapons.json");
    println!("cargo:rerun-if-changed=data/weapons_offhand.json");
    println!("cargo:rerun-if-changed=data/armor.json");
    println!("cargo:rerun-if-changed=data/items.json");
    println!("cargo:rerun-if-changed=data/runes.json");
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
             \x20       canonical_id: {canonical_id},\n\
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
            canonical_id = match w.canonical_id {
                Some(v) => format!("Some({v})"),
                None => "None".to_string(),
            },
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
    generate_offhand_weapons(&out_dir);
    generate_armor(&out_dir);
    generate_items(&out_dir);
    generate_runes(&out_dir);
}
