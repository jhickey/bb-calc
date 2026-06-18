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

## Development

```sh
cargo test
```
