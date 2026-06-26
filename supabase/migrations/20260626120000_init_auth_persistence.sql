-- bb-calc auth & persistence schema.
--
-- Tables: save, build, gem. All owner-scoped via RLS (user_id = auth.uid()).
-- Builds are private; a build is shared read-only by its short link through the
-- get_shared_build() SECURITY DEFINER function (no table-wide public read).

-- ---------------------------------------------------------------------------
-- Short-link generator: 8 random url-safe base62 chars. Not security-sensitive
-- (uniqueness is enforced by the column constraint + the insert trigger below),
-- so random() is fine and avoids a pgcrypto dependency.
-- ---------------------------------------------------------------------------
create or replace function public.gen_short_link()
returns text
language sql
volatile
as $$
  select string_agg(
    substr(
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      floor(random() * 62)::int + 1,
      1
    ),
    ''
  )
  from generate_series(1, 8);
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- An uploaded Bloodborne save: metadata for the Saves list + the full parsed
-- Inventory as jsonb (gems/weapons/armor/items/runes), loaded back on click.
create table public.save (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  character_name  text not null,
  character_level integer not null,
  playtime_ms     bigint not null,
  inventory       jsonb not null,
  created_at      timestamptz not null default now()
);
create index save_user_id_idx on public.save (user_id);

-- A saved, shareable build configuration. `config` is a self-contained snapshot
-- (stats, weapons, levels, mode, target, slotsByWeapon with gems embedded,
-- exclusions) so a shared build renders without the owner's save.
create table public.build (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  save_id    uuid references public.save (id) on delete set null,
  name       text not null,
  short_link text not null unique,
  config     jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index build_user_id_idx on public.build (user_id);

-- A user's reusable custom-gem library (shown atop the Gems tab). `effects` are
-- the effect-spec strings, re-parsed client-side via parseGemEffects.
create table public.gem (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  shape      text not null,
  effects    text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index gem_user_id_idx on public.gem (user_id);

-- ---------------------------------------------------------------------------
-- Triggers: build short link + updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_build_short_link()
returns trigger
language plpgsql
as $$
begin
  if new.short_link is null then
    loop
      new.short_link := public.gen_short_link();
      exit when not exists (select 1 from public.build where short_link = new.short_link);
    end loop;
  end if;
  return new;
end;
$$;

create trigger build_set_short_link
  before insert on public.build
  for each row execute function public.set_build_short_link();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger build_touch_updated_at
  before update on public.build
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security: owner-only on every table
-- ---------------------------------------------------------------------------
alter table public.save enable row level security;
alter table public.build enable row level security;
alter table public.gem enable row level security;

create policy save_select_own on public.save for select using (user_id = auth.uid());
create policy save_insert_own on public.save for insert with check (user_id = auth.uid());
create policy save_update_own on public.save for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy save_delete_own on public.save for delete using (user_id = auth.uid());

create policy build_select_own on public.build for select using (user_id = auth.uid());
create policy build_insert_own on public.build for insert with check (user_id = auth.uid());
create policy build_update_own on public.build for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy build_delete_own on public.build for delete using (user_id = auth.uid());

create policy gem_select_own on public.gem for select using (user_id = auth.uid());
create policy gem_insert_own on public.gem for insert with check (user_id = auth.uid());
create policy gem_update_own on public.gem for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gem_delete_own on public.gem for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public read of a single build by its short link. SECURITY DEFINER bypasses
-- the owner-only RLS for this one lookup, and returns a curated shape (no
-- user_id / save_id), so /b/<short_link> works for anyone with the link without
-- exposing the table.
-- ---------------------------------------------------------------------------
create or replace function public.get_shared_build(p_short_link text)
returns table (name text, config jsonb, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select name, config, created_at
  from public.build
  where short_link = p_short_link;
$$;

revoke execute on function public.get_shared_build(text) from public;
grant execute on function public.get_shared_build(text) to anon, authenticated;
