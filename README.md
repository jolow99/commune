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
  user_prompt text,
  base_files_hash text,
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

## Rebase on Merge

When multiple proposals are created around the same time, they all branch from the same base state. If one merges first, the others become stale — their files reflect an outdated main. Merging them as-is would overwrite the first merge's changes.

To handle this, each proposal stores a `base_files_hash` — a hash of main at the time the proposal was created. When a proposal reaches the vote threshold:

1. The vote endpoint compares `base_files_hash` against the current main hash
2. If they match, the proposal merges as-is (no extra cost)
3. If main has diverged, the LLM is called with three inputs: the current main files, the proposal's generated files, and the original user prompt. It adapts the proposed change to work with the new base, preserving both the existing main state and the intent of the proposal
4. The rebased files replace the proposal's original files, then merge to main

This is lighter than regenerating from scratch — the LLM has the existing proposal code as a starting point and only needs to reconcile the differences.

Previews are marked as approximate in the UI since the final merged result may differ from what was previewed if a rebase occurs. The original user prompt is displayed alongside the LLM-generated description so voters can understand the intent regardless of what the preview shows.

Key files:

- `src/lib/agent.ts` — `rebaseProposal()` function with the reconciliation prompt
- `src/lib/git.ts` — `hashFiles()` for deterministic state comparison
- `src/app/api/vote/route.ts` — staleness detection and rebase trigger

## Deploy PartyKit

```bash
npx partykit deploy
```

Update `NEXT_PUBLIC_PARTYKIT_HOST` to your deployed PartyKit URL.
