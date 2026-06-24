import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { Inventory, OptimizeResult } from '#/lib/bb-calc';
import { DamageTarget, Mode, optimize, parseSave } from '#/lib/bb-calc';

import { Button } from '#/components/Button';
import { SaveUpload } from '#/components/SaveUpload';

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

  async function handleFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const bufferView = new Uint8Array(arrayBuffer);
    const inventory = await parseSave(bufferView);
    setInventory(inventory);
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Bloodborne Optimizer</h1>
      {error && <p className="mt-4 text-red-400">Error: {error}</p>}
      <SaveUpload className="mt-4" onFile={handleFile} />
      <Button className="mt-4" onClick={handleClickOptimize} disabled={!inventory}>
        Optimize
      </Button>
      {results && (
        <pre className="mt-4 overflow-x-auto rounded-md border border-black-wool bg-black-wool/40 p-4 text-sm text-pale-mocha">
          {JSON.stringify(results, null, 2)}
        </pre>
      )}
    </div>
  );
}
