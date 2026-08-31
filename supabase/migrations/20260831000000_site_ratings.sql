-- Site ratings table for public user feedback
-- Not tenant-scoped (public site feature, not school-specific)
--
-- Access model: only the web server (service-role key) reads and writes this
-- table. RLS is enabled with NO permissive policies, so the public anon key
-- cannot read comments/ip_hash or write junk rows directly via PostgREST.

create table if not exists public.site_ratings (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  page text,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

-- Index for rate limiting: find recent submissions by IP hash
create index if not exists idx_site_ratings_ip_hash_created
  on public.site_ratings (ip_hash, created_at desc);

-- Index for aggregate queries (average rating, count)
create index if not exists idx_site_ratings_rating
  on public.site_ratings (rating);

alter table public.site_ratings enable row level security;

-- Remove legacy permissive policies if an earlier revision of this migration
-- was applied: comments may contain PII and must never be readable with the
-- public anon key.
drop policy if exists "Allow anonymous rating inserts" on public.site_ratings;
drop policy if exists "Allow anonymous rating reads" on public.site_ratings;

-- Server-side aggregate so API clients never touch raw rows.
-- security definer: callable only by service_role, bypasses RLS as owner.
create or replace function public.get_site_rating_summary()
returns table (count bigint, average numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint, coalesce(avg(rating), 0)::numeric(3, 1)
  from public.site_ratings;
$$;

revoke execute on function public.get_site_rating_summary() from public, anon, authenticated;
grant execute on function public.get_site_rating_summary() to service_role;
