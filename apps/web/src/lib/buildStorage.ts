import type { DamageTarget, Stats } from 'bb-calc-js';

import type { Socket } from '#/lib/gems';

const KEY = 'bb-calc:current-build';
const VERSION = 1;

/**
 * The working build persisted to localStorage so it survives a refresh (and so a
 * logged-out user doesn't lose their work). The inventory is intentionally not
 * stored — it comes from an uploaded save / Supabase — and sockets embed their
 * gem data, so the build rehydrates on its own.
 */
export type StoredBuild = {
  editStats: Stats;
  weaponIds: Array<string>;
  slotsByWeapon: Record<string, Array<Socket | null>>;
  levelByWeapon: Record<string, number>;
  customGems: Array<Socket>;
  target: DamageTarget;
  mode: 'compare' | 'loadout';
};

export function loadLocalBuild(): StoredBuild | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number } & StoredBuild;
    if (parsed.version !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalBuild(build: StoredBuild): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...build }));
  } catch {
    // Ignore quota / serialization failures — persistence is best-effort.
  }
}

export function clearLocalBuild(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
