create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  scope text not null default 'movement',
  messages jsonb not null default '[]',
  summary jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_conversations_user_id on conversations(user_id);
create index idx_conversations_scope on conversations(scope);
