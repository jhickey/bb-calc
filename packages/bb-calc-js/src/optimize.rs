use crate::{DamageTarget, InventoryGem, Mode, OptimizeResult, Stats};
use bb_calc::{
  optimizer, InventoryGem as BbInventoryGem, OptimizeResult as BbOptimizeResult, Stats as BbStats,
  Weapon as BbWeapon,
};
use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Error, Status, Task};
use napi_derive::napi;

/// The owned inputs for a single {@link optimize} run, computed off the main
/// thread.
///
/// The optimizer parallelizes `Mode::Compare` across weapons with
/// `std::thread`, whose join blocks the calling thread via `Atomics.wait`. That
/// is forbidden on a browser's main thread, so we run the whole computation as
/// an N-API async task: `compute` executes on a libuv/worker thread (where
/// `Atomics.wait` is legal), and JS gets a `Promise` instead of a blocking call.
pub struct OptimizeTask {
  weapon_ids: Vec<String>,
  gems: Vec<InventoryGem>,
  stats: Stats,
  target: DamageTarget,
  mode: Mode,
  excluded_gems: Option<Vec<String>>,
  levels: Option<Vec<u8>>,
}

impl Task for OptimizeTask {
  type Output = Vec<BbOptimizeResult>;
  type JsValue = Vec<OptimizeResult>;

  fn compute(&mut self) -> napi::Result<Self::Output> {
    let levels = self.levels.take().unwrap_or_default();
    let mut weapons: Vec<(&BbWeapon, u8)> = Vec::new();
    for (i, weapon_id) in self.weapon_ids.iter().enumerate() {
      let weapon = BbWeapon::by_id(weapon_id).ok_or_else(|| {
        Error::new(
          Status::InvalidArg,
          format!("unknown weapon id: {weapon_id}"),
        )
      })?;
      // Default to +10 (max) when no level is supplied for this weapon.
      weapons.push((weapon, levels.get(i).copied().unwrap_or(10)));
    }

    let bb_gems = self.gems.iter().map(BbInventoryGem::from).collect();

    Ok(optimizer::optimize(
      weapons,
      bb_gems,
      &BbStats::from(&self.stats),
      self.target.into(),
      self.mode.into(),
      self.excluded_gems.take(),
    ))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    Ok(output.into_iter().map(OptimizeResult::from).collect())
  }
}

/// Finds the socketing of `candidates` that maximizes `target` for the weapon
/// with `weapon_id`, using that weapon variant's own baked-in imprint slots
/// (Normal/Uncanny/Lost are distinct ids). Prefer this over {@link optimizeForSlots}
/// unless the slots come from somewhere other than the chosen weapon.
///
/// Returns a `Promise`: the search runs on a worker thread so it never blocks
/// the caller (required in the browser, where the optimizer's threaded
/// `Mode::Compare` would otherwise call `Atomics.wait` on the main thread).
/// `levels` holds each weapon's upgrade level (+0..=10), aligned to `weapon_ids`;
/// omit it (or individual entries) to score at +10 (max).
#[napi]
pub fn optimize(
  weapon_ids: Vec<String>,
  gems: Vec<InventoryGem>,
  stats: Stats,
  target: DamageTarget,
  mode: Mode,
  excluded_gems: Option<Vec<String>>,
  levels: Option<Vec<u8>>,
) -> AsyncTask<OptimizeTask> {
  AsyncTask::new(OptimizeTask {
    weapon_ids,
    gems,
    stats,
    target,
    mode,
    excluded_gems,
    levels,
  })
}
