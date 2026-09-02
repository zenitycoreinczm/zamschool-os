-- Public reviews: identity fields + moderation workflow.
--
-- Reviews with comments only appear on the landing page after a super-admin
-- approves them (spam/abuse must never auto-publish on the marketing page).
-- `hidden` lets an admin exclude a rating from the public aggregate entirely.
-- All access stays service-role only (RLS enabled, no permissive policies).

alter table public.site_ratings
  add column if not exists name text,
  add column if not exists school text,
  add column if not exists approved boolean not null default false,
  add column if not exists hidden boolean not null default false;

create index if not exists idx_site_ratings_approved
  on public.site_ratings (approved, hidden, created_at desc)
  where comment is not null;

-- Public aggregate: exclude hidden ratings from average/count.
create or replace function public.get_site_rating_summary()
returns table (count bigint, average numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint, coalesce(avg(rating), 0)::numeric(3, 1)
  from public.site_ratings
  where hidden = false;
$$;

-- Public reviews list: approved, non-hidden, with a comment. Never exposes
-- ip_hash or ids.
create or replace function public.get_site_reviews_public(limit_count int default 12)
returns table (
  rating smallint,
  comment text,
  name text,
  school text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select sr.rating, sr.comment, sr.name, sr.school, sr.created_at
  from public.site_ratings sr
  where sr.approved = true
    and sr.hidden = false
    and sr.comment is not null
  order by sr.created_at desc
  limit greatest(1, least(limit_count, 24));
$$;

revoke execute on function public.get_site_rating_summary() from public, anon, authenticated;
grant execute on function public.get_site_rating_summary() to service_role;
revoke execute on function public.get_site_reviews_public(int) from public, anon, authenticated;
grant execute on function public.get_site_reviews_public(int) to service_role;
