import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `bb-calc-js` ships a native Node addon (for SSR/Node) and a WASM build (for
// the browser) from the same Rust source. Its `browser` field would route the
// client through the package's CommonJS entry, which then `require()`s the
// WASM loader — but that loader uses top-level await, which a CJS require can't
// pull in. So for the client we alias the package straight to its ESM WASM
// browser loader. Run `pnpm --filter bb-calc-js build` (+ the wasm target) to
// produce these artifacts; they are git-ignored build output.
const bbCalcWasmBrowser = fileURLToPath(
  new URL('../../packages/bb-calc-js/bb-calc-js.wasi-browser.js', import.meta.url),
)

// The WASM target uses threads (shared memory), so the page must be
// cross-origin isolated for `SharedArrayBuffer` to be available.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const config = defineConfig({
  // Resolve `bb-calc-js` to its WASM browser binding. This app drives the
  // calculator from the browser (client-side / client-gated rendering), so the
  // WASM build is the one that ships; do not call it during SSR.
  resolve: {
    tsconfigPaths: true,
    alias: {
      'bb-calc-js': bbCalcWasmBrowser,
    },
  },
  // Let the WASM loader + its runtime go through the normal pipeline rather than
  // esbuild's dep prebundle, which doesn't handle the worker/.wasm assets.
  optimizeDeps: {
    exclude: ['bb-calc-js', '@napi-rs/wasm-runtime'],
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
