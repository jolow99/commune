-- Projects table
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  created_by text not null,
  source_theme_id uuid,
  status text not null default 'active',
  spec text,
  files jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Scope proposals to projects (default = website project)
alter table proposals add column if not exists project_id uuid
  default '00000000-0000-0000-0000-000000000001';

-- Add source_theme_id to proposals for attribution
alter table proposals add column if not exists source_theme_id uuid;

-- Seed the default project (the current website)
insert into projects (id, name, description, created_by, status)
values ('00000000-0000-0000-0000-000000000001', 'Movement Website',
        'The collaboratively edited landing page', 'system', 'active');

-- Add scope to conversations if not exists (should already exist from interviews migration)
-- Just ensure we have an index
create index if not exists idx_conversations_scope on conversations(scope);
