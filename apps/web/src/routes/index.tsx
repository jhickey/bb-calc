import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Inventory, OptimizeResult, Stats } from 'bb-calc-js';
import { DamageTarget, Mode, gemFromInventory, optimize, parseSave } from 'bb-calc-js';

import { AuthControl } from '#/components/AuthControl';
import { Button } from '#/components/Button';
import { CharacterHeader } from '#/components/CharacterHeader';
import { GemsPanel } from '#/components/GemsPanel';
import { SavesPanel } from '#/components/SavesPanel';
import { Tabs } from '#/components/Tabs';
import { TargetSelect } from '#/components/TargetSelect';
import { WeaponCard } from '#/components/WeaponCard';
import { WeaponSelect } from '#/components/WeaponSelect';
import { useAuth } from '#/lib/auth';
import type { Socket } from '#/lib/gems';
import { isDrawbackEffect } from '#/lib/gems';
import { loadLocalBuild, saveLocalBuild } from '#/lib/buildStorage';
import type { SaveSummary } from '#/lib/saves';
import { createSave, deleteSave, listSaves, loadSaveInventory } from '#/lib/saves';

export const Route = createFileRoute('/')({ component: Home });

const TAB_WEAPONS = 'weapons';
const TAB_GEMS = 'gems';
const TAB_SAVES = 'saves';

const EMPTY_SLOTS: Array<Socket | null> = [null, null, null];

// Stats to start from when no save is loaded (logged-out building); fully editable.
const DEFAULT_STATS: Stats = { str: 10, skl: 10, blt: 10, arc: 10 };

function Home() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  // The current user's uploaded saves (metadata only); empty when logged out.
  const [saves, setSaves] = useState<Array<SaveSummary>>([]);
  // The scaling stats fed to the calc: a neutral default until a save seeds them,
  // then editable.
  const [editStats, setEditStats] = useState<Stats>(DEFAULT_STATS);
  const [weaponIds, setWeaponIds] = useState<Array<string>>([]);
  // Per-weapon gem socketing (3 slots each); the source of truth for each card.
  const [slotsByWeapon, setSlotsByWeapon] = useState<Record<string, Array<Socket | null>>>({});
  // Per-weapon upgrade level (+0..=10); seeded from the save, then editable.
  const [levelByWeapon, setLevelByWeapon] = useState<Record<string, number>>({});
  // Custom gems created this session — ephemeral, reusable across slots.
  const [customGems, setCustomGems] = useState<Array<Socket>>([]);
  const [target, setTarget] = useState<DamageTarget>(DamageTarget.Total);
  // 'compare' = every weapon may use any gem; 'loadout' = gems are a shared pool
  // consumed down the weapon list (Mode.Plan).
  const [mode, setMode] = useState<'compare' | 'loadout'>('compare');
  // Gem instance ids the player has excluded from auto-optimization (e.g. a
  // high-AR gem whose curse the calc can't see). Re-optimizes when it changes.
  const [excludedGemIds, setExcludedGemIds] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TAB_WEAPONS);

  // Rehydrate the working build from localStorage on first load so a refresh (or
  // a logged-out session) doesn't lose it. The inventory isn't stored, so this
  // restores the build config only.
  const hydrated = useRef(false);
  useEffect(() => {
    const stored = loadLocalBuild();
    if (stored) {
      setEditStats(stored.editStats);
      setWeaponIds(stored.weaponIds);
      setSlotsByWeapon(stored.slotsByWeapon);
      setLevelByWeapon(stored.levelByWeapon);
      setCustomGems(stored.customGems);
      setTarget(stored.target);
      setMode(stored.mode);
    }
  }, []);

  // Persist the working build on change. Skip the first run so the initial
  // defaults don't clobber stored data before the rehydrate above applies.
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    saveLocalBuild({ editStats, weaponIds, slotsByWeapon, levelByWeapon, customGems, target, mode });
  }, [editStats, weaponIds, slotsByWeapon, levelByWeapon, customGems, target, mode]);

  // Load an inventory into the app: seed stats from it and clear the build.
  function applyInventory(inv: Inventory) {
    setInventory(inv);
    setEditStats({ ...inv.stats });
    setSlotsByWeapon({});
    setLevelByWeapon({});
    setCustomGems([]);
    setExcludedGemIds(new Set());
    setShowExcluded(false);
  }

  // The current user's saves (newest first); empty/cleared when logged out.
  const refreshSaves = useCallback(async () => {
    if (!user) {
      setSaves([]);
      return;
    }
    try {
      setSaves(await listSaves());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [user]);

  useEffect(() => {
    void refreshSaves();
  }, [refreshSaves]);

  // Drop the Saves tab on logout so we don't render an empty, gated panel.
  useEffect(() => {
    if (!user && activeTab === TAB_SAVES) setActiveTab(TAB_WEAPONS);
  }, [user, activeTab]);

  // Importing a save (logged-in only): parse, load it, and persist it to Supabase.
  async function handleFile(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const inv = await parseSave(new Uint8Array(arrayBuffer));
      applyInventory(inv);
      if (user) {
        await createSave(inv);
        await refreshSaves();
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Load a stored save: fetch its inventory, apply it, and show the Weapons tab.
  async function loadSave(id: string) {
    try {
      applyInventory(await loadSaveInventory(id));
      setActiveTab(TAB_WEAPONS);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeSave(id: string) {
    try {
      await deleteSave(id);
      await refreshSaves();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Right-hand owned weapons, keyed by their AR-table slug: the set acquired in
  // the save, and the highest level owned (the default for that weapon's card).
  const ownedWeaponIds = useMemo(
    () => new Set((inventory?.weapons ?? []).map((w) => w.weaponId).filter((id): id is string => !!id)),
    [inventory],
  );
  const ownedLevels = useMemo(() => {
    const levels = new Map<string, number>();
    for (const w of inventory?.weapons ?? []) {
      if (!w.weaponId) continue;
      const prev = levels.get(w.weaponId);
      if (prev == null || w.level > prev) levels.set(w.weaponId, w.level);
    }
    return levels;
  }, [inventory]);

  // Selecting weapons: seed a level for each newly-added id — the save level when
  // owned, otherwise +10 (max) so an unacquired weapon shows its full potential.
  function selectWeapons(ids: Array<string>) {
    setLevelByWeapon((prev) => {
      const next = { ...prev };
      for (const id of ids) if (next[id] == null) next[id] = ownedLevels.get(id) ?? 10;
      return next;
    });
    setWeaponIds(ids);
  }

  function setLevel(weaponId: string, level: number) {
    setLevelByWeapon((prev) => ({ ...prev, [weaponId]: Math.max(0, Math.min(10, level)) }));
  }

  function editStat(key: keyof Stats, value: number) {
    setEditStats((prev) => ({ ...prev, [key]: value }));
  }
  function revertStat(key: keyof Stats) {
    if (inventory) setEditStats((prev) => ({ ...prev, [key]: inventory.stats[key] }));
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

  // Weapon order is Loadout priority, so it's reorderable: drag (dnd-kit) or the
  // per-card up/down buttons. A small pointer threshold keeps clicks on the
  // card's buttons from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function moveWeapon(weaponId: string, delta: number) {
    setWeaponIds((prev) => {
      const from = prev.indexOf(weaponId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWeaponIds((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
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

  // The gem pool fed to the optimizer: every owned gem minus the excluded ones.
  // Pre-filtering here applies exclusion in both Compare and Loadout (Compare
  // ignores the optimizer's own `excludedGems` arg, so this is the robust path).
  function availablePool(excluded: Set<string>) {
    return inventory ? inventory.gems.filter((gem) => !excluded.has(gem.id)) : [];
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
      const level = levelByWeapon[weaponId] ?? 10;
      const [result] = await optimize([weaponId], availablePool(excludedGemIds), editStats, target, optMode, excluded, [
        level,
      ]);
      if (result) setSlotsByWeapon((prev) => ({ ...prev, [weaponId]: slotsFromResult(result) }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Optimize every selected weapon against the pool minus `excluded`. Loadout
  // (Mode.Plan) walks them in list order, removing each weapon's chosen gems from
  // the pool for the weapons after it; Compare gives every weapon the full pool.
  async function runOptimizeAll(excluded: Set<string>, useMode: 'compare' | 'loadout' = mode) {
    if (!inventory || !editStats || weaponIds.length === 0) return;
    try {
      const levels = weaponIds.map((id) => levelByWeapon[id] ?? 10);
      const results = await optimize(
        weaponIds,
        availablePool(excluded),
        editStats,
        target,
        useMode === 'loadout' ? Mode.Plan : Mode.Compare,
        undefined,
        levels,
      );
      const next: Record<string, Array<Socket | null>> = {};
      for (const result of results) next[result.weaponId] = slotsFromResult(result);
      setSlotsByWeapon((prev) => ({ ...prev, ...next }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function optimizeAll() {
    return runOptimizeAll(excludedGemIds);
  }

  // Switching mode re-optimizes so the shown slots always match the active mode
  // (otherwise Loadout's shared-pool picks would linger after switching to
  // Compare, and vice versa). The new mode is passed through since state is async.
  function changeMode(value: 'compare' | 'loadout') {
    if (value === mode) return;
    setMode(value);
    void runOptimizeAll(excludedGemIds, value);
  }

  // Exclude/restore a gem, then re-optimize the whole set with the new pool.
  // The next set is passed straight through since state updates are async.
  function excludeGem(gemId: string) {
    const next = new Set(excludedGemIds).add(gemId);
    setExcludedGemIds(next);
    void runOptimizeAll(next);
  }
  function unexcludeGem(gemId: string) {
    const next = new Set(excludedGemIds);
    next.delete(gemId);
    setExcludedGemIds(next);
    void runOptimizeAll(next);
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-4xl font-bold">Bloodborne Optimizer</h1>
        <AuthControl />
      </div>
      {error && <p className="mt-4 text-red-400">Error: {error}</p>}

      <CharacterHeader
        className="mt-6"
        inventory={inventory}
        stats={editStats}
        canUpload={!!user}
        onEditStat={editStat}
        onRevertStat={revertStat}
        onResetStats={resetStats}
        onFile={handleFile}
      />

      {/* Tabs are always available — a logged-out user can build without a save. */}
      {editStats && (
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Tabs
            tabs={[
              { id: TAB_WEAPONS, label: 'Weapons' },
              { id: TAB_GEMS, label: `Gems (${inventory?.gems.length ?? 0})` },
              ...(user ? [{ id: TAB_SAVES, label: `Saves (${saves.length})` }] : []),
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === TAB_WEAPONS && (
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <WeaponSelect selected={weaponIds} onChange={selectWeapons} ownedWeaponIds={ownedWeaponIds} />
                <TargetSelect className="mt-4" value={target} onChange={setTarget} />

                <div className="mt-4">
                  <span className="text-xs uppercase tracking-wide text-au-chico">Mode</span>
                  <div className="mt-1 flex gap-1 rounded-md border border-black-wool p-1">
                    {(['compare', 'loadout'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={mode === value}
                        onClick={() => changeMode(value)}
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

                {excludedGemIds.size > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowExcluded((prev) => !prev)}
                      className="cursor-pointer text-xs text-au-chico underline transition-colors hover:text-pale-mocha"
                    >
                      {excludedGemIds.size} excluded
                    </button>
                    {showExcluded && (
                      <ul className="mt-2 space-y-1">
                        {[...excludedGemIds].map((id) => {
                          const gem = inventory?.gems.find((g) => g.id === id);
                          return (
                            <li
                              key={id}
                              className="flex items-start justify-between gap-2 rounded border border-black-wool px-2 py-1.5 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-pale-mocha">{gem ? gem.name : id}</span>
                                {gem && (
                                  <ul className="mt-0.5 space-y-0.5">
                                    {gem.effects.map((effect, i) => (
                                      <li
                                        key={`${effect}-${i}`}
                                        className={isDrawbackEffect(effect) ? 'text-red-400' : 'text-pale-mocha/60'}
                                      >
                                        {effect}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => unexcludeGem(id)}
                                aria-label={`Restore ${gem ? gem.name : id} to optimization`}
                                title="Restore to optimization"
                                className="shrink-0 cursor-pointer text-base leading-none text-au-chico hover:text-pale-mocha"
                              >
                                ×
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 lg:pt-6">
                {weaponIds.length === 0 ? (
                  <p className="text-au-chico">
                    Select weapons to build. Click a gem slot to socket a gem, or auto-optimize.
                  </p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={weaponIds} strategy={verticalListSortingStrategy}>
                      <ul className="space-y-4">
                        <AnimatePresence>
                          {weaponIds.map((weaponId, index) => (
                            <WeaponCard
                              key={weaponId}
                              weaponId={weaponId}
                              index={index}
                              total={weaponIds.length}
                              level={levelByWeapon[weaponId] ?? 10}
                              onLevelChange={(level) => setLevel(weaponId, level)}
                              slots={slotsByWeapon[weaponId] ?? EMPTY_SLOTS}
                              stats={editStats}
                              inventoryGems={inventory?.gems ?? []}
                              customGems={customGems}
                              unavailableGemIds={
                                mode === 'loadout' ? new Set(gemsUsedByOtherWeapons(weaponId)) : undefined
                              }
                              onMoveUp={() => moveWeapon(weaponId, -1)}
                              onMoveDown={() => moveWeapon(weaponId, 1)}
                              onSlotChange={(slotIndex, socket) => setSlot(weaponId, slotIndex, socket)}
                              onCreateCustom={(socket) => setCustomGems((prev) => [...prev, socket])}
                              onExcludeGem={excludeGem}
                              onOptimize={() => autoOptimize(weaponId)}
                              onRemove={() => removeWeapon(weaponId)}
                            />
                          ))}
                        </AnimatePresence>
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}

          {activeTab === TAB_GEMS && <GemsPanel className="mt-6" gems={inventory?.gems ?? []} />}

          {activeTab === TAB_SAVES && user && (
            <SavesPanel className="mt-6" saves={saves} onLoad={loadSave} onDelete={removeSave} />
          )}
        </motion.div>
      )}
    </div>
  );
}
