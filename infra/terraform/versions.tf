terraform {
  required_version = ">= 1.6"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.5"
    }
  }
}

# The provider reads SUPABASE_ACCESS_TOKEN from the environment (set in the
# user's shell), so no token is configured here.
provider "supabase" {}
