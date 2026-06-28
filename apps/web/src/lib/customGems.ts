import type { GemShape } from 'bb-calc-js';

import { supabase } from '#/lib/supabase';

/** A row in the user's custom-gem library (`gem` table). */
export type CustomGemRow = {
  id: string;
  name: string;
  shape: GemShape;
  /** Effect-spec strings, re-parsed client-side via `parseGemEffects`. */
  effects: Array<string>;
};

/** The fields needed to create/update a custom gem. */
export type CustomGemInput = {
  name: string;
  shape: GemShape;
  effects: Array<string>;
};

export async function listCustomGems(): Promise<Array<CustomGemRow>> {
  const { data, error } = await supabase
    .from('gem')
    .select('id, name, shape, effects')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Array<CustomGemRow>;
}

/** Persist a custom gem. `user_id` is filled by the DB default. */
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
