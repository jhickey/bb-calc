# bb-web

Web frontend for the Bloodborne Attack Rating calculator, built with
[TanStack Start](https://tanstack.com/start) (React + TypeScript + Vite) and
Tailwind CSS. It consumes the `bb-calc-js` library from this monorepo.

> Status: **scaffold only**. The calculator UI has not been built yet.

## Running

From the repo root:

```bash
pnpm install
# Build the calculator library first — the web app imports it (see below).
pnpm --filter bb-calc-js build
pnpm --filter bb-calc-js exec napi build --platform --release --target wasm32-wasip1-threads

pnpm --filter bb-web dev      # http://localhost:3000
pnpm --filter bb-web build    # production build (client + SSR)
pnpm --filter bb-web preview  # serve the production build
```

## Using `bb-calc-js`

`bb-calc-js` is wired in as a workspace dependency and re-exported from
[`src/lib/bb-calc.ts`](./src/lib/bb-calc.ts) — import the calculator API from
there:

```ts
import { getWeapons, computeAr, DamageTarget } from '#/lib/bb-calc';
```

The library ships two builds from one Rust source: a native Node addon and a
WebAssembly build. **This app uses the WASM build in the browser.** A few
integration details, all handled in [`vite.config.ts`](./vite.config.ts):

- **Alias.** `bb-calc-js` is aliased to the package's ESM WASM browser loader
  (`bb-calc-js.wasi-browser.js`). The package's own `browser` field would route
  through a CommonJS entry that `require()`s a top-level-await module, which the
  bundler rejects; the alias sidesteps that.
- **Build prerequisite.** That loader `fetch`es `bb-calc-js.wasm32-wasi.wasm`,
  which is git-ignored build output. Build it with the `napi build` WASM-target
  command shown above before running the app.
- **Cross-origin isolation.** The WASM target uses threads (shared memory), so
  the dev and preview servers send `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` to enable `SharedArrayBuffer`.
  Production hosting must send the same headers.
- **Client-side only.** The WASM binding relies on `fetch`/`Worker`, so call it
  in the browser — from client components or routes rendered with `ssr: false`,
  not during SSR.

## Routing & structure

File-based routing via `@tanstack/react-router`. Routes live in `src/routes`;
`src/routeTree.gen.ts` is generated (`pnpm --filter bb-web generate-routes`) and
should not be edited by hand.
