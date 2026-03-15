-- Enable RLS on all tables to fix Supabase security warnings.
-- The app uses the service_role key (bypasses RLS), so this is purely
-- a security-hardening measure against direct anon-key access.

-- Auth tables (better-auth manages these via DATABASE_URL as postgres role)
alter table "user" enable row level security;
alter table "session" enable row level security;
alter table "account" enable row level security;
alter table "verification" enable row level security;

-- App tables
alter table proposals enable row level security;
alter table site_state enable row level security;
alter table conversations enable row level security;

-- Allow service_role full access to all tables
-- (service_role bypasses RLS by default, but explicit policies are good practice)

-- Proposals: publicly readable, service_role writable
create policy "Proposals are publicly readable"
  on proposals for select
  using (true);

create policy "Service role manages proposals"
  on proposals for all
  to service_role
  using (true)
  with check (true);

-- Site state: publicly readable, service_role writable
create policy "Site state is publicly readable"
  on site_state for select
  using (true);

create policy "Service role manages site_state"
  on site_state for all
  to service_role
  using (true)
  with check (true);

-- Conversations: only service_role (server-side API routes)
create policy "Service role manages conversations"
  on conversations for all
  to service_role
  using (true)
  with check (true);

-- Auth tables: only service_role / postgres (better-auth server-side)
create policy "Service role manages users"
  on "user" for all
  to service_role
  using (true)
  with check (true);

create policy "Service role manages sessions"
  on "session" for all
  to service_role
  using (true)
  with check (true);

create policy "Service role manages accounts"
  on "account" for all
  to service_role
  using (true)
  with check (true);

create policy "Service role manages verifications"
  on "verification" for all
  to service_role
  using (true)
  with check (true);
