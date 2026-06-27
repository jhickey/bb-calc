import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
// Type-only: bb-calc-js eagerly initializes its wasm on import, which fails
// during the SSR shell prerender. The store is in the shell graph (Provider in
// __root), so the optimizer functions are loaded dynamically inside the thunks
// instead, and the string const-enum values are used as literals.
import type { DamageTarget, Inventory, Mode, OptimizeResult, Stats } from 'bb-calc-js';

import type { Socket } from '#/lib/gems';
import type { BuildConfig } from '#/lib/builds';
import { BUILD_CONFIG_VERSION } from '#/lib/builds';
import { loadSaveInventory } from '#/lib/saves';
import { getBuildForEdit } from '#/lib/builds';
import type { RootState } from '#/store';

const DEFAULT_STATS: Stats = { str: 10, skl: 10, blt: 10, arc: 10 };

type BuildMode = 'compare' | 'loadout';

type BuildState = {
  /** Load state for the active route (save/build fetch). */
  status: 'idle' | 'loading' | 'ready' | 'notfound';
  /** The active save's inventory, or null for a free build. */
  inventory: Inventory | null;
  /** The save this session is bound to (stamped onto saved builds). */
  activeSaveId: string | null;
  /** The build currently loaded for editing (route /builds/<id>), else null. */
  activeBuildId: string | null;
  /** A loaded build referenced a save that no longer exists. */
  orphanedSave: boolean;
  editStats: Stats;
  weaponIds: Array<string>;
  slotsByWeapon: Record<string, Array<Socket | null>>;
  levelByWeapon: Record<string, number>;
  customGems: Array<Socket>;
  target: DamageTarget;
  mode: BuildMode;
  /** Gem instance ids excluded from auto-optimization (array for serializability). */
  excludedGemIds: Array<string>;
  /** Serialized config at load/save time, for the unsaved-changes (dirty) check. */
  baseline: string;
};

function freeState(): Omit<BuildState, 'baseline'> {
  return {
    status: 'ready',
    inventory: null,
    activeSaveId: null,
    activeBuildId: null,
    orphanedSave: false,
    editStats: { ...DEFAULT_STATS },
    weaponIds: [],
    slotsByWeapon: {},
    levelByWeapon: {},
    customGems: [],
    target: 'Total' as DamageTarget,
    mode: 'compare',
    excludedGemIds: [],
  };
}

/** The shareable config subset (everything needed to restore/render a build). */
export function buildConfig(state: BuildState): BuildConfig {
  return {
    version: BUILD_CONFIG_VERSION,
    editStats: state.editStats,
    weaponIds: state.weaponIds,
    slotsByWeapon: state.slotsByWeapon,
    levelByWeapon: state.levelByWeapon,
    customGems: state.customGems,
    target: state.target,
    mode: state.mode,
    excludedGemIds: state.excludedGemIds,
  };
}

const initialState: BuildState = { ...freeState(), baseline: '' };
initialState.baseline = JSON.stringify(buildConfig(initialState));

/** Highest owned level for a weapon slug in the active save, else +10. */
function ownedLevel(inventory: Inventory | null, weaponId: string): number {
  let best: number | null = null;
  for (const w of inventory?.weapons ?? []) {
    if (w.weaponId === weaponId && (best == null || w.level > best)) best = w.level;
  }
  return best ?? 10;
}

/** Resolve an optimizer result into three sockets, keeping each gem's instance id. */
function slotsFromResult(
  inventory: Inventory | null,
  result: OptimizeResult,
  toGem: (typeof import('bb-calc-js'))['gemFromInventory'],
): Array<Socket | null> {
  const slots: Array<Socket | null> = [null, null, null];
  for (const slot of result.slots) {
    const ref = slot.gem;
    if (!ref) continue;
    const owned = inventory?.gems.find((gem) => gem.id === ref.id);
    if (owned) slots[slot.slot] = { gem: toGem(owned), effects: owned.effects, gemId: owned.id };
  }
  return slots;
}

function availablePool(state: BuildState) {
  const excluded = new Set(state.excludedGemIds);
  return state.inventory ? state.inventory.gems.filter((g) => !excluded.has(g.id)) : [];
}

function gemsUsedByOtherWeapons(state: BuildState, weaponId: string): Array<string> {
  return Object.entries(state.slotsByWeapon)
    .filter(([id]) => id !== weaponId)
    .flatMap(([, slots]) => slots)
    .map((s) => s?.gemId)
    .filter((id): id is string => id != null);
}

// --- Thunks ---------------------------------------------------------------

/** Load a save by id and seed the editor (route: /s/<id>). */
export const loadSave = createAsyncThunk('build/loadSave', async (saveId: string) => {
  const inventory = await loadSaveInventory(saveId);
  return { inventory, saveId };
});

/** Load a build by id (plus its referenced save) and seed the editor (route: /builds/<id>). */
export const loadBuild = createAsyncThunk('build/loadBuild', async (buildId: string) => {
  const { config, saveId } = await getBuildForEdit(buildId);
  const inventory = saveId ? await loadSaveInventory(saveId).catch(() => null) : null;
  return { buildId, config, inventory, saveId: inventory ? saveId : null };
});

/** Optimize every selected weapon against the current pool. */
export const optimizeAll = createAsyncThunk('build/optimizeAll', async (_: void, { getState }) => {
  const state = (getState() as RootState).build;
  if (!state.inventory || state.weaponIds.length === 0) return {};
  const { optimize, gemFromInventory } = await import('bb-calc-js');
  const levels = state.weaponIds.map((id) => state.levelByWeapon[id] ?? 10);
  const results = await optimize(
    state.weaponIds,
    availablePool(state),
    state.editStats,
    state.target,
    (state.mode === 'loadout' ? 'Plan' : 'Compare') as Mode,
    undefined,
    levels,
  );
  const next: Record<string, Array<Socket | null>> = {};
  for (const result of results) next[result.weaponId] = slotsFromResult(state.inventory, result, gemFromInventory);
  return next;
});

/** Optimize a single weapon (Loadout excludes gems used by other weapons). */
export const autoOptimizeWeapon = createAsyncThunk(
  'build/autoOptimizeWeapon',
  async (weaponId: string, { getState }) => {
    const state = (getState() as RootState).build;
    if (!state.inventory) return { weaponId, slots: null };
    const { optimize, gemFromInventory } = await import('bb-calc-js');
    const excluded = state.mode === 'loadout' ? gemsUsedByOtherWeapons(state, weaponId) : undefined;
    const optMode = (state.mode === 'loadout' ? 'Plan' : 'Compare') as Mode;
    const level = state.levelByWeapon[weaponId] ?? 10;
    const [result] = await optimize(
      [weaponId],
      availablePool(state),
      state.editStats,
      state.target,
      optMode,
      excluded,
      [level],
    );
    return { weaponId, slots: result ? slotsFromResult(state.inventory, result, gemFromInventory) : null };
  },
);

// --- Slice ----------------------------------------------------------------

const slice = createSlice({
  name: 'build',
  initialState,
  reducers: {
    resetToFree(state) {
      Object.assign(state, freeState());
      state.baseline = JSON.stringify(buildConfig(state));
    },
    setStatus(state, action: PayloadAction<BuildState['status']>) {
      state.status = action.payload;
    },
    /** Snapshot the current config as the clean baseline (after a successful save). */
    markClean(state) {
      state.baseline = JSON.stringify(buildConfig(state));
    },
    selectWeapons(state, action: PayloadAction<Array<string>>) {
      for (const id of action.payload) {
        if (state.levelByWeapon[id] == null) state.levelByWeapon[id] = ownedLevel(state.inventory, id);
      }
      state.weaponIds = action.payload;
    },
    setLevel(state, action: PayloadAction<{ weaponId: string; level: number }>) {
      state.levelByWeapon[action.payload.weaponId] = Math.max(0, Math.min(10, action.payload.level));
    },
    setSlot(state, action: PayloadAction<{ weaponId: string; slotIndex: number; socket: Socket | null }>) {
      const { weaponId, slotIndex, socket } = action.payload;
      const slots = (state.slotsByWeapon[weaponId] ?? [null, null, null]).slice();
      slots[slotIndex] = socket;
      state.slotsByWeapon[weaponId] = slots;
    },
    removeWeapon(state, action: PayloadAction<string>) {
      state.weaponIds = state.weaponIds.filter((id) => id !== action.payload);
    },
    moveWeapon(state, action: PayloadAction<{ from: number; to: number }>) {
      const { from, to } = action.payload;
      if (from < 0 || to < 0 || from >= state.weaponIds.length || to >= state.weaponIds.length) return;
      const [moved] = state.weaponIds.splice(from, 1);
      state.weaponIds.splice(to, 0, moved);
    },
    setTarget(state, action: PayloadAction<DamageTarget>) {
      state.target = action.payload;
    },
    setMode(state, action: PayloadAction<BuildMode>) {
      state.mode = action.payload;
    },
    addCustomGem(state, action: PayloadAction<Socket>) {
      state.customGems.push(action.payload);
    },
    setStat(state, action: PayloadAction<{ key: keyof Stats; value: number }>) {
      state.editStats[action.payload.key] = action.payload.value;
    },
    revertStat(state, action: PayloadAction<keyof Stats>) {
      if (state.inventory) state.editStats[action.payload] = state.inventory.stats[action.payload];
    },
    resetStats(state) {
      if (state.inventory) state.editStats = { ...state.inventory.stats };
    },
    excludeGem(state, action: PayloadAction<string>) {
      if (!state.excludedGemIds.includes(action.payload)) state.excludedGemIds.push(action.payload);
    },
    unexcludeGem(state, action: PayloadAction<string>) {
      state.excludedGemIds = state.excludedGemIds.filter((id) => id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSave.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadSave.fulfilled, (state, action) => {
        Object.assign(state, freeState());
        state.inventory = action.payload.inventory;
        state.activeSaveId = action.payload.saveId;
        state.editStats = { ...action.payload.inventory.stats };
        state.status = 'ready';
        state.baseline = JSON.stringify(buildConfig(state));
      })
      .addCase(loadSave.rejected, (state) => {
        state.status = 'notfound';
      })
      .addCase(loadBuild.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadBuild.fulfilled, (state, action) => {
        const { config, inventory, saveId, buildId } = action.payload;
        Object.assign(state, freeState());
        state.inventory = inventory;
        state.activeSaveId = saveId;
        state.activeBuildId = buildId;
        state.editStats = config.editStats;
        state.weaponIds = config.weaponIds;
        state.slotsByWeapon = config.slotsByWeapon;
        state.levelByWeapon = config.levelByWeapon;
        state.customGems = config.customGems;
        state.target = config.target;
        state.mode = config.mode;
        state.excludedGemIds = config.excludedGemIds;
        state.orphanedSave =
          inventory == null && Object.values(config.slotsByWeapon).some((s) => s.some((x) => x?.gemId));
        state.status = 'ready';
        state.baseline = JSON.stringify(config);
      })
      .addCase(loadBuild.rejected, (state) => {
        state.status = 'notfound';
      })
      .addCase(optimizeAll.fulfilled, (state, action) => {
        Object.assign(state.slotsByWeapon, action.payload);
      })
      .addCase(autoOptimizeWeapon.fulfilled, (state, action) => {
        if (action.payload.slots) state.slotsByWeapon[action.payload.weaponId] = action.payload.slots;
      });
  },
});

export const buildActions = slice.actions;
export const buildReducer = slice.reducer;

// --- Selectors ------------------------------------------------------------

export const selectBuild = (s: RootState) => s.build;
export const selectInventory = (s: RootState) => s.build.inventory;

/** Memoized so it returns a stable config object until an input field changes. */
export const selectBuildConfig = createSelector([(s: RootState) => s.build], buildConfig);

/** Owned weapon slugs in the active save (drives the "hide unacquired" filter). */
export const selectOwnedWeaponIds = createSelector(
  [(s: RootState) => s.build.inventory],
  (inventory): ReadonlySet<string> =>
    new Set((inventory?.weapons ?? []).map((w) => w.weaponId).filter((id): id is string => !!id)),
);

/** Whether there are unsaved changes worth warning about on unload. */
export const selectIsDirty = (s: RootState): boolean =>
  s.build.weaponIds.length > 0 && JSON.stringify(buildConfig(s.build)) !== s.build.baseline;
