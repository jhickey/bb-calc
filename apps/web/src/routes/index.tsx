import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { Inventory, OptimizeResult } from '#/lib/bb-calc';
import { DamageTarget, Mode, optimize, parseSave } from '#/lib/bb-calc';

import { Button } from '#/components/Button';
import { InventoryView } from '#/components/InventoryView';
import { OptimizeResults } from '#/components/OptimizeResults';
import { SaveUpload } from '#/components/SaveUpload';
import { TargetSelect } from '#/components/TargetSelect';
import { WeaponSelect } from '#/components/WeaponSelect';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  const [results, setResults] = useState<Array<OptimizeResult> | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [weaponIds, setWeaponIds] = useState<Array<string>>([]);
  const [target, setTarget] = useState<DamageTarget>(DamageTarget.Total);
  const [error, setError] = useState<string | null>(null);

  async function handleClickOptimize() {
    if (!inventory) return;
    try {
      const res = await optimize(weaponIds, inventory.gems, inventory.stats, target, Mode.Compare);
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
      {inventory && (
        <section className="mt-6">
          <WeaponSelect selected={weaponIds} onChange={setWeaponIds} />
          <TargetSelect className="mt-4" value={target} onChange={setTarget} />
          <Button className="mt-4" onClick={handleClickOptimize} disabled={weaponIds.length === 0}>
            Optimize
          </Button>
        </section>
      )}
      {results && <OptimizeResults className="mt-6" results={results} />}
      {inventory && <InventoryView className="mt-6" inventory={inventory} />}
    </div>
  );
}
