import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { Inventory, OptimizeResult, Stats } from 'bb-calc-js';
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
  // The scaling stats fed to the optimizer: seeded from the save, then editable.
  const [editStats, setEditStats] = useState<Stats | null>(null);
  const [weaponIds, setWeaponIds] = useState<Array<string>>([]);
  const [target, setTarget] = useState<DamageTarget>(DamageTarget.Total);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TAB_WEAPONS);
  // Once the user has optimized once, keep the weapons panel live as inputs change.
  const hasOptimized = useRef(false);
  // Gem IDs chosen by the last full optimize run; used to keep the loadout fixed
  // during live AR recomputes so only the numbers update, not the gem selection.
  const selectedGemIdsRef = useRef<Set<string>>(new Set());
  // Controls the Optimize button: disabled after a run, re-enabled on any input change.
  const [optimizeEnabled, setOptimizeEnabled] = useState(true);

  async function runOptimize() {
    if (!inventory || !editStats || weaponIds.length === 0) return;
    try {
      const items = await optimize(weaponIds, inventory.gems, editStats, target, Mode.Compare);
      hasOptimized.current = true;
      const ids = new Set<string>();
      items.forEach((item) => item.slots.forEach((slot) => { if (slot.gem) ids.add(slot.gem.id); }));
      selectedGemIdsRef.current = ids;
      setResults({ target, items });
      setOptimizeEnabled(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // After the first optimize, recompute AR live when stats/weapons/target change.
  // Passes only the previously-selected gems so the loadout stays fixed — the
  // optimizer's search space is 0–3 gems per weapon and completes near-instantly.
  useEffect(() => {
    if (!hasOptimized.current || !inventory || !editStats || weaponIds.length === 0) return;
    const id = setTimeout(async () => {
      const filteredGems = inventory.gems.filter((g) => selectedGemIdsRef.current.has(g.id));
      try {
        const items = await optimize(weaponIds, filteredGems, editStats, target, Mode.Compare);
        setResults((prev) => (prev ? { target, items } : null));
      } catch {
        // Silently ignore live-recompute failures; stale results are better than an error flash.
      }
    }, 200);
    return () => clearTimeout(id);
  }, [inventory, editStats, weaponIds, target]);

  async function handleFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const bufferView = new Uint8Array(arrayBuffer);
    const inv = await parseSave(bufferView);
    hasOptimized.current = false;
    selectedGemIdsRef.current = new Set();
    setInventory(inv);
    setEditStats({ ...inv.stats });
    setResults(null);
    setOptimizeEnabled(true);
  }

  function editStat(key: keyof Stats, value: number) {
    setEditStats((prev) => (prev ? { ...prev, [key]: value } : prev));
    setOptimizeEnabled(true);
  }

  function revertStat(key: keyof Stats) {
    setEditStats((prev) => (prev && inventory ? { ...prev, [key]: inventory.stats[key] } : prev));
    setOptimizeEnabled(true);
  }

  function resetStats() {
    if (inventory) setEditStats({ ...inventory.stats });
    setOptimizeEnabled(true);
  }

  function handleWeaponsChange(ids: Array<string>) {
    setWeaponIds(ids);
    setOptimizeEnabled(true);
  }

  function handleTargetChange(t: DamageTarget) {
    setTarget(t);
    setOptimizeEnabled(true);
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Bloodborne Optimizer</h1>
      {error && <p className="mt-4 text-red-400">Error: {error}</p>}

      <CharacterHeader
        className="mt-6"
        inventory={inventory}
        stats={editStats}
        onEditStat={editStat}
        onRevertStat={revertStat}
        onResetStats={resetStats}
        onFile={handleFile}
      />

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
                <WeaponSelect selected={weaponIds} onChange={handleWeaponsChange} />
                <TargetSelect className="mt-4" value={target} onChange={handleTargetChange} />
                <Button className="mt-4" onClick={runOptimize} disabled={weaponIds.length === 0 || !optimizeEnabled}>
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
