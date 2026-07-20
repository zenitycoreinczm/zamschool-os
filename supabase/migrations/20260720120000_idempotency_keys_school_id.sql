-- Tenant-scope service-role idempotency storage.
-- Keys were previously only unique on (route_key, scope_key, idempotency_key);
-- scope_key often embeds schoolId, but explicit school_id is required for audits
-- and defense-in-depth when service role bypasses RLS.

ALTER TABLE public.idempotency_keys
  ADD COLUMN IF NOT EXISTS school_id uuid;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_school_route
  ON public.idempotency_keys (school_id, route_key, created_at DESC);

COMMENT ON COLUMN public.idempotency_keys.school_id IS
  'Owning school for service-role idempotency rows; always filtered by app code.';
