# bb-calc

Bloodborne Attack Rating calculator. Given a weapon, up to three gems, and a
character's stats, it computes the total AR and a per-damage-type breakdown.

This is an attempt at recreating the logic from [this Google Sheet](https://docs.google.com/spreadsheets/d/1T9rZQxp2QbBPFawdZqX3WcOW937QZJinpuoO7fKuV7s/edit?gid=957682793#gid=957682793).

## Usage

```rust
use bb_calc::{compute_ar, Weapon, Gem, Stats};

let ar = compute_ar(&weapon, [Some(&gem1), Some(&gem2), None], &stats);
println!("{}", ar.total);
```

`compute_ar` is pure and does no I/O. Missing gem slots (`None`) act as
identity: no scaling, no flat bonus, multiplier of 1.

### Custom gems

`parse_gem_effects` turns a friendly `;`-separated effect spec into a `Gem`
(e.g. `parse_gem_effects("phys 27.2%; +15 phys", None)`). See the module docs
for the full clause grammar.

### Importing a save

`build_inventory_from_save` reads a player's gem collection, stats, and
character name from the bytes of a **decrypted** `userdataNNNN` save:

```rust
let bytes = std::fs::read("userdata0000")?;
let imported = bb_calc::build_inventory_from_save(&bytes, Some("userdata0000"));
for gem in &imported.value.gems {
    println!("{} ({:?}): {:?}", gem.name, gem.shape, gem.effects);
}
```

bb-calc never decrypts saves (it has no keys) — produce the decrypted file
externally (Save Wizard or a community resign tool) and feed it in. Parsing is
pure and bounds-checked; a truncated or garbage file yields an empty result and
warnings rather than panicking.

## Data & attribution

The weapon and gem-effect tables under `data/` are code-generated into the
binary at compile time by `build.rs` — no JSON is read at runtime.

`data/gem-effects.json` (the numeric effect-id → in-game description table) is a
pruned copy of the gem-effect data from the open-source
[Noxde/Bloodborne-save-editor](https://github.com/Noxde/Bloodborne-save-editor)
(GPL-3.0): factual game data, vendored with attribution. bb-calc's own save
parser is an independent reimplementation, not ported from theirs.

## Development

```sh
cargo test
```
