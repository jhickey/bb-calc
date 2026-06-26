import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Inventory, OptimizeResult, Stats } from 'bb-calc-js';
import { DamageTarget, Mode, gemFromInventory, optimize, parseSave } from 'bb-calc-js';

import { Button } from '#/components/Button';
import { CharacterHeader } from '#/components/CharacterHeader';
import { GemsPanel } from '#/components/GemsPanel';
import { Tabs } from '#/components/Tabs';
import { TargetSelect } from '#/components/TargetSelect';
import { WeaponCard } from '#/components/WeaponCard';
import { WeaponSelect } from '#/components/WeaponSelect';
import type { Socket } from '#/lib/gems';

export const Route = createFileRoute('/')({ component: Home });

const TAB_WEAPONS = 'weapons';
const TAB_GEMS = 'gems';

const EMPTY_SLOTS: Array<Socket | null> = [null, null, null];

function Home() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  // The scaling stats fed to the calc: seeded from the save, then editable.
  const [editStats, setEditStats] = useState<Stats | null>(null);
  const [weaponIds, setWeaponIds] = useState<Array<string>>([]);
  // Per-weapon gem socketing (3 slots each); the source of truth for each card.
  const [slotsByWeapon, setSlotsByWeapon] = useState<Record<string, Array<Socket | null>>>({});
  // Custom gems created this session — ephemeral, reusable across slots.
  const [customGems, setCustomGems] = useState<Array<Socket>>([]);
  const [target, setTarget] = useState<DamageTarget>(DamageTarget.Total);
  // 'compare' = every weapon may use any gem; 'loadout' = gems are a shared pool
  // consumed down the weapon list (Mode.Plan).
  const [mode, setMode] = useState<'compare' | 'loadout'>('compare');
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

  function setSlot(weaponId: string, slotIndex: number, socket: Socket | null) {
    setSlotsByWeapon((prev) => {
      const slots = (prev[weaponId] ?? EMPTY_SLOTS).slice();
      slots[slotIndex] = socket;
      return { ...prev, [weaponId]: slots };
    });
  }

  function removeWeapon(weaponId: string) {
    setWeaponIds((prev) => prev.filter((id) => id !== weaponId));
  }

  // Build a weapon's three slots from an optimizer result, resolving each chosen
  // gem to a calc Gem (and keeping its instance id for Loadout availability).
  function slotsFromResult(result: OptimizeResult): Array<Socket | null> {
    const slots: Array<Socket | null> = [null, null, null];
    for (const slot of result.slots) {
      const ref = slot.gem;
      if (!ref) continue;
      const owned = inventory?.gems.find((gem) => gem.id === ref.id);
      if (owned) slots[slot.slot] = { gem: gemFromInventory(owned), effects: owned.effects, gemId: owned.id };
    }
    return slots;
  }

  // Gem instance ids socketed in weapons other than `weaponId`.
  function gemsUsedByOtherWeapons(weaponId: string): Array<string> {
    return Object.entries(slotsByWeapon)
      .filter(([id]) => id !== weaponId)
      .flatMap(([, slots]) => slots)
      .map((socket) => socket?.gemId)
      .filter((id): id is string => id != null);
  }

  // Optimize one weapon. In Loadout, gems already used by other weapons are off
  // the table.
  async function autoOptimize(weaponId: string) {
    if (!inventory || !editStats) return;
    try {
      // Mode.Plan honors `excluded` (Compare ignores it); for a single weapon it
      // optimizes against the full pool minus the gems used by other weapons.
      const excluded = mode === 'loadout' ? gemsUsedByOtherWeapons(weaponId) : undefined;
      const optMode = mode === 'loadout' ? Mode.Plan : Mode.Compare;
      const [result] = await optimize([weaponId], inventory.gems, editStats, target, optMode, excluded);
      if (result) setSlotsByWeapon((prev) => ({ ...prev, [weaponId]: slotsFromResult(result) }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Optimize every selected weapon. Loadout (Mode.Plan) walks them in list order,
  // removing each weapon's chosen gems from the pool for the weapons after it;
  // Compare gives every weapon the full pool.
  async function optimizeAll() {
    if (!inventory || !editStats || weaponIds.length === 0) return;
    try {
      const results = await optimize(
        weaponIds,
        inventory.gems,
        editStats,
        target,
        mode === 'loadout' ? Mode.Plan : Mode.Compare,
      );
      const next: Record<string, Array<Socket | null>> = {};
      for (const result of results) next[result.weaponId] = slotsFromResult(result);
      setSlotsByWeapon((prev) => ({ ...prev, ...next }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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

      {inventory && editStats && (
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
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

                <div className="mt-4">
                  <span className="text-xs uppercase tracking-wide text-au-chico">Mode</span>
                  <div className="mt-1 flex gap-1 rounded-md border border-black-wool p-1">
                    {(['compare', 'loadout'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={mode === value}
                        onClick={() => setMode(value)}
                        className={`relative flex-1 cursor-pointer rounded px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                          mode === value ? 'text-pale-mocha' : 'text-au-chico hover:text-pale-mocha'
                        }`}
                      >
                        {mode === value && (
                          <motion.span
                            layoutId="mode-pill"
                            className="absolute inset-0 rounded bg-tamarillo"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                        <span className="relative z-10">{value}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-au-chico">
                    {mode === 'compare'
                      ? 'Every weapon can use any gem.'
                      : 'Shared gems — a gem used by one weapon is unavailable to the weapons below it.'}
                  </p>
                </div>

                <Button className="mt-4" onClick={optimizeAll} disabled={weaponIds.length === 0}>
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
                    <AnimatePresence mode="popLayout">
                      {weaponIds.map((weaponId) => (
                        <WeaponCard
                          key={weaponId}
                          weaponId={weaponId}
                          slots={slotsByWeapon[weaponId] ?? EMPTY_SLOTS}
                          stats={editStats}
                          inventoryGems={inventory.gems}
                          customGems={customGems}
                          unavailableGemIds={mode === 'loadout' ? new Set(gemsUsedByOtherWeapons(weaponId)) : undefined}
                          onSlotChange={(slotIndex, socket) => setSlot(weaponId, slotIndex, socket)}
                          onCreateCustom={(socket) => setCustomGems((prev) => [...prev, socket])}
                          onOptimize={() => autoOptimize(weaponId)}
                          onRemove={() => removeWeapon(weaponId)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === TAB_GEMS && <GemsPanel className="mt-6" gems={inventory.gems} />}
        </motion.div>
      )}
    </div>
  );
}
