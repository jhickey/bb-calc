import type { GemShape } from 'bb-calc-js';

import { supabase } from '#/lib/supabase';

/**
 * One effect on a user-created gem. `text` is the display string (in-game style,
 * e.g. "Physical ATK UP +27.2%", or an arbitrary label with no AR impact).
 * `cursed` marks it a drawback regardless of whether `text` is a known curse.
 */
export type CustomGemEffect = {
  text: string;
  cursed: boolean;
};

/** A row in the user's gem library (`gem` table). */
export type CustomGemRow = {
  id: string;
  name: string;
  shape: GemShape;
  /** Rating/tier, so custom gems sort alongside inventory gems. */
  tier: number;
  effects: Array<CustomGemEffect>;
};

/** The fields needed to create/update a gem. */
export type CustomGemInput = {
  name: string;
  shape: GemShape;
  tier: number;
  effects: Array<CustomGemEffect>;
};

export async function listCustomGems(): Promise<Array<CustomGemRow>> {
  const { data, error } = await supabase
    .from('gem')
    .select('id, name, shape, tier, effects')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Array<CustomGemRow>;
}

/** Persist a gem. `user_id` is filled by the DB default. */
export async function createCustomGem(input: CustomGemInput): Promise<void> {
  const { error } = await supabase.from('gem').insert(input);
  if (error) throw new Error(error.message);
}

export async function updateCustomGem(id: string, input: CustomGemInput): Promise<void> {
  const { error } = await supabase.from('gem').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCustomGem(id: string): Promise<void> {
  const { error } = await supabase.from('gem').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
