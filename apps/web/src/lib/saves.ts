import type { Inventory } from 'bb-calc-js';

import { supabase } from '#/lib/supabase';

/** A save row without its (large) inventory blob — enough for the Saves list. */
export type SaveSummary = {
  id: string;
  characterName: string;
  characterLevel: number;
  playtimeMs: number;
  createdAt: string;
};

type SaveRow = {
  id: string;
  character_name: string;
  character_level: number;
  playtime_ms: number;
  created_at: string;
};

function toSummary(row: SaveRow): SaveSummary {
  return {
    id: row.id,
    characterName: row.character_name,
    characterLevel: row.character_level,
    playtimeMs: row.playtime_ms,
    createdAt: row.created_at,
  };
}

/** The current user's saves, newest first (metadata only, no inventory). */
export async function listSaves(): Promise<Array<SaveSummary>> {
  const { data, error } = await supabase
    .from('save')
    .select('id, character_name, character_level, playtime_ms, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Array<SaveRow>).map(toSummary);
}

/** Fetch one save's full parsed inventory. */
export async function loadSaveInventory(id: string): Promise<Inventory> {
  const { data, error } = await supabase.from('save').select('inventory').eq('id', id).single();
  if (error) throw new Error(error.message);
  return (data as { inventory: Inventory }).inventory;
}

/** Persist a freshly-parsed inventory. `user_id` is filled by the DB default. */
export async function createSave(inventory: Inventory): Promise<void> {
  const { error } = await supabase.from('save').insert({
    character_name: inventory.character.name,
    character_level: inventory.character.level,
    playtime_ms: inventory.character.playtimeMs,
    inventory,
  });
  if (error) throw new Error(error.message);
}

export async function deleteSave(id: string): Promise<void> {
  const { error } = await supabase.from('save').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
