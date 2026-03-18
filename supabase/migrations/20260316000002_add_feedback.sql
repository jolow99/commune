-- Theme flags (users flagging "that's not what I meant")
create table theme_flags (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references themes(id),
  user_id text not null,
  conversation_id uuid not null,
  reason text,
  created_at timestamptz default now()
);

-- Notifications for re-interview triggers
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  payload jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Tensions between themes
create table tensions (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'movement',
  theme_a_id uuid not null references themes(id),
  theme_b_id uuid not null references themes(id),
  description text not null,
  severity text not null default 'medium',
  status text not null default 'active',
  resolution text,
  created_at timestamptz default now()
);

-- Indexes
create index idx_theme_flags_theme on theme_flags(theme_id);
create index idx_notifications_user on notifications(user_id, read);
create index idx_tensions_scope on tensions(scope, status);
