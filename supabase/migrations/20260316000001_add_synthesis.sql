-- Clustered themes from conversation summaries
create table themes (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'movement',
  project_id uuid references projects(id),
  label text not null,
  description text not null,
  category text not null,  -- 'priority' | 'idea' | 'concern' | 'vision'
  keywords text[] not null default '{}',
  conversation_ids uuid[] not null default '{}',
  support_count integer not null default 0,
  status text not null default 'active',  -- 'active' | 'proposal_generated' | 'archived'
  proposal_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Audit log for synthesis runs
create table synthesis_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'movement',
  input_conversation_count integer not null,
  themes_created integer not null default 0,
  themes_updated integer not null default 0,
  ran_at timestamptz default now()
);

-- Indexes
create index idx_themes_scope on themes(scope);
create index idx_themes_status on themes(status);
create index idx_synthesis_runs_scope on synthesis_runs(scope, ran_at desc);
