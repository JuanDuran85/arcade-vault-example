-- Supabase grants EXECUTE on public functions to anon/authenticated as an
-- explicit per-role default privilege, not via PUBLIC, so the earlier
-- REVOKE ... FROM PUBLIC (20260918000000) does not remove it. Revoke it
-- directly from the two roles the linter flags.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
