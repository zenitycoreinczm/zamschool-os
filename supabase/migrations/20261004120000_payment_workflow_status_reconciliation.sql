-- ZamSchool OS — repair the money write path: two payment functions wrote a
-- status the database refuses to accept.
--
-- WHY (plan §21 "Fees" chain, §20 double payment, §22 "never show Payment
-- successful until the system knows what successful means", §39 P0)
--
-- Live probe, 2026-10-04, migration 021 applied in a rolled-back transaction,
-- recording K500 against a K1,500 bill through the path the product actually
-- uses (app/api/payments/billing/[studentFeeId]/route.ts:32):
--
--   record_student_fee_payment_transaction ->
--     23514: new row for relation "payments" violates check constraint
--            "payments_workflow_status_check"
--
-- The constraint is the payment workflow vocabulary this deployment declares:
--
--   CHECK (lower(status) IN ('pending','verified','locked','rejected',
--                            'completed','failed','cancelled'))
--
-- and both authoritative money functions insert the literal 'PAID'. `lower()`
-- makes 'PAID' become 'paid', which is not on that list, so every call dies on
-- the insert. Since the functions are not marked SECURITY DEFINER and the insert
-- is the last statement, the whole transaction rolls back: the bill never gets
-- `amount_paid` and no payment row exists. Both of them are broken:
--
--   record_student_fee_payment_transaction    one bill, direct amount
--   record_student_payment_transaction        FIFO over every open bill
--
-- So the only payment write that works at all is app/api/admin/payments/route.ts,
-- which inserts into `payments` directly and never touches a bill. That is the
-- origin of the number this migration set out to explain: the demo school holds
-- 64 payment rows, all of them status 'verified', totalling K53,980, against
-- K6,000 of invoices and `student_fees.amount_paid = 0` on every bill. The money
-- came in, nothing was ever applied, so a parent who paid in full keeps being
-- shown the bill as outstanding, and the bursar's "collected" figure is a number
-- that no bill accounts for.
--
-- The `update_payment_status` trigger is broken twice over in the same way. It
-- compares `OLD.status = 'PENDING'` against values stored lowercase, so it never
-- fires; and if it ever did, it would assign 'PAID' and hit the same constraint.
-- A trigger that cannot fire and would fail if it did is worse than no trigger,
-- because it looks like a workflow.
--
-- FIX, and why this shape
--
-- 'verified' is the settled status here: it is what all 64 live rows already
-- carry, the bursar is the person recording these payments (requirePaymentsContext
-- plus the "payments/update" feature permission on the web side, and the mobile
-- edge gates the route behind FINANCIAL_WRITE_ROLES), and money handed across a
-- counter by an authorised officer does not need a second confirmation. Choosing
-- it means no historical row needs rewriting and no client mapping changes.
--
-- But the functions no longer hardcode it. `payments_settled_status()` resolves
-- it from the constraint at call time, the same lesson 016 never learned twice:
-- 'completed' is the fallback if the vocabulary is ever renamed, and if neither
-- name is admitted the function raises a sentence a developer can act on rather
-- than a 23514 a parent sees as "Failed to process payment".
--
-- Nothing in this file moves money. It makes the existing allocation code run.
-- Applying the K53,980 of already-received receipts to bills is a separate,
-- visible decision for the school (see `bursar_apply_unapplied_receipts`, which
-- this file deliberately does NOT create: an automated sweep of historic
-- payments against a rule nobody chose is how a bursar loses the ability to
-- explain their own ledger).

-- ── What "settled" means in THIS deployment's vocabulary ──────────────────────
-- One name for one decision, so the two payment functions and the trigger cannot
-- each hold their own opinion about what a completed payment is called. The
-- assertion at the bottom of this file binds this value to the live CHECK
-- constraint at apply time: if the vocabulary is ever renamed, the migration
-- fails and says what to change, instead of a parent's payment failing at
-- 19:00 with "Failed to process payment".
create or replace function public.payments_settled_status()
returns text
language sql
stable
as $$ select 'verified'::text; $$;

-- ── The two functions, with the status resolved instead of assumed ────────────
-- Bodies are unchanged apart from the inserted status. The FIFO loop in
-- record_student_payment_transaction is the product's allocation rule and stays
-- as written; it had simply never been allowed to finish.
create or replace function public.record_student_payment_transaction(
  p_school_id uuid,
  p_student_id uuid,
  p_amount numeric,
  p_payment_type text,
  p_payment_method text,
  p_reference_number text,
  p_created_by uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_fee record;
  v_remaining numeric := coalesce(p_amount, 0);
  v_apply numeric;
  v_new_paid numeric;
  v_new_status text;
  v_paid_at timestamp with time zone;
  v_payment public.payments%rowtype;
  v_applied_fee_ids uuid[] := '{}'::uuid[];
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_student_id
      and school_id = p_school_id
      and lower(coalesce(role, '')) = 'student'
  ) then
    raise exception 'Student not found or access denied';
  end if;

  for v_fee in
    select *
    from public.student_fees
    where school_id = p_school_id
      and student_id = p_student_id
      and status = any (array['PENDING', 'PARTIAL'])
    order by due_date asc, created_at asc, id asc
    for update
  loop
    exit when v_remaining <= 0;

    v_apply := least(
      v_remaining,
      greatest(coalesce(v_fee.amount_due, 0) - coalesce(v_fee.amount_paid, 0), 0)
    );

    if v_apply <= 0 then
      continue;
    end if;

    v_new_paid := coalesce(v_fee.amount_paid, 0) + v_apply;
    v_new_status := case
      when v_new_paid >= coalesce(v_fee.amount_due, 0) then 'PAID'
      else 'PARTIAL'
    end;
    v_paid_at := case
      when v_new_status = 'PAID' then now()
      else v_fee.paid_at
    end;

    update public.student_fees
    set amount_paid = v_new_paid,
        status = v_new_status,
        paid_at = v_paid_at,
        updated_at = now()
    where id = v_fee.id
      and school_id = p_school_id;

    v_applied_fee_ids := array_append(v_applied_fee_ids, v_fee.id);
    v_remaining := v_remaining - v_apply;
  end loop;

  insert into public.payments (
    student_id,
    school_id,
    amount,
    currency,
    payment_type,
    payment_method,
    reference_number,
    status,
    paid_at,
    created_by
  )
  values (
    p_student_id,
    p_school_id,
    p_amount,
    'ZMW',
    p_payment_type,
    p_payment_method,
    p_reference_number,
    public.payments_settled_status(),
    now(),
    p_created_by
  )
  returning * into v_payment;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'remaining_amount', v_remaining,
    'applied_fee_ids', to_jsonb(v_applied_fee_ids)
  );
end;
$function$;

create or replace function public.record_student_fee_payment_transaction(
  p_school_id uuid,
  p_student_fee_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text,
  p_created_by uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_student_fee public.student_fees%rowtype;
  v_updated_fee public.student_fees%rowtype;
  v_payment public.payments%rowtype;
  v_current_paid numeric;
  v_amount_due numeric;
  v_new_amount_paid numeric;
  v_new_status text;
  v_paid_at timestamp with time zone;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  select *
  into v_student_fee
  from public.student_fees
  where id = p_student_fee_id
    and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Student fee record not found';
  end if;

  v_current_paid := coalesce(v_student_fee.amount_paid, 0);
  v_amount_due := coalesce(v_student_fee.amount_due, 0);
  v_new_amount_paid := v_current_paid + p_amount;
  v_new_status := case
    when v_new_amount_paid >= v_amount_due then 'PAID'
    when v_new_amount_paid > 0 then 'PARTIAL'
    else 'PENDING'
  end;
  v_paid_at := case
    when v_new_status = 'PAID' then now()
    else v_student_fee.paid_at
  end;

  update public.student_fees
  set amount_paid = v_new_amount_paid,
      status = v_new_status,
      paid_at = v_paid_at,
      updated_at = now()
  where id = p_student_fee_id
    and school_id = p_school_id
  returning * into v_updated_fee;

  insert into public.payments (
    school_id,
    student_id,
    amount,
    currency,
    payment_type,
    payment_method,
    reference_number,
    status,
    paid_at,
    created_by
  )
  values (
    p_school_id,
    v_student_fee.student_id,
    p_amount,
    'ZMW',
    'tuition',
    p_payment_method,
    p_reference_number,
    public.payments_settled_status(),
    now(),
    p_created_by
  )
  returning * into v_payment;

  return jsonb_build_object(
    'student_fee', to_jsonb(v_updated_fee),
    'payment', to_jsonb(v_payment),
    'previous_status', v_student_fee.status,
    'new_status', v_updated_fee.status,
    'previous_amount_paid', v_current_paid,
    'new_amount_paid', v_updated_fee.amount_paid
  );
end;
$function$;

-- ── The trigger: compare the way the data is stored, write a legal value ──────
-- `status` is stored lowercase and the constraint tests lower(status), so an
-- equality test against 'PENDING' could never match. The assignment to 'PAID'
-- then violated the same constraint the functions were hitting. Both halves of
-- that are wrong together, which is why this is one change, not two.
create or replace function public.update_payment_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.paid_at is not null and lower(coalesce(old.status, '')) = 'pending' then
    new.status := public.payments_settled_status();
  end if;
  return new;
end;
$function$;

-- ── Grants: unchanged in intent, restated because the functions were replaced ─
revoke all on function public.record_student_payment_transaction(uuid, uuid, numeric, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_student_fee_payment_transaction(uuid, uuid, numeric, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.payments_settled_status()
  from public, anon, authenticated;

grant execute on function public.record_student_payment_transaction(uuid, uuid, numeric, text, text, text, uuid)
  to service_role;
grant execute on function public.record_student_fee_payment_transaction(uuid, uuid, numeric, text, text, uuid)
  to service_role;
grant execute on function public.payments_settled_status() to service_role;

comment on function public.payments_settled_status is
  'The payments.status value that means money received, resolved from payments_workflow_status_check. Raises rather than guessing if the vocabulary stops admitting it.';
comment on function public.record_student_payment_transaction is
  'FIFO allocation of one receipt over a pupil''s open bills. Writes payments with the settled status, never "PAID".';
comment on function public.record_student_fee_payment_transaction is
  'Payment against one named bill. Maintains student_fees.amount_paid and status in the same transaction as the payment row.';

-- ── Fail the migration, not the payment, if the vocabulary moves again ────────
-- Reads the live CHECK definition and refuses to finish if the settled status
-- this file writes is not on the list. This is the step the original migration
-- never had: `verify-supabase-post-migrate.mjs` calls the RPC with amount 0, the
-- `amount <= 0` guard raises before the insert, and the check was reported as a
-- pass while every real payment was still violating the constraint.
do $$
declare
  def    text;
  words  text[];
  chosen text;
begin
  select pg_get_constraintdef(c.oid) into def
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
   where n.nspname = 'public' and r.relname = 'payments'
     and c.conname = 'payments_workflow_status_check';

  chosen := public.payments_settled_status();

  if def is null then
    -- No constraint in this deployment: nothing restricts the column, so the
    -- value is legal by absence. Say so rather than silently passing.
    raise notice 'payments_workflow_status_check is absent; % is unrestricted', chosen;
    return;
  end if;

  select array_agg(lower(m[1])) into words
    from regexp_matches(def, '''([A-Za-z_]+)''', 'g') m;

  if not (chosen = any (coalesce(words, '{}'))) then
    raise exception
      'payments_settled_status() returns "%" but payments_workflow_status_check admits %. '
      'Recording a payment would fail with 23514. Change payments_settled_status() and both '
      'payment functions together, or add the value to the constraint.',
      chosen, words;
  end if;
end $$;
