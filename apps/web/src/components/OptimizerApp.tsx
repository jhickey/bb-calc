import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
import { BuildsPanel } from '#/components/BuildsPanel';
import { Button } from '#/components/Button';
import { CharacterHeader } from '#/components/CharacterHeader';
import { GemsPanel } from '#/components/GemsPanel';
import { SaveBuildModal } from '#/components/SaveBuildModal';
import { SavesPanel } from '#/components/SavesPanel';
import { Tabs } from '#/components/Tabs';
import { TargetSelect } from '#/components/TargetSelect';
import { WeaponCard } from '#/components/WeaponCard';
import { WeaponSelect } from '#/components/WeaponSelect';
import { useAuth } from '#/lib/auth';
import type { Socket } from '#/lib/gems';
import { isDrawbackEffect } from '#/lib/gems';
import type { BuildConfig, BuildSummary } from '#/lib/builds';
import { BUILD_CONFIG_VERSION, deleteBuild, listBuilds, renameBuild } from '#/lib/builds';
import type { SaveSummary } from '#/lib/saves';
import { createSave, deleteSave, listSaves } from '#/lib/saves';

const TAB_WEAPONS = 'weapons';
const TAB_GEMS = 'gems';
const TAB_SAVES = 'saves';
const TAB_BUILDS = 'builds';

const EMPTY_SLOTS: Array<Socket | null> = [null, null, null];

// Stats to start from when there's no save (free building); fully editable.
const DEFAULT_STATS: Stats = { str: 10, skl: 10, blt: 10, arc: 10 };

type OptimizerAppProps = {
  /** The save's inventory when this view is bound to a save (`/s/<id>` or a
   * save-backed build); null for a free build. */
  inventory: Inventory | null;
  /** The build to seed the editor with (from `/builds/<id>`); null otherwise. */
  initialBuild: BuildConfig | null;
  /** The save id this session is bound to; stamped onto builds saved here. */
  activeSaveId: string | null;
  /** True when a loaded build referenced a save that no longer exists. */
  orphanedSave?: boolean;
};

/**
 * The optimizer editor. Its starting state comes entirely from the route (a
 * save's inventory and/or a build's config) — there is no localStorage; refresh
 * re-derives everything from the URL. Routes should key this by their identity
 * so navigating between saves/builds remounts it fresh.
 */
export function OptimizerApp({ inventory, initialBuild, activeSaveId, orphanedSave = false }: OptimizerAppProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [editStats, setEditStats] = useState<Stats>(
    () => initialBuild?.editStats ?? (inventory ? { ...inventory.stats } : DEFAULT_STATS),
  );
  const [weaponIds, setWeaponIds] = useState<Array<string>>(() => initialBuild?.weaponIds ?? []);
  const [slotsByWeapon, setSlotsByWeapon] = useState<Record<string, Array<Socket | null>>>(
    () => initialBuild?.slotsByWeapon ?? {},
  );
  const [levelByWeapon, setLevelByWeapon] = useState<Record<string, number>>(() => initialBuild?.levelByWeapon ?? {});
  const [customGems, setCustomGems] = useState<Array<Socket>>(() => initialBuild?.customGems ?? []);
  const [target, setTarget] = useState<DamageTarget>(() => initialBuild?.target ?? DamageTarget.Total);
  const [mode, setMode] = useState<'compare' | 'loadout'>(() => initialBuild?.mode ?? 'compare');
  const [excludedGemIds, setExcludedGemIds] = useState<Set<string>>(() => new Set(initialBuild?.excludedGemIds ?? []));
  const [showExcluded, setShowExcluded] = useState(false);
  const [showSaveBuild, setShowSaveBuild] = useState(false);
  const [savedBuildId, setSavedBuildId] = useState<string | null>(null);
  const [saves, setSaves] = useState<Array<SaveSummary>>([]);
  const [builds, setBuilds] = useState<Array<BuildSummary>>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TAB_WEAPONS);

  // Snapshot the current build into a self-contained, shareable config.
  const captureBuild = useCallback(
    (): BuildConfig => ({
      version: BUILD_CONFIG_VERSION,
      editStats,
      weaponIds,
      slotsByWeapon,
      levelByWeapon,
      customGems,
      target,
      mode,
      excludedGemIds: [...excludedGemIds],
    }),
    [editStats, weaponIds, slotsByWeapon, levelByWeapon, customGems, target, mode, excludedGemIds],
  );

  // Warn before unloading with unsaved changes (replaces localStorage). Baseline
  // is the state this view loaded with; a build is "dirty" once it differs and is
  // non-empty.
  const baselineRef = useRef('');
  useEffect(() => {
    baselineRef.current = JSON.stringify(captureBuild());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dirty =
    baselineRef.current !== '' && weaponIds.length > 0 && JSON.stringify(captureBuild()) !== baselineRef.current;
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

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

  const refreshBuilds = useCallback(async () => {
    if (!user) {
      setBuilds([]);
      return;
    }
    try {
      setBuilds(await listBuilds());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [user]);

  useEffect(() => {
    void refreshSaves();
    void refreshBuilds();
  }, [refreshSaves, refreshBuilds]);

  useEffect(() => {
    if (!user && (activeTab === TAB_SAVES || activeTab === TAB_BUILDS)) setActiveTab(TAB_WEAPONS);
  }, [user, activeTab]);

  // Import a save (logged-in only): parse, persist, then route to its page.
  async function handleFile(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const inv = await parseSave(new Uint8Array(arrayBuffer));
      const id = await createSave(inv);
      await refreshSaves();
      navigate({ to: '/s/$saveId', params: { saveId: id } });
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

  async function renameBuildById(id: string, name: string) {
    try {
      await renameBuild(id, name);
      await refreshBuilds();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeBuild(id: string) {
    try {
      await deleteBuild(id);
      await refreshBuilds();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onBuildSaved(build: BuildSummary) {
    void refreshBuilds();
    baselineRef.current = JSON.stringify(captureBuild()); // mark clean so unload won't warn
    setSavedBuildId(build.id);
  }

  // On closing the Save Build modal, route to the saved build so its URL is
  // bookmarkable and refresh-stable.
  function closeSaveBuild() {
    setShowSaveBuild(false);
    if (savedBuildId) {
      const id = savedBuildId;
      setSavedBuildId(null);
      navigate({ to: '/builds/$buildId', params: { buildId: id } });
    }
  }

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

  function gemsUsedByOtherWeapons(weaponId: string): Array<string> {
    return Object.entries(slotsByWeapon)
      .filter(([id]) => id !== weaponId)
      .flatMap(([, slots]) => slots)
      .map((socket) => socket?.gemId)
      .filter((id): id is string => id != null);
  }

  function availablePool(excluded: Set<string>) {
    return inventory ? inventory.gems.filter((gem) => !excluded.has(gem.id)) : [];
  }

  async function autoOptimize(weaponId: string) {
    if (!inventory) return;
    try {
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

  async function runOptimizeAll(excluded: Set<string>, useMode: 'compare' | 'loadout' = mode) {
    if (!inventory || weaponIds.length === 0) return;
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

  function changeMode(value: 'compare' | 'loadout') {
    if (value === mode) return;
    setMode(value);
    void runOptimizeAll(excludedGemIds, value);
  }

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
      {orphanedSave && (
        <p className="mt-4 text-sm text-au-chico">
          This build’s save was deleted — its socketed gems are kept, but there’s no inventory to re-optimize against.
        </p>
      )}

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
            ...(user
              ? [
                  { id: TAB_SAVES, label: `Saves (${saves.length})` },
                  { id: TAB_BUILDS, label: `Builds (${builds.length})` },
                ]
              : []),
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

              {weaponIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSaveBuild(true)}
                  className="mt-2 block cursor-pointer text-sm text-au-chico underline transition-colors hover:text-pale-mocha"
                >
                  Save build
                </button>
              )}

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
          <SavesPanel
            className="mt-6"
            saves={saves}
            onLoad={(id) => navigate({ to: '/s/$saveId', params: { saveId: id } })}
            onDelete={removeSave}
          />
        )}

        {activeTab === TAB_BUILDS && user && (
          <BuildsPanel
            className="mt-6"
            builds={builds}
            onLoad={(id) => navigate({ to: '/builds/$buildId', params: { buildId: id } })}
            onRename={renameBuildById}
            onDelete={removeBuild}
          />
        )}
      </motion.div>

      <AnimatePresence>
        {showSaveBuild && (
          <SaveBuildModal
            getConfig={captureBuild}
            saveId={activeSaveId}
            onSaved={onBuildSaved}
            onClose={closeSaveBuild}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
