-- Tenant-scope push device tokens used by service-role notification dispatch.

ALTER TABLE IF EXISTS public.user_devices
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_devices_school_id
  ON public.user_devices USING btree (school_id);

CREATE INDEX IF NOT EXISTS idx_user_devices_school_user
  ON public.user_devices USING btree (school_id, user_id);
