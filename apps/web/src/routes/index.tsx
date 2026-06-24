import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import type { Inventory, OptimizeResult } from 'bb-calc-js';
import { DamageTarget, Mode, optimize, parseSave } from 'bb-calc-js';

import { Button } from '#/components/Button';
import { CharacterHeader } from '#/components/CharacterHeader';
import { GemsPanel } from '#/components/GemsPanel';
import { OptimizeResults } from '#/components/OptimizeResults';
import { Tabs } from '#/components/Tabs';
import { TargetSelect } from '#/components/TargetSelect';
import { WeaponSelect } from '#/components/WeaponSelect';

export const Route = createFileRoute('/')({ component: Home });

const TAB_WEAPONS = 'weapons';
const TAB_GEMS = 'gems';

function Home() {
  const [results, setResults] = useState<{
    target: DamageTarget;
    items: Array<OptimizeResult>;
  } | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [weaponIds, setWeaponIds] = useState<Array<string>>([]);
  const [target, setTarget] = useState<DamageTarget>(DamageTarget.Total);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TAB_WEAPONS);

  async function handleClickOptimize() {
    if (!inventory) return;
    try {
      const items = await optimize(weaponIds, inventory.gems, inventory.stats, target, Mode.Compare);
      setResults({ target, items });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const bufferView = new Uint8Array(arrayBuffer);
    setInventory(await parseSave(bufferView));
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Bloodborne Optimizer</h1>
      {error && <p className="mt-4 text-red-400">Error: {error}</p>}

      <CharacterHeader className="mt-6" inventory={inventory} onFile={handleFile} />

      {inventory && (
        <div className="mt-8">
          <Tabs
            tabs={[
              { id: TAB_WEAPONS, label: 'Weapons' },
              { id: TAB_GEMS, label: `Gems (${inventory.gems.length})` },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === TAB_WEAPONS && (
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <WeaponSelect selected={weaponIds} onChange={setWeaponIds} />
                <TargetSelect className="mt-4" value={target} onChange={setTarget} />
                <Button className="mt-4" onClick={handleClickOptimize} disabled={weaponIds.length === 0}>
                  Optimize
                </Button>
              </div>
              {/* lg:pt-6 offsets the results to start level with the weapon
                  list box, which sits below the selector's "Weapons (n)" label. */}
              <div className="lg:col-span-2 lg:pt-6">
                {results ? (
                  <OptimizeResults results={results.items} target={results.target} />
                ) : (
                  <p className="text-au-chico">Select weapons and a target, then optimize.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === TAB_GEMS && <GemsPanel className="mt-6" gems={inventory.gems} />}
        </div>
      )}
    </div>
  );
}
