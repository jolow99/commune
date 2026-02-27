# Commune

A multiplayer platform where social movements collaboratively edit a live website through natural language, with real-time voting governance. Every change is a git branch. Every vote is a merge.

## Setup

```bash
npm install
```

### Environment Variables

Create `.env.local` with:

```
OPENROUTER_API_KEY=your-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:1999
```

### Supabase Schema

```sql
create table proposals (
  id uuid primary key,
  description text,
  author text,
  timestamp bigint,
  branch text,
  files jsonb,
  status text default 'pending',
  votes jsonb default '[]',
  votes_needed int default 3,
  created_at timestamptz default now()
);
```

## Development

Run both Next.js and PartyKit:

```bash
npm run dev:all
```

Or separately in two terminals:

```bash
npm run dev        # Next.js on :3000
npm run dev:party  # PartyKit on :1999
```

Open http://localhost:3000 in two browser windows to test multiplayer.

## How It Works

1. User types a natural language change request
2. LLM (via OpenRouter) generates updated React file(s)
3. Changes are committed to a new git branch (isomorphic-git)
4. Proposal appears live to all connected users via PartyKit
5. When 3 users vote to approve, the branch merges to main
6. The live page hot-reloads in all browsers via Sandpack

## Deploy PartyKit

```bash
npx partykit deploy
```

Update `NEXT_PUBLIC_PARTYKIT_HOST` to your deployed PartyKit URL.
