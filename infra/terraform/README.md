# bb-calc infrastructure (Terraform)

Provisions the Supabase **project and settings**. The database **schema** (tables,
RLS, functions) is not managed here — Terraform's Supabase provider can't manage
tables — it lives in `supabase/migrations/` and is applied with the Supabase CLI.

See `docs/auth-persistence-design.md` for the full model.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform) ≥ 1.6 and the
  [Supabase CLI](https://supabase.com/docs/guides/cli).
- `SUPABASE_ACCESS_TOKEN` exported in your shell (already in the user's zshrc).
  Both Terraform and the CLI read it automatically.
- The project database password, exported so Terraform picks it up:

  ```sh
  export TF_VAR_bb_calc_supabase_db_password='<choose-a-strong-password>'
  ```

## 1. Create the project + settings (Terraform)

```sh
cd infra/terraform
terraform init
terraform plan      # review: creates one supabase_project + its settings
terraform apply
```

Defaults (override in `terraform.tfvars` if needed): org `eiqkfujprmeiigdukwzb`,
region `us-east-1`, `site_url` `http://localhost:3000`. Commit the generated
`.terraform.lock.hcl`. Note the outputs:

```sh
terraform output project_ref   # e.g. abcd...  (the API subdomain)
terraform output project_url   # https://<ref>.supabase.co
```

## 2. Apply the schema (Supabase CLI)

```sh
cd ../..                                   # repo root
supabase link --project-ref "$(terraform -chdir=infra/terraform output -raw project_ref)"
supabase db push                           # applies supabase/migrations/*.sql
```

## 3. Generate TypeScript row types (for later web slices)

```sh
supabase gen types typescript --linked > apps/web/src/lib/database.types.ts
```

## Notes / caveats

- **Passkeys** are a Supabase **beta** (`signInWithPasskey`, 2026-05-28). The TF
  provider may not expose the enable toggle yet; if `terraform apply` doesn't turn
  it on, enable it in the dashboard (Authentication → Sign In / Providers) or via
  the Management API, and note it here. Magic-link email is configured by TF.
- The **anon/publishable key** isn't a Terraform output. Fetch it for the web app
  with `supabase projects api-keys --project-ref <ref>` or from the dashboard, and
  set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (added in the auth slice).
- Never commit `terraform.tfvars` or the DB password; the password is supplied
  only via `TF_VAR_bb_calc_supabase_db_password`.
