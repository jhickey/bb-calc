import type { DamageTarget, Stats } from 'bb-calc-js';

import { supabase } from '#/lib/supabase';
import type { Socket } from '#/lib/gems';

export const BUILD_CONFIG_VERSION = 1;

/**
 * A self-contained snapshot of a build: everything needed to restore it (or
 * render it read-only for a shared link) without the owner's save. Sockets embed
 * their full gem data, so AR can be recomputed anywhere.
 */
export type BuildConfig = {
  version: number;
  editStats: Stats;
  weaponIds: Array<string>;
  slotsByWeapon: Record<string, Array<Socket | null>>;
  levelByWeapon: Record<string, number>;
  customGems: Array<Socket>;
  target: DamageTarget;
  mode: 'compare' | 'loadout';
  excludedGemIds: Array<string>;
};

/** A build row without its config — enough for the Builds list. */
export type BuildSummary = {
  id: string;
  name: string;
  shortLink: string;
  updatedAt: string;
};

/** A build fetched by its short link for read-only viewing. */
export type SharedBuild = {
  name: string;
  config: BuildConfig;
  createdAt: string;
};

type BuildRow = {
  id: string;
  name: string;
  short_link: string;
  updated_at: string;
};

export async function listBuilds(): Promise<Array<BuildSummary>> {
  const { data, error } = await supabase
    .from('build')
    .select('id, name, short_link, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Array<BuildRow>).map((r) => ({
    id: r.id,
    name: r.name,
    shortLink: r.short_link,
    updatedAt: r.updated_at,
  }));
}

/** A build to edit: its config plus the save it references (if any). */
export type BuildForEdit = {
  name: string;
  config: BuildConfig;
  saveId: string | null;
};

/** Fetch one of the user's own builds for editing (RLS-scoped to the owner). */
export async function getBuildForEdit(id: string): Promise<BuildForEdit> {
  const { data, error } = await supabase.from('build').select('name, config, save_id').eq('id', id).single();
  if (error) throw new Error(error.message);
  const row = data as { name: string; config: BuildConfig; save_id: string | null };
  return { name: row.name, config: row.config, saveId: row.save_id };
}

/** Save a new build; returns its summary (incl. short link) for the share UI.
 * `saveId` links the build to the save it was built on (null for free builds). */
export async function createBuild(name: string, config: BuildConfig, saveId: string | null): Promise<BuildSummary> {
  const { data, error } = await supabase
    .from('build')
    .insert({ name, config, save_id: saveId })
    .select('id, name, short_link, updated_at')
    .single();
  if (error) throw new Error(error.message);
  const r = data as BuildRow;
  return { id: r.id, name: r.name, shortLink: r.short_link, updatedAt: r.updated_at };
}

export async function renameBuild(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('build').update({ name }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteBuild(id: string): Promise<void> {
  const { error } = await supabase.from('build').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Fetch a build by its short link (public, via the SECURITY DEFINER RPC). */
export async function getSharedBuild(shortLink: string): Promise<SharedBuild | null> {
  const { data, error } = await supabase.rpc('get_shared_build', { p_short_link: shortLink });
  if (error) throw new Error(error.message);
  const rows = data as Array<{ name: string; config: BuildConfig; created_at: string }>;
  if (!rows || rows.length === 0) return null;
  return { name: rows[0].name, config: rows[0].config, createdAt: rows[0].created_at };
}

/** The public URL for a build's short link. */
export function buildShareUrl(shortLink: string): string {
  return `${window.location.origin}/b/${shortLink}`;
}
