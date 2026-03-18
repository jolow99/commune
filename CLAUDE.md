# Revolution Engine

## What This Is
A platform where social movements collaboratively shape their direction through collective intelligence. Users share their voice through AI-guided interviews, the system synthesizes collective themes, and the community votes on auto-generated proposals. Every change is a git branch. Every vote is a merge.

## Tech Stack
- **Next.js 14** (app router, TypeScript) — main app
- **PartyKit** — real-time proposals, votes, presence, merge events (room: `re-main`)
- **Sandpack** (`@codesandbox/sandpack-react`) — renders live page and proposal previews in-browser
- **Framer Motion** — UI transitions (used in the app shell AND in the sandboxed preview code)
- **OpenRouter** (`z-ai/glm-5`) — LLM agent for generating code changes and synthesis
- **Supabase** — persistent storage (proposals, themes, conversations, projects, notifications)
- **better-auth** — Google OAuth authentication
- **Tailwind CSS** — styling (Tailwind 3 Play CDN inside Sandpack iframes)

## Architecture

### Two Modes
- **Movement View (`/`)** — Dashboard showing document-based proposals (left) and projects (right). Proposals are markdown documents (project pitches/RFCs). Merged proposals auto-create projects. Users can suggest edits to proposals.
- **Project View (`/project/[id]`)** — Workspace with project themes + proposals (left) and Sandpack live preview (right).

### Interview → Synthesis → Proposals Pipeline
1. User completes an AI-guided interview (movement or project scoped)
2. Synthesis engine clusters conversation summaries into themes (`POST /api/synthesize` via `waitUntil`)
3. Themes with 5+ voices auto-generate proposals via `autoPropose()`
4. Community votes on proposals (3 votes to merge)
5. After merging synthesis-driven proposals, contributing users get notifications
6. Tensions between themes are surfaced for deliberation

### Movement → Project Hierarchy
- Movement-level interviews produce themes about the movement's direction
- High-support idea themes (10+ voices) can spawn projects
- Project-level interviews produce project-specific themes and proposals
- Each project has its own scope for conversations, themes, and proposals

### Spec Layer
The site's state is defined by a **high-level markdown spec** (stored in `site_state.spec`). User prompts edit the spec via `editSpec()`, then `renderCode()` generates all React files from it.

- `editSpec(currentSpec, userPrompt)` → updated spec + description
- `renderCode(spec)` → complete file set
- `rebaseSpec(mainSpec, proposalSpec, originalPrompt)` → reconciled spec
- Staleness is checked via `baseSpecHash` (SHA256 of spec at proposal creation)

### Key Files
- `src/app/page.tsx` — Movement dashboard (proposals + projects)
- `src/app/project/[id]/page.tsx` — Project workspace (proposals + live preview)
- `src/lib/synthesis.ts` — Theme clustering, auto-proposal, tension detection
- `src/lib/agent.ts` — LLM functions: editSpec, renderCode, rebaseSpec
- `src/lib/git.ts` — Storage abstraction (readFiles, readSpec, hashSpec)
- `src/lib/types.ts` — Shared types (Proposal, Project, Theme, Tension, Conversation, Notification)
- `src/components/ThemeList.tsx` — Theme cards with progress bars, tensions, expand/flag
- `src/components/VoicePanel.tsx` — Slide-out panel for viewing/editing interview summaries
- `src/components/NotificationBell.tsx` — Notification dropdown
- `src/components/ProposalFeed.tsx` — Proposals with community-driven badges
- `src/components/InterviewChat.tsx` — Floating interview chat (scoped)
- `src/components/LivePage.tsx` — Sandpack preview
- `src/components/PreviewModal.tsx` — Proposal preview modal
- `src/app/api/synthesize/route.ts` — Synthesis trigger endpoint
- `src/app/api/themes/route.ts` — Theme listing with tensions
- `src/app/api/themes/[id]/route.ts` — Theme detail and flagging
- `src/app/api/projects/route.ts` — Project CRUD
- `src/app/api/voice/route.ts` — Voice panel (GET summaries, PATCH to edit)
- `src/app/api/notifications/route.ts` — Notification CRUD
- `src/components/ProposalDocumentModal.tsx` — Document proposal modal (markdown body + suggestions)
- `src/app/api/proposals/[id]/suggestions/route.ts` — CRUD for edit suggestions on proposals
- `src/app/api/propose/route.ts` — Proposal creation (with projectId, body for document proposals)
- `src/app/api/vote/route.ts` — Voting + merge (with notification triggers)
- `src/app/api/interview/route.ts` — Interview chat (with scope + synthesis trigger)
- `party/index.ts` — PartyKit server

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
See `.env.local` — needs `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_PARTYKIT_HOST`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`.

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
- **Before finishing any change, run `npm run build` to catch type errors, unused variables, and other issues.** The Vercel build will fail on these. Never leave unused variables, unused imports, type mismatches, or declared-but-unread locals in the code.
