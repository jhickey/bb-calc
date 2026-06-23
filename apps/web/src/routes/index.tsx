import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import type { OptimizeResult } from '#/lib/bb-calc'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [results, setResults] = useState<Array<OptimizeResult> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load the calculator lazily inside the effect: its browser-only WASM loader
  // (fetch + Worker + SharedArrayBuffer) must never run during SSR. `optimize`
  // returns a Promise — the search runs on a worker thread, off the main thread.
  useEffect(() => {
    let cancelled = false
    import('#/lib/bb-calc')
      .then(({ optimize, DamageTarget, Mode }) =>
        optimize(
          ['beasthunter_saif', 'church_pick'],
          [],
          { arc: 10, str: 10, skl: 10, blt: 10 },
          DamageTarget.Total,
          Mode.Compare,
        ),
      )
      .then((res) => {
        if (!cancelled) setResults(res)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      {error && <p className="mt-4 text-red-600">Error: {error}</p>}
      <pre className="mt-4 text-sm">{results ? JSON.stringify(results, null, 2) : 'Optimizing…'}</pre>
    </div>
  )
}
