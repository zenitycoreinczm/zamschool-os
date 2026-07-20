-- Tenant-scope service-role idempotency storage.

ALTER TABLE IF EXISTS public.idempotency_keys
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_school_id
  ON public.idempotency_keys USING btree (school_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_school_route
  ON public.idempotency_keys USING btree (school_id, route_key, created_at DESC);
