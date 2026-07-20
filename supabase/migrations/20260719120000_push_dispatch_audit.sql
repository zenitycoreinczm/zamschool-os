-- Audit log for send-push dispatches (Phase 0.1 mobile remediation).
CREATE TABLE IF NOT EXISTS public.push_dispatch_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id text,
  caller_role text,
  school_id text,
  broadcast boolean DEFAULT false,
  recipient_count integer DEFAULT 0,
  notification_type text,
  is_service boolean DEFAULT false,
  title text,
  result text,
  sent integer,
  dead_tokens integer,
  error_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_dispatch_audit_created_at_idx
  ON public.push_dispatch_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS push_dispatch_audit_caller_idx
  ON public.push_dispatch_audit (caller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS push_dispatch_audit_school_idx
  ON public.push_dispatch_audit (school_id, created_at DESC);

ALTER TABLE public.push_dispatch_audit ENABLE ROW LEVEL SECURITY;

-- No client access; service role / edge functions write only.
DROP POLICY IF EXISTS push_dispatch_audit_no_client ON public.push_dispatch_audit;
CREATE POLICY push_dispatch_audit_no_client
  ON public.push_dispatch_audit
  FOR ALL
  USING (false)
  WITH CHECK (false);
