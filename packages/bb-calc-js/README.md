# `@napi-rs/package-template`

![https://github.com/napi-rs/package-template/actions](https://github.com/napi-rs/package-template/workflows/CI/badge.svg)

> Template project for writing node packages with napi-rs.

# Usage

1. Click **Use this template**.
2. **Clone** your project.
3. Run `pnpm install` to install dependencies.
4. Run `pnpm napi rename -n [@your-scope/package-name] -b [binary-name]` command under the project folder to rename your package.

## Install this test package

```bash
pnpm add @napi-rs/package-template
```

## Ability

### Build

After `pnpm build/npm run build` command, you can see `package-template.[darwin|win32|linux].node` file in project root. This is the native addon built from [lib.rs](./src/lib.rs).

### WebAssembly (browser + Node)

In addition to the native `.node` addons, this package builds a
`wasm32-wasip1-threads` target so the exact same API runs in the browser and in
Node without a native binary.

- **Node**: `import`/`require` works as usual. If no prebuilt native addon
  matches the platform, the loader automatically falls back to the WASM binding
  (the `bb-calc-js-wasm32-wasi` optional dependency). Set
  `NAPI_RS_FORCE_WASI=true` to force the WASM path even when a native addon is
  available.
- **Browser / bundlers** (Vite, webpack, Rollup, esbuild, …): the package's
  `browser` field redirects the native loader to the WASM binding, which
  `fetch`es and instantiates the `.wasm` via
  [`@napi-rs/wasm-runtime`](https://www.npmjs.com/package/@napi-rs/wasm-runtime).
  Because the target uses WASM threads (shared memory), the page must be
  [cross-origin isolated](https://web.dev/articles/coop-coep) — serve it with
  `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` so `SharedArrayBuffer` is
  available.

```ts
// Identical usage in both environments:
import { getWeapons, computeAr } from 'bb-calc-js';

const ar = computeAr('amygdalan_arm', [], { str: 50, skl: 50, blt: 25, arc: 25 });
console.log(ar.total);
```

To build the WASM artifact locally:

```bash
rustup target add wasm32-wasip1-threads
pnpm napi build --platform --release --target wasm32-wasip1-threads
```

### Test

With [ava](https://github.com/avajs/ava), run `pnpm test/npm run test` to testing native addon. You can also switch to another testing framework if you want.

To run the suite against the WASM binding instead of the native addon, force the
WASI path: `NAPI_RS_FORCE_WASI=true pnpm test`.

### CI

With GitHub Actions, each commit and pull request will be built and tested automatically in [`node@20`, `@node22`] x [`macOS`, `Linux`, `Windows`] matrix. You will never be afraid of the native addon broken in these platforms.

### Release

Release native package is very difficult in old days. Native packages may ask developers who use it to install `build toolchain` like `gcc/llvm`, `node-gyp` or something more.

With `GitHub actions`, we can easily prebuild a `binary` for major platforms. And with `N-API`, we should never be afraid of **ABI Compatible**.

The other problem is how to deliver prebuild `binary` to users. Downloading it in `postinstall` script is a common way that most packages do it right now. The problem with this solution is it introduced many other packages to download binary that has not been used by `runtime codes`. The other problem is some users may not easily download the binary from `GitHub/CDN` if they are behind a private network (But in most cases, they have a private NPM mirror).

In this package, we choose a better way to solve this problem. We release different `npm packages` for different platforms. And add it to `optionalDependencies` before releasing the `Major` package to npm.

`NPM` will choose which native package should download from `registry` automatically. You can see [npm](./npm) dir for details. And you can also run `pnpm add @napi-rs/package-template` to see how it works.

## Develop requirements

- Install the latest `Rust`
- Install `Node.js@10+` which fully supported `Node-API`
- Install `pnpm` (the repo pins a version via the `packageManager` field; `corepack enable` will provision it)

## Test in local

- pnpm install
- pnpm build
- pnpm test

And you will see:

```bash
$ ava --verbose

  ✔ sync function from native code
  ✔ sleep function from native code (201ms)
  ─

  2 tests passed
✨  Done in 1.12s.
```

## Release package

Ensure you have set your **NPM_TOKEN** in the `GitHub` project setting.

In `Settings -> Secrets`, add **NPM_TOKEN** into it.

When you want to release the package:

```bash
npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--preid=<prerelease-id>] | from-git]

git push
```

GitHub actions will do the rest job for you.

> WARN: Don't run `npm publish` manually.
