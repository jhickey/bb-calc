# Auth & Persistence — design

Status: **agreed model, pre-implementation.** Source: roadmap "Auth and persistence with build creation".

## Overview

The web app is a client-only SPA (no backend). Persistence is **Supabase accessed directly from the browser** with the anon key; **Row-Level Security** is the enforcement layer. No `apps/api` is introduced.

- **Auth methods:** magic link (one-time email) + passkey (`signInWithPasskey`, Supabase beta as of 2026-05-28; requires `@supabase/supabase-js` ≥ 2.105 and is experimental).
- **Logged out:** stats panel + Weapons + Gems tabs work against **localStorage** (one rehydrating "current build"); no save upload, so the user builds with custom gems + manual stats. "Import Save" is replaced by "Login".
- **Logged in:** save upload enabled; on parse, the inventory is stored in `save`. Two extra tabs appear: **Saves** and **Builds**. Custom gems persist to `gem`.

Decisions locked: **save = parsed inventory as jsonb**; **Terraform creates the project**; **shared builds are read-only snapshots**.

## Data model

All tables live in `public`, key off `auth.users(id)`, and have owner-only RLS unless noted. `created_at`/`updated_at` default `now()`.

### `save`

| column          | type        | notes                                                        |
| --------------- | ----------- | ------------------------------------------------------------ |
| id              | uuid pk     | `gen_random_uuid()`                                          |
| user_id         | uuid        | `references auth.users on delete cascade`                    |
| character_name  | text        | from `Inventory.character.name`                              |
| character_level | int         | for the Saves row                                            |
| playtime_ms     | bigint      | for the Saves row                                            |
| inventory       | jsonb       | the full parsed `Inventory` (gems/weapons/armor/items/runes) |
| created_at      | timestamptz |                                                              |

Saves tab lists rows (name/level/playtime); clicking loads `inventory` and returns to Weapons. Deletable.

### `build`

| column                  | type        | notes                                                                         |
| ----------------------- | ----------- | ----------------------------------------------------------------------------- |
| id                      | uuid pk     |                                                                               |
| user_id                 | uuid        | owner                                                                         |
| save_id                 | uuid null   | `references save on delete set null` — null for logged-out/custom-only builds |
| name                    | text        | e.g. "My First Build"                                                         |
| short_link              | text unique | DB-generated, used by `/b/<short_link>`                                       |
| config                  | jsonb       | self-contained snapshot (below)                                               |
| created_at / updated_at | timestamptz |                                                                               |

`config` (versioned, self-contained so a viewer needs nothing else):

```jsonc
{
  "version": 1,
  "editStats":     { "str": n, "skl": n, "blt": n, "arc": n },
  "weaponIds":     ["chikage", ...],
  "levelByWeapon": { "chikage": 10, ... },
  "mode":          "compare" | "loadout",
  "target":        "Total" | "Phys" | ...,
  // Socket embeds the full calc gem + effect strings, so shared builds render
  // and compute AR with no access to the owner's inventory.
  "slotsByWeapon": { "chikage": [Socket|null, Socket|null, Socket|null], ... },
  "excludedGemIds": ["<gem instance id>", ...]  // only meaningful on owner re-load
}
```

### `gem` (custom-gem library)

| column     | type        | notes                                                              |
| ---------- | ----------- | ------------------------------------------------------------------ |
| id         | uuid pk     |                                                                    |
| user_id    | uuid        | owner                                                              |
| name       | text        |                                                                    |
| shape      | text        | one of the GemShape values (Radial/Triangle/Waning/Circle/Droplet) |
| effects    | text[]      | effect-spec strings, re-parsed client-side via `parseGemEffects`   |
| created_at | timestamptz |                                                                    |

Shown in a dedicated section atop the Gems tab; editable/deletable.

### Sharing (public read by link, no table-wide exposure)

- `build` has **no public SELECT policy**.
- `get_shared_build(p_short_link text)` — `SECURITY DEFINER`, locked `search_path`, `GRANT EXECUTE` to `anon, authenticated`. Returns a curated record (`name, config, created_at` — **not** `user_id`/`save_id`). This is the only path to read another user's build.

### Short link

`gen_short_link()` returns ~8 url-safe base62 chars from `gen_random_bytes`; used as the `short_link` default with a `unique` constraint (a `BEFORE INSERT` retry trigger covers the astronomically rare collision).

### RLS summary

- `save`, `gem`, `build`: enable RLS; `select/insert/update/delete` policies `using (user_id = auth.uid())` (insert `with check` too).
- `build` additionally reachable only via `get_shared_build`.

## Infra split

`SUPABASE_ACCESS_TOKEN` (in the user's shell) is read automatically by both the TF provider and the Supabase CLI.

### `infra/terraform/` — project + settings (what TF can manage)

- `supabase_project` (org id + region + `database_password` via `TF_VAR_database_password`).
- `supabase_settings`: auth — `site_url`, `uri_allow_list` (magic-link redirects), enable email/OTP; API settings.
- **Caveat:** the TF provider may not expose the passkey **beta** toggle or every auth knob; whatever TF can't set we apply via the Management API / dashboard and document here. ("Manage in TF whenever possible.")
- No Storage bucket needed (inventory is jsonb).

### `supabase/migrations/*.sql` — schema (TF can't manage tables)

Enums (if used), tables, RLS policies, `gen_short_link()`, `get_shared_build()`. Applied with the Supabase CLI. TS row types generated via `supabase gen types typescript` into the web app.

### Web app

- Add `@supabase/supabase-js`; a singleton client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public, build-time).
- Auth UI (login modal: magic link + passkey), session context, the Save/Builds/Gems persistence wiring, localStorage rehydration, and the `/b/<short_link>` route.

## Env / secrets

- `SUPABASE_ACCESS_TOKEN` — admin, interactive shell only (TF + CLI). Never committed.
- `TF_VAR_database_password` — project DB password at apply time.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — public client config (anon key is safe to ship with RLS on).

## Suggested build sequence (each its own PR)

1. **infra/migrations**: TF project + settings; SQL migrations (tables, RLS, RPC, short-link); generated TS types. No app behavior change.
2. **Auth shell**: Supabase client + session context; Login replaces Import Save when logged out; magic link, then passkey.
3. **Logged-out localStorage**: decouple tabs from a required inventory; rehydrate the current build.
4. **Saves**: gated save upload → `save`; Saves tab (load/delete).
5. **Builds**: Save Build flow, `build` rows, `/b/<short_link>` read-only viewer, Builds tab (rename/delete/share).
6. **Custom gems**: `gem` library section on the Gems tab.

## Open inputs needed

- Supabase **org id** and **region** for `supabase_project`.
- DB password handling (supplied via `TF_VAR_database_password`).
- Email sender for magic links (Supabase default mailer for dev; custom SMTP later?).
