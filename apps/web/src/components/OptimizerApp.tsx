import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { parseSave } from 'bb-calc-js';

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
import { isDrawbackEffect } from '#/lib/gems';
import { useAppDispatch, useAppSelector } from '#/store';
import {
  useCreateSaveMutation,
  useDeleteBuildMutation,
  useDeleteSaveMutation,
  useListBuildsQuery,
  useListSavesQuery,
  useRenameBuildMutation,
} from '#/store/api';
import { autoOptimizeWeapon, buildActions, optimizeAll, selectIsDirty, selectOwnedWeaponIds } from '#/store/buildSlice';

const TAB_WEAPONS = 'weapons';
const TAB_GEMS = 'gems';
const TAB_SAVES = 'saves';
const TAB_BUILDS = 'builds';

/**
 * The optimizer editor. All build state lives in the Redux `build` slice (seeded
 * by the routes via loadSave/loadBuild/resetToFree); this component reads it with
 * selectors and dispatches actions, rather than holding state and prop-drilling.
 */
export function OptimizerApp() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const inventory = useAppSelector((s) => s.build.inventory);
  const editStats = useAppSelector((s) => s.build.editStats);
  const weaponIds = useAppSelector((s) => s.build.weaponIds);
  const target = useAppSelector((s) => s.build.target);
  const mode = useAppSelector((s) => s.build.mode);
  const excludedGemIds = useAppSelector((s) => s.build.excludedGemIds);
  const orphanedSave = useAppSelector((s) => s.build.orphanedSave);
  const ownedWeaponIds = useAppSelector(selectOwnedWeaponIds);
  const dirty = useAppSelector(selectIsDirty);

  const { data: saves = [] } = useListSavesQuery(undefined, { skip: !user });
  const { data: builds = [] } = useListBuildsQuery(undefined, { skip: !user });
  const [createSaveMut] = useCreateSaveMutation();
  const [deleteSaveMut] = useDeleteSaveMutation();
  const [renameBuildMut] = useRenameBuildMutation();
  const [deleteBuildMut] = useDeleteBuildMutation();

  const [activeTab, setActiveTab] = useState<string>(TAB_WEAPONS);
  const [showSaveBuild, setShowSaveBuild] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warn before unloading with unsaved changes (no localStorage).
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Drop the logged-in-only tabs on logout so we don't render empty, gated panels.
  useEffect(() => {
    if (!user && (activeTab === TAB_SAVES || activeTab === TAB_BUILDS)) setActiveTab(TAB_WEAPONS);
  }, [user, activeTab]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = weaponIds.indexOf(String(active.id));
    const to = weaponIds.indexOf(String(over.id));
    if (from >= 0 && to >= 0) dispatch(buildActions.moveWeapon({ from, to }));
  }

  async function handleFile(file: File) {
    try {
      const inv = await parseSave(new Uint8Array(await file.arrayBuffer()));
      const id = await createSaveMut(inv).unwrap();
      navigate({ to: '/s/$saveId', params: { saveId: id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function changeMode(value: 'compare' | 'loadout') {
    if (value === mode) return;
    dispatch(buildActions.setMode(value));
    void dispatch(optimizeAll());
  }

  function excludeGem(gemId: string) {
    dispatch(buildActions.excludeGem(gemId));
    void dispatch(optimizeAll());
  }
  function unexcludeGem(gemId: string) {
    dispatch(buildActions.unexcludeGem(gemId));
    void dispatch(optimizeAll());
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
        onEditStat={(key, value) => dispatch(buildActions.setStat({ key, value }))}
        onRevertStat={(key) => dispatch(buildActions.revertStat(key))}
        onResetStats={() => dispatch(buildActions.resetStats())}
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
              <WeaponSelect
                selected={weaponIds}
                onChange={(ids) => dispatch(buildActions.selectWeapons(ids))}
                ownedWeaponIds={ownedWeaponIds}
              />
              <TargetSelect className="mt-4" value={target} onChange={(t) => dispatch(buildActions.setTarget(t))} />

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

              <Button className="mt-4" onClick={() => dispatch(optimizeAll())} disabled={weaponIds.length === 0}>
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

              {excludedGemIds.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowExcluded((prev) => !prev)}
                    className="cursor-pointer text-xs text-au-chico underline transition-colors hover:text-pale-mocha"
                  >
                    {excludedGemIds.length} excluded
                  </button>
                  {showExcluded && (
                    <ul className="mt-2 space-y-1">
                      {excludedGemIds.map((id) => {
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
                            onExcludeGem={excludeGem}
                            onOptimize={() => dispatch(autoOptimizeWeapon(weaponId))}
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
            onDelete={(id) => void deleteSaveMut(id)}
          />
        )}

        {activeTab === TAB_BUILDS && user && (
          <BuildsPanel
            className="mt-6"
            builds={builds}
            onLoad={(id) => navigate({ to: '/builds/$buildId', params: { buildId: id } })}
            onRename={(id, name) => void renameBuildMut({ id, name })}
            onDelete={(id) => void deleteBuildMut(id)}
          />
        )}
      </motion.div>

      <AnimatePresence>{showSaveBuild && <SaveBuildModal onClose={() => setShowSaveBuild(false)} />}</AnimatePresence>
    </div>
  );
}
