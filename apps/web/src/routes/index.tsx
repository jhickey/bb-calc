import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import type { Gem, Inventory, Stats } from 'bb-calc-js';
import { DamageTarget, Mode, gemFromInventory, optimize, parseSave } from 'bb-calc-js';

import { Button } from '#/components/Button';
import { CharacterHeader } from '#/components/CharacterHeader';
import { GemsPanel } from '#/components/GemsPanel';
import { Tabs } from '#/components/Tabs';
import { TargetSelect } from '#/components/TargetSelect';
import { WeaponCard } from '#/components/WeaponCard';
import { WeaponSelect } from '#/components/WeaponSelect';

export const Route = createFileRoute('/')({ component: Home });

const TAB_WEAPONS = 'weapons';
const TAB_GEMS = 'gems';

const EMPTY_SLOTS: Array<Gem | null> = [null, null, null];

function Home() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  // The scaling stats fed to the calc: seeded from the save, then editable.
  const [editStats, setEditStats] = useState<Stats | null>(null);
  const [weaponIds, setWeaponIds] = useState<Array<string>>([]);
  // Per-weapon gem socketing (3 slots each); the source of truth for each card.
  const [slotsByWeapon, setSlotsByWeapon] = useState<Record<string, Array<Gem | null>>>({});
  // Custom gems created this session — ephemeral, reusable across slots.
  const [customGems, setCustomGems] = useState<Array<Gem>>([]);
  const [target, setTarget] = useState<DamageTarget>(DamageTarget.Total);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TAB_WEAPONS);

  async function handleFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const inv = await parseSave(new Uint8Array(arrayBuffer));
    setInventory(inv);
    setEditStats({ ...inv.stats });
    setSlotsByWeapon({});
    setCustomGems([]);
  }

  function editStat(key: keyof Stats, value: number) {
    setEditStats((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  function revertStat(key: keyof Stats) {
    setEditStats((prev) => (prev && inventory ? { ...prev, [key]: inventory.stats[key] } : prev));
  }
  function resetStats() {
    if (inventory) setEditStats({ ...inventory.stats });
  }

  function setSlot(weaponId: string, slotIndex: number, gem: Gem | null) {
    setSlotsByWeapon((prev) => {
      const slots = (prev[weaponId] ?? EMPTY_SLOTS).slice();
      slots[slotIndex] = gem;
      return { ...prev, [weaponId]: slots };
    });
  }

  function removeWeapon(weaponId: string) {
    setWeaponIds((prev) => prev.filter((id) => id !== weaponId));
  }

  // Auto-fill a weapon's slots with the optimizer's best gems for the current
  // target, resolving each chosen gem to a calc Gem the card can recompute with.
  const autoOptimize = useCallback(
    async (weaponId: string) => {
      if (!inventory || !editStats) return;
      try {
        const [result] = await optimize([weaponId], inventory.gems, editStats, target, Mode.Compare);
        if (!result) return;
        const slots: Array<Gem | null> = [null, null, null];
        for (const slot of result.slots) {
          if (slot.gem) {
            const owned = inventory.gems.find((gem) => gem.id === slot.gem?.id);
            if (owned) slots[slot.slot] = gemFromInventory(owned);
          }
        }
        setSlotsByWeapon((prev) => ({ ...prev, [weaponId]: slots }));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [inventory, editStats, target],
  );

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

      {inventory && editStats && (
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
                <Button
                  className="mt-4"
                  onClick={() => weaponIds.forEach((id) => autoOptimize(id))}
                  disabled={weaponIds.length === 0}
                >
                  Auto-optimize all
                </Button>
              </div>

              <div className="lg:col-span-2 lg:pt-6">
                {weaponIds.length === 0 ? (
                  <p className="text-au-chico">
                    Select weapons to build. Click a gem slot to socket a gem, or auto-optimize.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {weaponIds.map((weaponId) => (
                      <WeaponCard
                        key={weaponId}
                        weaponId={weaponId}
                        slots={slotsByWeapon[weaponId] ?? EMPTY_SLOTS}
                        stats={editStats}
                        inventoryGems={inventory.gems}
                        customGems={customGems}
                        onSlotChange={(slotIndex, gem) => setSlot(weaponId, slotIndex, gem)}
                        onCreateCustom={(gem) => setCustomGems((prev) => [...prev, gem])}
                        onOptimize={() => autoOptimize(weaponId)}
                        onRemove={() => removeWeapon(weaponId)}
                      />
                    ))}
                  </ul>
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
