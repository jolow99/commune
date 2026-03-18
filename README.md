# Revolution Engine

A platform where social movements collaboratively shape their direction through collective intelligence. Users share their voice through AI-guided interviews, the system synthesizes collective themes, and the community votes on auto-generated proposals. Every change is a git branch. Every vote is a merge.

## Architecture

### Two Modes

**Movement View (`/`)** — The movement-level dashboard. Shows document-based proposals (project pitches/RFCs) on the left and active projects on the right. Users submit proposals as markdown documents; when a proposal passes voting (3 votes), it auto-creates a project. Other users can suggest edits (diff-based) to proposals before they merge.

**Project View (`/project/[id]`)** — The project workspace. Shows project-scoped themes and proposals on the left, with a Sandpack live preview of the project's site on the right. Users can propose changes, vote, and conduct project-scoped interviews.

### Interview → Synthesis → Proposals Pipeline

1. **Interview**: Users share their vision, priorities, skills, ideas, and concerns through an AI-guided conversation (movement-scoped or project-scoped)
2. **Synthesis**: After each completed interview, the synthesis engine clusters similar items from all conversations into themes
3. **Auto-Propose**: When a theme reaches 5+ supporting voices, the system auto-generates a code proposal
4. **Vote**: Community votes on proposals (3 votes to merge). Auto-proposals go through normal voting.
5. **Attribution**: Auto-generated proposals show which voices contributed. Users can flag "that's not what I meant."
6. **Notifications**: After merging a synthesis-driven proposal, contributing users are notified for feedback

### Movement → Project Hierarchy

- Movement-level proposals are text documents (project pitches/RFCs) — no code generation
- When a movement-level proposal merges, it automatically creates a project
- Other community members can suggest edits to proposals (diff-based, like GitHub suggested changes)
- Project-level interviews produce project-specific themes and proposals
- Each project has its own spec, files, themes, and proposals

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

# Auth
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: GitHub audit log
GITHUB_TOKEN=ghp_your-token
GITHUB_REPO=owner/repo
GITHUB_BRANCH=main
```

### Database Migrations

```bash
supabase db push
```

Migration files live in `supabase/migrations/`.

## Development

Run both Next.js and PartyKit:

```bash
npm run dev:all
```

Or separately:

```bash
npm run dev        # Next.js on :3000
npm run dev:party  # PartyKit on :1999
```

## How It Works

### Proposal Flow

1. User types a natural language change request in a project view
2. `POST /api/propose` inserts a skeleton row (`status: 'generating'`) and returns instantly
3. `POST /api/propose/generate` runs asynchronously: `editSpec()` updates the spec, `renderCode()` generates files
4. Proposal appears live to all connected users via PartyKit
5. When 3 users vote to approve, the branch merges to main (with spec rebase if needed)
6. The live page hot-reloads in all browsers via Sandpack

### Synthesis Flow

1. User completes an interview → summary saved to `conversations` table
2. `POST /api/synthesize` triggered via `waitUntil()` — clusters conversation items into themes
3. Themes with 5+ supporting voices auto-generate proposals
4. Tensions between themes are surfaced for deliberation
5. Debounced: synthesis won't re-run within 5 minutes for the same scope

### Spec Layer

The site's state is defined by a **markdown spec** — a human-readable description of what each section looks like. User prompts edit the spec, then a second LLM call renders code from it.

- **Propose**: `editSpec(currentSpec, userPrompt)` → updated spec, then `renderCode(spec)` → files
- **Rebase**: When main has diverged, `rebaseSpec()` reconciles the specs, then `renderCode()` regenerates files
- **Rollback**: Append-only — inserts a new `rollback` entry that restores spec and files from the previous approved proposal

## Key Files

### Pages
- `src/app/page.tsx` — Movement dashboard (proposals + projects)
- `src/app/project/[id]/page.tsx` — Project workspace (proposals + live preview)

### Components
- `src/components/ThemeList.tsx` — Theme cards with progress, tensions, expand/flag
- `src/components/VoicePanel.tsx` — Slide-out panel showing interview summaries with inline editing
- `src/components/NotificationBell.tsx` — Notification dropdown for re-interview triggers
- `src/components/ProposalFeed.tsx` — Pending/history proposals with community-driven badges
- `src/components/InterviewChat.tsx` — Floating interview chat (movement or project scoped)
- `src/components/LivePage.tsx` — Sandpack live preview
- `src/components/PreviewModal.tsx` — Proposal preview modal (spec diff + Sandpack)
- `src/components/ProposalDocumentModal.tsx` — Document proposal modal (markdown body + suggestions)

### Libraries
- `src/lib/synthesis.ts` — Theme clustering, auto-proposal generation, tension detection
- `src/lib/agent.ts` — LLM functions: editSpec, renderCode, rebaseSpec
- `src/lib/git.ts` — Storage abstraction (readFiles, readSpec, hashSpec)
- `src/lib/types.ts` — Shared types (Proposal, Project, Theme, Tension, etc.)

### API Routes
- `POST /api/synthesize` — Run synthesis for a scope
- `GET /api/themes?scope=movement` — List active themes and tensions
- `GET /api/themes/[id]` — Theme detail with contributing conversations
- `POST /api/themes/[id]` — Flag a theme ("not what I meant")
- `GET /api/projects` — List active projects with pending counts
- `POST /api/projects` — Create a project (optionally from a theme)
- `GET /api/voice?userId=X` — Fetch completed interview summaries
- `PATCH /api/voice` — Update a summary (triggers synthesis)
- `GET /api/notifications?userId=X` — Fetch notifications
- `PATCH /api/notifications` — Mark notification as read
- `POST /api/propose` — Create proposal (accepts `projectId`, `body` for document proposals)
- `POST /api/vote` — Vote + merge (auto-creates project for movement-level proposals)
- `GET /api/proposals/[id]/suggestions` — List edit suggestions for a proposal
- `POST /api/proposals/[id]/suggestions` — Submit an edit suggestion
- `PATCH /api/proposals/[id]/suggestions` — Accept/reject a suggestion (author only)
- `GET /api/interview` — Start/resume interview (accepts `scope`)
- `POST /api/interview` — Send interview message (accepts `scope`, triggers synthesis on completion)

## Database Tables

- `projects` — Movement projects (id, name, description, source_theme_id, spec, files)
- `proposals` — Proposals with project_id, source_theme_id, and optional `body` (for document proposals)
- `proposal_suggestions` — Edit suggestions on document proposals (original_text, suggested_text, status)
- `themes` — Clustered themes from conversations (scope, category, support_count, conversation_ids)
- `synthesis_runs` — Audit log for synthesis runs
- `conversations` — Interview history with structured summaries
- `theme_flags` — User flags on themes
- `notifications` — Re-interview triggers and merge feedback
- `tensions` — Contradictions between themes
- `site_state` — Current main files and spec

## Deploy PartyKit

```bash
npx partykit deploy
```

Update `NEXT_PUBLIC_PARTYKIT_HOST` to your deployed PartyKit URL.
