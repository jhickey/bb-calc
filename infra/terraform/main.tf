resource "supabase_project" "bb_calc" {
  organization_id   = var.organization_id
  name              = "bb-calc"
  database_password = var.bb_calc_supabase_db_password
  region            = var.region

  lifecycle {
    # The API never returns the password, so Terraform would otherwise propose a
    # spurious change (and project recreation) on every plan.
    ignore_changes = [database_password]
  }
}

resource "supabase_settings" "bb_calc" {
  project_ref = supabase_project.bb_calc.id

  # Auth: magic link (one-time email) enabled; signups on so first-time links
  # create the user. Passkeys are a Supabase beta and may not be togglable here
  # yet — see README for the Management API fallback.
  auth = jsonencode({
    site_url               = var.site_url
    uri_allow_list         = join(",", var.additional_redirect_urls)
    disable_signup         = false
    external_email_enabled = true
    mailer_otp_exp         = 3600
  })

  api = jsonencode({
    db_schema            = "public,storage,graphql_public"
    db_extra_search_path = "public,extensions"
    max_rows             = 1000
  })
}
