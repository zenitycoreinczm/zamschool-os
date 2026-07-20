-- Ensure service-role-only helper tables can be scoped by school_id.
-- These DDL guards are idempotent for environments that already added columns.

ALTER TABLE IF EXISTS public.idempotency_keys
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_school_id
  ON public.idempotency_keys USING btree (school_id);

ALTER TABLE IF EXISTS public.user_devices
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_devices_school_id
  ON public.user_devices USING btree (school_id);

CREATE INDEX IF NOT EXISTS idx_user_devices_school_user
  ON public.user_devices USING btree (school_id, user_id);
