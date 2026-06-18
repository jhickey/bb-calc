//! Build script: parses `data/weapons.json` at compile time and code-generates a
//! `static WEAPONS: &[Weapon]` array into `$OUT_DIR/weapons_generated.rs`, which
//! `src/lib.rs` pulls in with `include!`. The JSON is read only during the build,
//! so the compiled artifact carries the data with no runtime parsing or file access.

use std::collections::HashSet;
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
}

fn weapon_type_variant(kind: &str) -> &'static str {
    match kind {
        "Dual" => "WeaponType::Dual",
        "Conv" => "WeaponType::Conv",
        "Blood" => "WeaponType::Blood",
        other => panic!("unknown weapon type {other:?} in data/weapons.json"),
    }
}

fn main() {
    println!("cargo:rerun-if-changed=data/weapons.json");
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
}
