# Commune

## What This Is
A multiplayer platform where social movements collaboratively edit a live website through natural language. Users describe changes in plain text, an LLM generates updated React components, and the community votes to merge them. Every change is a git branch. Every vote is a merge.

## Tech Stack
- **Next.js 14** (app router, TypeScript) — main app
- **isomorphic-git** with Node.js fs — server-side git repo at `.commune-repo/`
- **PartyKit** — real-time proposals, votes, presence, merge events (room: `commune-main`)
- **Sandpack** (`@codesandbox/sandpack-react`) — renders live page and proposal previews in-browser
- **Framer Motion** — UI transitions (used in the app shell AND in the sandboxed preview code)
- **OpenRouter** (`z-ai/glm-5`) — LLM agent for generating code changes
- **Supabase** — persistent proposal storage (falls back to in-memory if credentials missing)
- **Tailwind CSS** — styling (Tailwind 3 Play CDN inside Sandpack iframes)

## Architecture

### Flow
1. User types natural language change request in bottom bar
2. `POST /api/propose` reads current spec + files, calls `editSpec()` to update the markdown spec, then `renderCode()` to generate React files from it. Saves both to Supabase.
3. Proposal broadcasts to all clients via PartyKit
4. Users vote; at 3 votes, `POST /api/vote` merges (rebasing the spec if main has diverged)
5. Spec + files merge to main, all Sandpack previews hot-reload with new files
6. Any merged change can be rolled back via `POST /api/rollback` (restores both spec and files)

### Spec Layer
The site's state is defined by a **high-level markdown spec** (stored in `site_state.spec`). User prompts edit the spec via `editSpec()`, then `renderCode()` generates all React files from it. This gives a single human-readable source of truth and makes rebases cleaner (reconcile descriptions, not code).

- `editSpec(currentSpec, userPrompt)` → updated spec + description
- `renderCode(spec)` → complete file set
- `rebaseSpec(mainSpec, proposalSpec, originalPrompt)` → reconciled spec
- Staleness is checked via `baseSpecHash` (SHA256 of spec at proposal creation)
- PreviewModal shows a tabbed view: "Spec Changes" (line diff) and "Preview" (Sandpack)

### Key Files
- `src/lib/git.ts` — storage abstraction (readFiles, readSpec, hashSpec, mergeBranch, revertToFiles, DEFAULT_SPEC)
- `src/lib/agent.ts` — LLM functions: editSpec, renderCode, rebaseSpec (+ legacy generateProposal, rebaseProposal)
- `src/lib/supabase.ts` — Supabase client with in-memory fallback
- `src/lib/types.ts` — shared Proposal, ClientMessage, ServerBroadcast types
- `src/app/api/propose/route.ts` — proposal creation endpoint
- `src/app/api/vote/route.ts` — voting + merge endpoint (spec-aware rebase)
- `src/app/api/rollback/route.ts` — revert endpoint
- `party/index.ts` — PartyKit server (single room, handles vote counting and merge triggers)
- `src/components/LivePage.tsx` — Sandpack preview of current main
- `src/components/ProposalFeed.tsx` — left panel with pending/history proposals
- `src/components/PreviewModal.tsx` — modal preview of a proposal's changes
- `src/app/page.tsx` — main page wiring everything together

### Sandpack Notes
- Sandpack's `react-ts` template expects `/App.tsx` as entry — we copy `src/App.tsx` to `/App.tsx`
- Framer Motion is listed as a Sandpack dependency (`10.16.4`)
- Tailwind is loaded via `externalResources: ['https://cdn.tailwindcss.com']` (must be v3 Play CDN, not v2)
- Sandpack iframe height requires CSS overrides in `globals.css` (`.sp-wrapper`, `.sp-preview-iframe`, etc.)

## Running
```bash
npm run dev:all  # Next.js on :3000, PartyKit on :1999
```

## Environment Variables
See `.env.local` — needs `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_PARTYKIT_HOST`.

## Database Migrations (Supabase CLI)

The project is linked to Supabase via the CLI. Schema changes are managed through SQL migration files:

```bash
# Create a new migration
supabase migration new <name>

# Apply migrations to the remote database
supabase db push
```

Migration files live in `supabase/migrations/`. When making schema changes, create a migration file and run `supabase db push` — no need to use the Supabase dashboard.

## Workflow Rules

- After any significant architectural change, update `README.md` to reflect the new behavior. The README is the primary documentation for contributors and should stay in sync with the codebase.
