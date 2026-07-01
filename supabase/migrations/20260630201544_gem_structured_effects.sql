-- Custom-gem improvements: give the gem library a tier and richer effects.
--
-- `effects` moves from text[] (plain effect-spec strings) to jsonb: an array of
-- { "text": <string>, "cursed": <bool> } objects. This lets a gem carry an
-- arbitrary, non-AR effect string and mark any effect (including free text) as
-- cursed. Existing rows (if any) are converted, tagging each string not cursed.
-- `tier` mirrors an inventory gem's rating so custom gems sort alongside them.

alter table public.gem
  add column if not exists tier int not null default 0;

-- A subquery isn't allowed in an ALTER COLUMN ... USING transform, so convert via
-- a new column: aggregate each text[] into a jsonb array of {text, cursed:false}.
alter table public.gem add column effects_jsonb jsonb not null default '[]'::jsonb;

update public.gem
set effects_jsonb = coalesce(
  (select jsonb_agg(jsonb_build_object('text', e, 'cursed', false)) from unnest(effects) as e),
  '[]'::jsonb
);

alter table public.gem drop column effects;
alter table public.gem rename column effects_jsonb to effects;
