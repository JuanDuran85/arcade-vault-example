revoke execute on function public.handle_new_user() from public;

-- rls_auto_enable() is Supabase-managed infrastructure (event trigger ensure_rls),
-- not created by any migration in this repo; revoked here only to close the
-- direct-RPC-invocation vector the linter flags.
revoke execute on function public.rls_auto_enable() from public;
