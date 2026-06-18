#![deny(clippy::all)]

use bb_calc::{
  compute_ar as bb_compute_ar, ArBreakdown as BbArBreakdown, ConvertedElement as BbConvertedElement,
  Gem as BbGem, GemShape as BbGemShape, Stats as BbStats, Weapon as BbWeapon,
  WeaponType as BbWeaponType,
};
use napi::bindgen_prelude::{Error, Result, Status};
use napi_derive::napi;

/// How a weapon's damage is derived (mirrors `bb_calc::WeaponType`).
#[napi(string_enum)]
pub enum WeaponType {
  Dual,
  Conv,
  Blood,
}

impl From<BbWeaponType> for WeaponType {
  fn from(value: BbWeaponType) -> Self {
    match value {
      BbWeaponType::Dual => WeaponType::Dual,
      BbWeaponType::Conv => WeaponType::Conv,
      BbWeaponType::Blood => WeaponType::Blood,
    }
  }
}

/// A weapon and its base damage values, exposed to JavaScript.
#[napi(object)]
pub struct Weapon {
  pub id: String,
  pub name: String,
  pub weapon_type: WeaponType,
  pub phys: u32,
  pub blood: u32,
  pub arcane: u32,
  pub fire: u32,
  pub bolt: u32,
}

impl From<&BbWeapon> for Weapon {
  fn from(value: &BbWeapon) -> Self {
    Weapon {
      id: value.id.to_string(),
      name: value.name.to_string(),
      weapon_type: value.weapon_type.into(),
      phys: value.phys as u32,
      blood: value.blood as u32,
      arcane: value.arcane as u32,
      fire: value.fire as u32,
      bolt: value.bolt as u32,
    }
  }
}

/// Returns every weapon in the game.
#[napi]
pub fn get_weapons() -> Vec<Weapon> {
  BbWeapon::all().iter().map(Weapon::from).collect()
}

/// The physical shape of a blood gem (mirrors `bb_calc::GemShape`).
#[derive(Clone, Copy)]
#[napi(string_enum)]
pub enum GemShape {
  Radial,
  Triangle,
  Waning,
  Circle,
}

impl From<GemShape> for BbGemShape {
  fn from(value: GemShape) -> Self {
    match value {
      GemShape::Radial => BbGemShape::Radial,
      GemShape::Triangle => BbGemShape::Triangle,
      GemShape::Waning => BbGemShape::Waning,
      GemShape::Circle => BbGemShape::Circle,
    }
  }
}

/// The element a "Conv" weapon's physical damage is converted to.
#[napi(string_enum)]
pub enum ConvertedElement {
  Phys,
  Bolt,
  Fire,
  Arc,
}

impl From<BbConvertedElement> for ConvertedElement {
  fn from(value: BbConvertedElement) -> Self {
    match value {
      BbConvertedElement::Phys => ConvertedElement::Phys,
      BbConvertedElement::Bolt => ConvertedElement::Bolt,
      BbConvertedElement::Fire => ConvertedElement::Fire,
      BbConvertedElement::Arc => ConvertedElement::Arc,
    }
  }
}

/// A blood gem. Multiplier fields (`dmg*`) default to `1.0` for no effect;
/// scaling and flat (`*scale`, `flat*`) fields default to `0.0`.
#[napi(object)]
pub struct Gem {
  pub name: String,
  pub source: String,
  pub tier: u32,
  pub shape: GemShape,
  pub arc_scale: f64,
  pub str_scale: f64,
  pub dmg_general: f64,
  pub dmg_arcane: f64,
  pub dmg_fire: f64,
  pub dmg_bolt: f64,
  pub dmg_phys: f64,
  pub dmg_blood: f64,
  pub dmg_blunt: f64,
  pub dmg_thrust: f64,
  pub flat_phys: f64,
  pub flat_arcane: f64,
  pub flat_fire: f64,
  pub flat_bolt: f64,
  pub flat_blood: f64,
  pub open_foes: f64,
  pub striking: f64,
  pub kinhunter: f64,
  pub beasthunter: f64,
}

impl From<&Gem> for BbGem {
  fn from(value: &Gem) -> Self {
    BbGem {
      name: value.name.clone(),
      source: value.source.clone(),
      tier: value.tier as u8,
      shape: value.shape.into(),
      arc_scale: value.arc_scale as f32,
      str_scale: value.str_scale as f32,
      dmg_general: value.dmg_general as f32,
      dmg_arcane: value.dmg_arcane as f32,
      dmg_fire: value.dmg_fire as f32,
      dmg_bolt: value.dmg_bolt as f32,
      dmg_phys: value.dmg_phys as f32,
      dmg_blood: value.dmg_blood as f32,
      dmg_blunt: value.dmg_blunt as f32,
      dmg_thrust: value.dmg_thrust as f32,
      flat_phys: value.flat_phys as f32,
      flat_arcane: value.flat_arcane as f32,
      flat_fire: value.flat_fire as f32,
      flat_bolt: value.flat_bolt as f32,
      flat_blood: value.flat_blood as f32,
      open_foes: value.open_foes as f32,
      striking: value.striking as f32,
      kinhunter: value.kinhunter as f32,
      beasthunter: value.beasthunter as f32,
    }
  }
}

/// The four hunter stats that drive weapon scaling.
#[napi(object)]
pub struct Stats {
  pub str: u32,
  pub skl: u32,
  pub blt: u32,
  pub arc: u32,
}

impl From<&Stats> for BbStats {
  fn from(value: &Stats) -> Self {
    BbStats {
      str: value.str as u16,
      skl: value.skl as u16,
      blt: value.blt as u16,
      arc: value.arc as u16,
    }
  }
}

/// The per-element breakdown of a weapon's Attack Rating.
#[napi(object)]
pub struct ArBreakdown {
  pub total: f64,
  pub physical: f64,
  pub blunt: f64,
  pub thrust: f64,
  pub arcane: f64,
  pub fire: f64,
  pub bolt: f64,
  pub blood: f64,
  pub converted_element: ConvertedElement,
}

impl From<BbArBreakdown> for ArBreakdown {
  fn from(value: BbArBreakdown) -> Self {
    ArBreakdown {
      total: value.total as f64,
      physical: value.physical as f64,
      blunt: value.blunt as f64,
      thrust: value.thrust as f64,
      arcane: value.arcane as f64,
      fire: value.fire as f64,
      bolt: value.bolt as f64,
      blood: value.blood as f64,
      converted_element: value.converted_element.into(),
    }
  }
}

/// Computes the Attack Rating for the weapon with `weapon_id`, fitted with up
/// to three `gems` at the given hunter `stats`. Gem slot order does not matter.
#[napi]
pub fn compute_ar(weapon_id: String, gems: Vec<Gem>, stats: Stats) -> Result<ArBreakdown> {
  let weapon = BbWeapon::by_id(&weapon_id).ok_or_else(|| {
    Error::new(Status::InvalidArg, format!("unknown weapon id: {weapon_id}"))
  })?;

  if gems.len() > 3 {
    return Err(Error::new(
      Status::InvalidArg,
      format!("a weapon takes at most 3 gems, got {}", gems.len()),
    ));
  }

  let bb_gems: Vec<BbGem> = gems.iter().map(BbGem::from).collect();
  let mut slots: [Option<&BbGem>; 3] = [None, None, None];
  for (slot, gem) in slots.iter_mut().zip(bb_gems.iter()) {
    *slot = Some(gem);
  }

  let breakdown = bb_compute_ar(weapon, slots, &BbStats::from(&stats));
  Ok(breakdown.into())
}
