use crate::Inventory;
use bb_calc::inventory;
use napi::bindgen_prelude::{AsyncTask, Uint8Array};
use napi::{Env, Task};
use napi_derive::napi;

pub struct InventoryTask {
  pub save_file: Uint8Array,
}

impl Task for InventoryTask {
  type Output = bb_calc::Inventory;
  type JsValue = Inventory;

  fn compute(&mut self) -> napi::Result<Self::Output> {
    let inventory_with_warnings = inventory::build_inventory_from_save(&self.save_file);
    Ok(inventory_with_warnings.value)
  }
  fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    Ok(output.into())
  }
}

#[napi]
pub fn parse_save(save_file: Uint8Array) -> AsyncTask<InventoryTask> {
  AsyncTask::new(InventoryTask { save_file })
}
