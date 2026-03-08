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

# Optional: GitHub audit log
GITHUB_TOKEN=ghp_your-token
GITHUB_REPO=owner/repo
GITHUB_BRANCH=main
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
  spec text,
  base_spec_hash text,
  type text not null default 'proposal',
  reverts_id text,
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
2. `POST /api/propose` inserts a skeleton row (`status: 'generating'`) and returns instantly — the UI shows a spinner card
3. `POST /api/propose/generate` runs asynchronously: `editSpec()` updates the spec, `renderCode()` generates files, then updates the row to `status: 'pending'` and broadcasts via PartyKit's HTTP API
4. Proposal (with spec + files) appears live to all connected users via PartyKit
5. When 3 users vote to approve, the branch merges to main
6. The live page hot-reloads in all browsers via Sandpack

This two-phase flow means the browser is never blocked during LLM generation, and proposals survive browser close (they persist in Supabase). Stuck proposals (generating for >2 minutes) are automatically cleaned up by `/api/state`.

## Spec Layer

The site's state is defined by a **markdown spec** — a human-readable description of what each section of the site looks like. User prompts edit the spec, then a second LLM call renders code from it. This gives a single source of truth and makes conflict resolution cleaner.

- **Propose**: `editSpec(currentSpec, userPrompt)` → updated spec, then `renderCode(spec)` → files
- **Rebase**: When main has diverged, `rebaseSpec()` reconciles the specs, then `renderCode()` regenerates files
- **Rollback**: Append-only — inserts a new `rollback` entry that restores spec and files from the previous approved proposal. The original proposal stays unchanged. Rollbacks can themselves be rolled back.

Each proposal stores a `base_spec_hash` for staleness detection. The PreviewModal shows a tabbed view with "Spec Changes" (line diff) and "Preview" (Sandpack visual).

## Rebase on Merge

When multiple proposals are created around the same time, they branch from the same spec. If one merges first, the others become stale. The vote endpoint detects this via `base_spec_hash` and calls `rebaseSpec()` to reconcile the proposed spec with the current main spec, then `renderCode()` to regenerate files.

Previews are marked as approximate since the final merged result may differ if a rebase occurs.

Key files:

- `src/lib/agent.ts` — `editSpec()`, `renderCode()`, `rebaseSpec()`
- `src/lib/git.ts` — `readSpec()`, `hashSpec()`, `DEFAULT_SPEC`
- `src/app/api/vote/route.ts` — staleness detection and spec-aware rebase

## GitHub Audit Log

When `GITHUB_TOKEN` and `GITHUB_REPO` are set, every merge and rollback is synced as a commit to the configured GitHub repository. This creates an append-only audit trail. The sync is fire-and-forget — failures are logged but never block the merge/rollback.

Files committed include all site files plus `SPEC.md` (the current spec). Commit messages include the proposal ID, user prompt, and voter list.

## API Endpoints

### `GET /api/history`

Browse merged proposals in reverse chronological order.

- `limit` (default 20, max 100) — number of proposals to return
- `cursor` (ISO timestamp) — for pagination, use `nextCursor` from previous response

### `POST /api/diff`

Compare files and spec between two proposals (or current state).

- Body: `{ "from": "<proposal-id>", "to": "current" }` — each can be a proposal ID or `"current"`
- Returns per-file diffs (added/removed/modified) and spec before/after

## Deploy PartyKit

```bash
npx partykit deploy
```

Update `NEXT_PUBLIC_PARTYKIT_HOST` to your deployed PartyKit URL.
