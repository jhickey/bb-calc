import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { DamageTarget, Inventory, Mode, optimize, parseSave } from 'bb-calc-js';

import type { OptimizeResult } from '#/lib/bb-calc';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  const [results, setResults] = useState<Array<OptimizeResult> | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClickOptimize() {
    try {
      const res = await optimize(
        ['beasthunter_saif', 'church_pick'],
        inventory?.gems || [],
        { arc: 10, str: 10, skl: 10, blt: 10 },
        DamageTarget.Total,
        Mode.Compare,
      );
      setResults(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleFile(event: InputEvent<HTMLInputElement>) {
    const file = event.target.files[0];
    if (!file) return;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const bufferView = new Uint8Array(arrayBuffer);
    const inventory = (await parseSave(bufferView)) as Inventory;
    setInventory(inventory);
  }

  // // Load the calculator lazily inside the effect: its browser-only WASM loader
  // // (fetch + Worker + SharedArrayBuffer) must never run during SSR. `optimize`
  // // returns a Promise — the search runs on a worker thread, off the main thread.
  // useEffect(() => {
  //   let cancelled = false;
  //   import('#/lib/bb-calc')
  //     .then(({ optimize, parseSave, DamageTarget, Mode }) =>
  //       optimize(
  //         ['beasthunter_saif', 'church_pick'],
  //         [],
  //         { arc: 10, str: 10, skl: 10, blt: 10 },
  //         DamageTarget.Total,
  //         Mode.Compare,
  //       ),
  //     )
  //     .then((res) => {
  //       if (!cancelled) setResults(res);
  //     })
  //     .catch((e) => {
  //       if (!cancelled) setError(e instanceof Error ? e.message : String(e));
  //     });
  //   return () => {
  //     cancelled = true;
  //   };
  // }, []);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Bloodborne Optimizer</h1>
      {error && <p className="mt-4 text-red-600">Error: {error}</p>}
      <input type="file" className="mt-4" onInput={handleFile} />
      <button
        className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        onClick={handleClickOptimize}
        disabled={!inventory}
      >
        Optimize
      </button>
      {results && <pre className="mt-4 text-sm">{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
