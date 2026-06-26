output "project_ref" {
  description = "Supabase project reference id (used for CLI linking and as the API subdomain)."
  value       = supabase_project.bb_calc.id
}

output "project_url" {
  description = "Base URL of the project's API/auth endpoints."
  value       = "https://${supabase_project.bb_calc.id}.supabase.co"
}
