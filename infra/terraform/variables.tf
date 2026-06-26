variable "organization_id" {
  type        = string
  description = "Supabase organization id (slug from the dashboard URL)."
  default     = "eiqkfujprmeiigdukwzb"
}

variable "region" {
  type        = string
  description = "Region for the Supabase project."
  default     = "us-east-1"
}

variable "bb_calc_supabase_db_password" {
  type        = string
  description = "Database password for the bb-calc Supabase project. Provide via the TF_VAR_bb_calc_supabase_db_password environment variable; never commit it."
  sensitive   = true
}

variable "site_url" {
  type        = string
  description = "Base URL of the deployed web app; the magic-link redirect base."
  default     = "http://localhost:3000"
}

variable "additional_redirect_urls" {
  type        = list(string)
  description = "Extra URLs allowed as auth redirect targets (magic link)."
  default     = ["http://localhost:3000/**"]
}
