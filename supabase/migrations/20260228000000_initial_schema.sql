-- Initial schema: proposals and site_state tables
-- These were originally created manually in production.

create table if not exists proposals (
  id text primary key,
  description text not null,
  author text not null default 'anon',
  timestamp bigint not null default (extract(epoch from now()) * 1000)::bigint,
  branch text not null,
  files jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  votes jsonb not null default '[]'::jsonb,
  votes_needed int not null default 3
);

create table if not exists site_state (
  id text primary key default 'main',
  files jsonb not null default '{}'::jsonb
);

-- Seed with a default site_state row
insert into site_state (id, files) values ('main', '{}'::jsonb)
on conflict (id) do nothing;
