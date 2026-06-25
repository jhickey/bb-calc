#![deny(clippy::all)]

mod inventory;
mod optimize;

use bb_calc::{
  compute_ar as bb_compute_ar, optimizer as bb_optimizer, ArBreakdown as BbArBreakdown,
  Candidate as BbCandidate, ConvertedElement as BbConvertedElement, DamageTarget as BbDamageTarget,
  Gem as BbGem, GemRef as BbGemRef, GemShape as BbGemShape, InventoryGem as BbInventoryGem,
  ItemLocation as BbItemLocation, OptimizeResult as BbOptimizeResult, OwnedWeapon as BbOwnedWeapon,
  SlotChoice as BbSlotChoice, Stats as BbStats, Weapon as BbWeapon, WeaponHand as BbWeaponHand,
  WeaponImprint as BbWeaponImprint, WeaponType as BbWeaponType,
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
  /// In-game numeric id for matching owned weapons from a save; absent for
  /// calc-only variants (tricked forms, rune transforms).
  pub canonical_id: Option<u32>,
  pub name: String,
  pub weapon_type: WeaponType,
  pub phys: u32,
  pub blood: u32,
  pub arcane: u32,
  pub fire: u32,
  pub bolt: u32,
  /// Imprint gem-slot shapes, baked in per weapon variant (Normal/Uncanny/Lost).
  pub gem_slot_1: GemShape,
  pub gem_slot_2: GemShape,
  pub gem_slot_3: GemShape,
}

impl From<&BbWeapon> for Weapon {
  fn from(value: &BbWeapon) -> Self {
    Weapon {
      id: value.id.to_string(),
      canonical_id: value.canonical_id,
      name: value.name.to_string(),
      weapon_type: value.weapon_type.into(),
      phys: value.phys as u32,
      blood: value.blood as u32,
      arcane: value.arcane as u32,
      fire: value.fire as u32,
      bolt: value.bolt as u32,
      gem_slot_1: value.gem_slot_1.into(),
      gem_slot_2: value.gem_slot_2.into(),
      gem_slot_3: value.gem_slot_3.into(),
    }
  }
}

impl From<BbWeapon> for Weapon {
  fn from(value: BbWeapon) -> Self {
    Weapon {
      id: value.id.to_string(),
      canonical_id: value.canonical_id,
      name: value.name.to_string(),
      weapon_type: value.weapon_type.into(),
      phys: value.phys as u32,
      blood: value.blood as u32,
      arcane: value.arcane as u32,
      fire: value.fire as u32,
      bolt: value.bolt as u32,
      gem_slot_1: value.gem_slot_1.into(),
      gem_slot_2: value.gem_slot_2.into(),
      gem_slot_3: value.gem_slot_3.into(),
    }
  }
}

#[napi(object)]
pub struct InventoryGem {
  pub id: String,
  pub name: String,
  pub shape: GemShape,
  pub rating: u8,
  pub effects: Vec<String>,
  /// Whether this gem is currently socketed in a weapon.
  pub in_use: bool,
}

impl From<&InventoryGem> for BbInventoryGem {
  fn from(value: &InventoryGem) -> Self {
    BbInventoryGem {
      id: value.id.to_string(),
      name: value.name.to_string(),
      shape: value.shape.into(),
      rating: value.rating,
      effects: value.effects.clone(),
      in_use: value.in_use,
    }
  }
}

impl From<InventoryGem> for BbInventoryGem {
  fn from(value: InventoryGem) -> Self {
    BbInventoryGem {
      id: value.id.to_string(),
      name: value.name.to_string(),
      shape: value.shape.into(),
      rating: value.rating,
      effects: value.effects.clone(),
      in_use: value.in_use,
    }
  }
}

impl From<BbInventoryGem> for InventoryGem {
  fn from(value: BbInventoryGem) -> Self {
    InventoryGem {
      id: value.id.to_string(),
      name: value.name.to_string(),
      shape: value.shape.into(),
      rating: value.rating,
      effects: value.effects.clone(),
      in_use: value.in_use,
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
  /// Universal wildcard: a Droplet gem fits any slot.
  Droplet,
}

impl From<GemShape> for BbGemShape {
  fn from(value: GemShape) -> Self {
    match value {
      GemShape::Radial => BbGemShape::Radial,
      GemShape::Triangle => BbGemShape::Triangle,
      GemShape::Waning => BbGemShape::Waning,
      GemShape::Circle => BbGemShape::Circle,
      GemShape::Droplet => BbGemShape::Droplet,
    }
  }
}

impl From<BbGemShape> for GemShape {
  fn from(value: BbGemShape) -> Self {
    match value {
      BbGemShape::Radial => GemShape::Radial,
      BbGemShape::Triangle => GemShape::Triangle,
      BbGemShape::Waning => GemShape::Waning,
      BbGemShape::Circle => GemShape::Circle,
      BbGemShape::Droplet => GemShape::Droplet,
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

impl From<ConvertedElement> for BbConvertedElement {
  fn from(value: ConvertedElement) -> Self {
    match value {
      ConvertedElement::Phys => BbConvertedElement::Phys,
      ConvertedElement::Bolt => BbConvertedElement::Bolt,
      ConvertedElement::Fire => BbConvertedElement::Fire,
      ConvertedElement::Arc => BbConvertedElement::Arc,
    }
  }
}

impl From<&ConvertedElement> for BbConvertedElement {
  fn from(value: &ConvertedElement) -> Self {
    match value {
      ConvertedElement::Phys => BbConvertedElement::Phys,
      ConvertedElement::Bolt => BbConvertedElement::Bolt,
      ConvertedElement::Fire => BbConvertedElement::Fire,
      ConvertedElement::Arc => BbConvertedElement::Arc,
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
  pub skl_scale: f64,
  pub blt_scale: f64,
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
      shape: Some(value.shape.into()),
      arc_scale: value.arc_scale as f32,
      str_scale: value.str_scale as f32,
      skl_scale: value.skl_scale as f32,
      blt_scale: value.blt_scale as f32,
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
  pub str: u16,
  pub skl: u16,
  pub blt: u16,
  pub arc: u16,
}

impl From<&Stats> for BbStats {
  fn from(value: &Stats) -> Self {
    BbStats {
      str: value.str,
      skl: value.skl,
      blt: value.blt,
      arc: value.arc,
    }
  }
}

impl From<Stats> for BbStats {
  fn from(value: Stats) -> Self {
    BbStats {
      str: value.str,
      skl: value.skl,
      blt: value.blt,
      arc: value.arc,
    }
  }
}

impl From<BbStats> for Stats {
  fn from(value: BbStats) -> Self {
    Stats {
      str: value.str,
      skl: value.skl,
      blt: value.blt,
      arc: value.arc,
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

impl From<ArBreakdown> for BbArBreakdown {
  fn from(value: ArBreakdown) -> Self {
    BbArBreakdown {
      total: value.total as f32,
      physical: value.physical as f32,
      blunt: value.blunt as f32,
      thrust: value.thrust as f32,
      arcane: value.arcane as f32,
      fire: value.fire as f32,
      bolt: value.bolt as f32,
      blood: value.blood as f32,
      converted_element: value.converted_element.into(),
    }
  }
}

/// Computes the Attack Rating for the weapon with `weapon_id`, fitted with up
/// to three `gems` at the given hunter `stats`. Gem slot order does not matter.
#[napi]
pub fn compute_ar(weapon_id: String, gems: Vec<Gem>, stats: Stats) -> Result<ArBreakdown> {
  let weapon = BbWeapon::by_id(&weapon_id).ok_or_else(|| {
    Error::new(
      Status::InvalidArg,
      format!("unknown weapon id: {weapon_id}"),
    )
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

/// Which figure {@link optimizeForSlots} maximizes. `Total` is the full Attack
/// Rating; the rest target a single damage line (mirrors `bb_calc::DamageTarget`).
#[derive(Clone, Copy)]
#[napi(string_enum)]
pub enum DamageTarget {
  Total,
  Phys,
  Blunt,
  Thrust,
  Arcane,
  Fire,
  Bolt,
  Blood,
}

impl From<DamageTarget> for BbDamageTarget {
  fn from(value: DamageTarget) -> Self {
    match value {
      DamageTarget::Total => BbDamageTarget::Total,
      DamageTarget::Phys => BbDamageTarget::Phys,
      DamageTarget::Blunt => BbDamageTarget::Blunt,
      DamageTarget::Thrust => BbDamageTarget::Thrust,
      DamageTarget::Arcane => BbDamageTarget::Arcane,
      DamageTarget::Fire => BbDamageTarget::Fire,
      DamageTarget::Bolt => BbDamageTarget::Bolt,
      DamageTarget::Blood => BbDamageTarget::Blood,
    }
  }
}

/// A minimal identity for reporting which owned gem the optimizer chose.
#[napi(object)]
pub struct GemRef {
  pub id: String,
  pub name: String,
  pub effects: Vec<String>,
}

impl From<GemRef> for BbGemRef {
  fn from(value: GemRef) -> Self {
    BbGemRef {
      id: value.id,
      name: value.name,
      effects: value.effects,
    }
  }
}

impl From<&GemRef> for BbGemRef {
  fn from(value: &GemRef) -> Self {
    BbGemRef {
      id: value.id.clone(),
      name: value.name.clone(),
      effects: value.effects.clone(),
    }
  }
}

impl From<BbGemRef> for GemRef {
  fn from(value: BbGemRef) -> Self {
    GemRef {
      id: value.id,
      name: value.name,
      effects: value.effects,
    }
  }
}

/// A gem the player owns, ready to feed the optimizer. `shape` is the
/// inventory-sourced shape (authoritative for slotting) and is kept separate
/// from the gem's calc fields, which never include shape.
#[napi(object)]
pub struct Candidate {
  pub gem: Gem,
  pub shape: GemShape,
  pub gem_ref: GemRef,
}

impl From<&Candidate> for BbCandidate {
  fn from(value: &Candidate) -> Self {
    BbCandidate {
      gem: BbGem::from(&value.gem),
      shape: value.shape.into(),
      gem_ref: BbGemRef::from(&value.gem_ref),
    }
  }
}

/// One imprint slot in the result: its shape and the owned gem placed in it
/// (`gem` is absent when the optimizer left the slot empty).
#[napi(object)]
pub struct SlotChoice {
  pub slot: u32,
  pub slot_shape: GemShape,
  pub gem: Option<GemRef>,
}

impl From<BbSlotChoice> for SlotChoice {
  fn from(value: BbSlotChoice) -> Self {
    SlotChoice {
      slot: value.slot as u32,
      slot_shape: value.slot_shape.into(),
      gem: value.gem.map(GemRef::from),
    }
  }
}

impl From<SlotChoice> for BbSlotChoice {
  fn from(value: SlotChoice) -> Self {
    BbSlotChoice {
      slot: value.slot as usize,
      slot_shape: value.slot_shape.into(),
      gem: value.gem.map(BbGemRef::from),
    }
  }
}

/// The winning socketing found by {@link optimizeForSlots}.
#[napi(object)]
pub struct OptimizeResult {
  /// The value of the optimized metric (see {@link DamageTarget}).
  pub score: f64,
  /// The full Attack Rating of the winning socketing, regardless of target.
  pub total: f64,
  pub breakdown: ArBreakdown,
  pub slots: Vec<SlotChoice>,
  pub weapon_id: String,
}

impl From<BbOptimizeResult> for OptimizeResult {
  fn from(value: BbOptimizeResult) -> Self {
    OptimizeResult {
      score: value.score as f64,
      total: value.total as f64,
      breakdown: value.breakdown.into(),
      slots: value.slots.into_iter().map(SlotChoice::from).collect(),
      weapon_id: value.weapon_id,
    }
  }
}

impl From<OptimizeResult> for BbOptimizeResult {
  fn from(value: OptimizeResult) -> Self {
    BbOptimizeResult {
      score: value.score as f32,
      total: value.total as f32,
      breakdown: value.breakdown.into(),
      slots: value.slots.into_iter().map(BbSlotChoice::from).collect(),
      weapon_id: value.weapon_id,
    }
  }
}

/// A hunter's character data: name plus every scalar field read from the save.
#[napi(object)]
pub struct Character {
  pub name: String,
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

impl From<bb_calc::Character> for Character {
  fn from(value: bb_calc::Character) -> Self {
    Character {
      name: value.name,
      level: value.level,
      vitality: value.vitality,
      endurance: value.endurance,
      strength: value.strength,
      skill: value.skill,
      bloodtinge: value.bloodtinge,
      arcane: value.arcane,
      health: value.health,
      stamina: value.stamina,
      insight: value.insight,
      blood_echoes: value.blood_echoes,
      new_game: value.new_game,
      playtime_ms: value.playtime_ms,
    }
  }
}

impl From<Character> for bb_calc::Character {
  fn from(value: Character) -> Self {
    bb_calc::Character {
      name: value.name,
      level: value.level,
      vitality: value.vitality,
      endurance: value.endurance,
      strength: value.strength,
      skill: value.skill,
      bloodtinge: value.bloodtinge,
      arcane: value.arcane,
      health: value.health,
      stamina: value.stamina,
      insight: value.insight,
      blood_echoes: value.blood_echoes,
      new_game: value.new_game,
      playtime_ms: value.playtime_ms,
    }
  }
}

/// Which hand a weapon is wielded in (mirrors `bb_calc::WeaponHand`).
#[napi(string_enum)]
pub enum WeaponHand {
  Right,
  Left,
}

impl From<BbWeaponHand> for WeaponHand {
  fn from(value: BbWeaponHand) -> Self {
    match value {
      BbWeaponHand::Right => WeaponHand::Right,
      BbWeaponHand::Left => WeaponHand::Left,
    }
  }
}

impl From<WeaponHand> for BbWeaponHand {
  fn from(value: WeaponHand) -> Self {
    match value {
      WeaponHand::Right => BbWeaponHand::Right,
      WeaponHand::Left => BbWeaponHand::Left,
    }
  }
}

/// A weapon's imprint (mirrors `bb_calc::WeaponImprint`).
#[napi(string_enum)]
pub enum WeaponImprint {
  Normal,
  Uncanny,
  Lost,
}

impl From<BbWeaponImprint> for WeaponImprint {
  fn from(value: BbWeaponImprint) -> Self {
    match value {
      BbWeaponImprint::Normal => WeaponImprint::Normal,
      BbWeaponImprint::Uncanny => WeaponImprint::Uncanny,
      BbWeaponImprint::Lost => WeaponImprint::Lost,
    }
  }
}

impl From<WeaponImprint> for BbWeaponImprint {
  fn from(value: WeaponImprint) -> Self {
    match value {
      WeaponImprint::Normal => BbWeaponImprint::Normal,
      WeaponImprint::Uncanny => BbWeaponImprint::Uncanny,
      WeaponImprint::Lost => BbWeaponImprint::Lost,
    }
  }
}

/// Where an owned item lives (mirrors `bb_calc::ItemLocation`).
#[napi(string_enum)]
pub enum ItemLocation {
  Inventory,
  Storage,
}

impl From<BbItemLocation> for ItemLocation {
  fn from(value: BbItemLocation) -> Self {
    match value {
      BbItemLocation::Inventory => ItemLocation::Inventory,
      BbItemLocation::Storage => ItemLocation::Storage,
    }
  }
}

impl From<ItemLocation> for BbItemLocation {
  fn from(value: ItemLocation) -> Self {
    match value {
      ItemLocation::Inventory => BbItemLocation::Inventory,
      ItemLocation::Storage => BbItemLocation::Storage,
    }
  }
}

/// A weapon the player owns, decoded from a save.
#[napi(object)]
pub struct OwnedWeapon {
  /// In-game id with the upgrade level stripped (base + imprint).
  pub canonical_id: u32,
  pub name: String,
  pub hand: WeaponHand,
  pub imprint: WeaponImprint,
  pub level: u8,
  pub location: ItemLocation,
  /// The AR-table slug when this is a right-hand weapon we can optimize.
  pub weapon_id: Option<String>,
  /// Instance ids (hex) of gems socketed in this weapon, in slot order.
  pub gem_ids: Vec<String>,
}

impl From<BbOwnedWeapon> for OwnedWeapon {
  fn from(value: BbOwnedWeapon) -> Self {
    OwnedWeapon {
      canonical_id: value.canonical_id,
      name: value.name,
      hand: value.hand.into(),
      imprint: value.imprint.into(),
      level: value.level,
      location: value.location.into(),
      weapon_id: value.weapon_id,
      gem_ids: value.gem_ids,
    }
  }
}

impl From<OwnedWeapon> for BbOwnedWeapon {
  fn from(value: OwnedWeapon) -> Self {
    BbOwnedWeapon {
      canonical_id: value.canonical_id,
      name: value.name,
      hand: value.hand.into(),
      imprint: value.imprint.into(),
      level: value.level,
      location: value.location.into(),
      weapon_id: value.weapon_id,
      gem_ids: value.gem_ids,
    }
  }
}

#[napi(object)]
pub struct Inventory {
  pub character: Character,
  pub stats: Stats,
  pub gems: Vec<InventoryGem>,
  pub weapons: Vec<OwnedWeapon>,
}

impl From<Inventory> for bb_calc::Inventory {
  fn from(value: Inventory) -> Self {
    bb_calc::Inventory {
      character: value.character.into(),
      stats: value.stats.into(),
      gems: value.gems.into_iter().map(BbInventoryGem::from).collect(),
      weapons: value.weapons.into_iter().map(BbOwnedWeapon::from).collect(),
    }
  }
}

impl From<bb_calc::Inventory> for Inventory {
  fn from(value: bb_calc::Inventory) -> Self {
    Inventory {
      character: value.character.into(),
      stats: value.stats.into(),
      gems: value.gems.into_iter().map(InventoryGem::from).collect(),
      weapons: value.weapons.into_iter().map(OwnedWeapon::from).collect(),
    }
  }
}

#[derive(Clone, Copy)]
#[napi(string_enum)]
pub enum Mode {
  Compare,
  Plan,
}

impl From<Mode> for bb_optimizer::Mode {
  fn from(value: Mode) -> Self {
    match value {
      Mode::Compare => bb_optimizer::Mode::Compare,
      Mode::Plan => bb_optimizer::Mode::Plan,
    }
  }
}
