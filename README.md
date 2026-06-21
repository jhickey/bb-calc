# bb-calc

Monorepo for the Bloodborne Attack Rating calculator and its related packages.

## Packages

| Path                                         | Package                | Description                                                                                             |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| [`packages/bb-calc`](packages/bb-calc)       | `bb-calc` (Rust crate) | Core AR calculator: given a weapon, gems, and stats, computes total AR and a per-damage-type breakdown. |
| [`packages/bb-calc-js`](packages/bb-calc-js) | `bb-calc-js` (npm)     | [napi-rs](https://napi.rs) Node native addon exposing the `bb-calc` crate to JavaScript/TypeScript.     |

## Workspace layout

This is a Cargo workspace; all Rust crates share a single `Cargo.lock` and a
`target/` directory at the repo root. `bb-calc-js` depends on the `bb-calc`
crate through a local path dependency, so it always builds against the in-repo
source.

```
.
├── Cargo.toml            # workspace manifest
└── packages/
    ├── bb-calc/          # core Rust crate
    └── bb-calc-js/       # napi-rs Node bindings (pnpm)
```

### Building

```sh
# Build the Rust crate(s)
cargo build

# Build the Node addon
cd packages/bb-calc-js && pnpm install && pnpm build
```
