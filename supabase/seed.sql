-- =============================================================================
-- Revolution Engine — Demo Seed Data
-- =============================================================================
-- Run: psql "$DATABASE_URL" -f supabase/seed.sql
-- Idempotent: uses ON CONFLICT DO NOTHING throughout
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Conversations (8 completed movement-level interviews, 4 users)
-- ---------------------------------------------------------------------------

INSERT INTO conversations (id, user_id, scope, messages, summary, created_at, updated_at) VALUES

-- Alice — interview 1: mutual aid + accessibility
('11111111-0000-0000-0000-000000000001', 'user-seed-alice', 'movement', '[]'::jsonb,
 '{
   "vision": "A movement rooted in mutual care where everyone has what they need to participate fully.",
   "priorities": ["Build a mutual aid network so members can share resources", "Make every event and resource accessible to disabled community members"],
   "skills": ["Grant writing", "Nonprofit administration", "Community organizing"],
   "ideas": ["Create a mutual aid request/offer board integrated into the website", "Partner with local disability justice orgs for accessibility audits"],
   "concerns": ["We might grow too fast and lose the personal connections that make this special"]
 }'::jsonb,
 now() - interval '3 days', now() - interval '3 days'),

-- Alice — interview 2: storytelling
('11111111-0000-0000-0000-000000000002', 'user-seed-alice', 'movement', '[]'::jsonb,
 '{
   "vision": "Our stories are what hold us together. We need to document and share them.",
   "priorities": ["Collect oral histories from founding members", "Launch a movement zine"],
   "skills": ["Writing", "Editing", "Oral history interviewing"],
   "ideas": ["Monthly zine with member contributions — stories, art, recipes, calls to action", "Storytelling circle events"],
   "concerns": ["People might not feel comfortable sharing personal stories publicly"]
 }'::jsonb,
 now() - interval '2 days', now() - interval '2 days'),

-- Bob — mutual aid + community events
('11111111-0000-0000-0000-000000000003', 'user-seed-bob', 'movement', '[]'::jsonb,
 '{
   "vision": "Neighbors taking care of neighbors — that is the revolution.",
   "priorities": ["Mutual aid infrastructure that actually works day-to-day", "Regular community gatherings to build trust"],
   "skills": ["Web development", "Database design", "Event logistics"],
   "ideas": ["A mutual aid matching system — post what you need, offer what you have", "Monthly potlucks rotating between neighborhoods", "Skill-share workshops"],
   "concerns": ["Tech solutions can feel impersonal if we are not careful"]
 }'::jsonb,
 now() - interval '3 days', now() - interval '3 days'),

-- Bob — growth concerns
('11111111-0000-0000-0000-000000000004', 'user-seed-bob', 'movement', '[]'::jsonb,
 '{
   "vision": "Sustainable growth that does not sacrifice depth for breadth.",
   "priorities": ["Define what sustainable growth looks like for us", "Keep decision-making intimate even as we scale"],
   "skills": ["Facilitation", "Conflict resolution"],
   "ideas": ["Cap chapter sizes and spawn new chapters organically", "Mentorship pairs for new members"],
   "concerns": ["If we grow too fast we will become another hollow nonprofit. We need to scale intimacy, not just membership numbers."]
 }'::jsonb,
 now() - interval '1 day', now() - interval '1 day'),

-- Carol — mutual aid + accessibility + events
('11111111-0000-0000-0000-000000000005', 'user-seed-carol', 'movement', '[]'::jsonb,
 '{
   "vision": "An accessible, joyful movement where showing up is easy for everyone.",
   "priorities": ["Accessibility is not optional — it is foundational", "Mutual aid as daily practice not crisis response", "Community events that actually build relationships"],
   "skills": ["Accessibility consulting", "ASL interpretation", "Event planning"],
   "ideas": ["Mutual aid app with accessibility built in from day one", "Quarterly community festivals with childcare and transport provided", "All digital tools must meet WCAG AA"],
   "concerns": ["We talk about inclusion but our events are still not wheelchair accessible"]
 }'::jsonb,
 now() - interval '2 days', now() - interval '2 days'),

-- Carol — storytelling
('11111111-0000-0000-0000-000000000006', 'user-seed-carol', 'movement', '[]'::jsonb,
 '{
   "vision": "Every member has a story worth telling and worth hearing.",
   "priorities": ["Create platforms for member voices", "Document our collective history"],
   "skills": ["Photography", "Graphic design", "Social media"],
   "ideas": ["Photo essay series featuring member stories", "Movement timeline on the website showing our history"],
   "concerns": ["Who gets to tell whose story? We need consent protocols."]
 }'::jsonb,
 now() - interval '1 day', now() - interval '1 day'),

-- Dana — mutual aid + accessibility
('11111111-0000-0000-0000-000000000007', 'user-seed-dana', 'movement', '[]'::jsonb,
 '{
   "vision": "Technology should serve community, not the other way around.",
   "priorities": ["Build mutual aid tools that work for people without smartphones", "Ensure the website works with screen readers"],
   "skills": ["UX research", "Accessible design", "React development"],
   "ideas": ["SMS-based mutual aid for members without internet", "Mutual aid coordination hub as a standalone project", "Accessibility-first design system for all movement tools"],
   "concerns": ["We are building cool tech but are we reaching the people who need it most?"]
 }'::jsonb,
 now() - interval '2 days', now() - interval '2 days'),

-- Dana — events + growth
('11111111-0000-0000-0000-000000000008', 'user-seed-dana', 'movement', '[]'::jsonb,
 '{
   "vision": "Growth through genuine connection, not marketing.",
   "priorities": ["Community gatherings as the primary recruitment tool", "Sustainable pacing — do not burn people out"],
   "skills": ["Community management", "Workshop facilitation"],
   "ideas": ["Neighborhood welcome dinners for new members", "Buddy system pairing new and experienced members"],
   "concerns": ["More events means more volunteer burnout if we do not have enough organizers"]
 }'::jsonb,
 now() - interval '1 day', now() - interval '1 day')

ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. Themes (5 movement-level themes)
-- ---------------------------------------------------------------------------

INSERT INTO themes (id, scope, label, description, category, keywords, conversation_ids, support_count, status, proposal_id, created_at, updated_at) VALUES

('22222222-0000-0000-0000-000000000001', 'movement',
 'Mutual Aid Network',
 'Build infrastructure for community members to share resources, coordinate requests and offers, and practice mutual aid as a daily habit rather than crisis response.',
 'idea',
 ARRAY['mutual aid', 'resource sharing', 'coordination', 'requests', 'offers'],
 ARRAY['11111111-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000003'::uuid, '11111111-0000-0000-0000-000000000005'::uuid, '11111111-0000-0000-0000-000000000007'::uuid, '11111111-0000-0000-0000-000000000003'::uuid, '11111111-0000-0000-0000-000000000001'::uuid],
 6, 'proposal_generated', '44444444-0000-0000-0000-000000000001',
 now() - interval '12 hours', now() - interval '6 hours'),

('22222222-0000-0000-0000-000000000002', 'movement',
 'Accessibility First',
 'Ensure every tool, event, and resource the movement creates is accessible from day one — not as an afterthought. Includes digital accessibility (WCAG AA), physical accessibility, and economic accessibility.',
 'priority',
 ARRAY['accessibility', 'inclusion', 'WCAG', 'disability justice', 'universal design'],
 ARRAY['11111111-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000005'::uuid, '11111111-0000-0000-0000-000000000007'::uuid, '11111111-0000-0000-0000-000000000005'::uuid],
 4, 'active', NULL,
 now() - interval '12 hours', now() - interval '6 hours'),

('22222222-0000-0000-0000-000000000003', 'movement',
 'Community Gatherings',
 'Regular in-person events — potlucks, skill-shares, festivals, welcome dinners — as the foundation for building trust and growing the movement through genuine connection.',
 'idea',
 ARRAY['events', 'potlucks', 'gatherings', 'community building', 'in-person'],
 ARRAY['11111111-0000-0000-0000-000000000003'::uuid, '11111111-0000-0000-0000-000000000005'::uuid, '11111111-0000-0000-0000-000000000008'::uuid],
 3, 'active', NULL,
 now() - interval '12 hours', now() - interval '6 hours'),

('22222222-0000-0000-0000-000000000004', 'movement',
 'Movement Storytelling',
 'Document and share member stories through zines, photo essays, oral histories, and a movement timeline. Amplify the voices that make this movement what it is.',
 'idea',
 ARRAY['storytelling', 'zine', 'oral history', 'documentation', 'member voices'],
 ARRAY['11111111-0000-0000-0000-000000000002'::uuid, '11111111-0000-0000-0000-000000000006'::uuid],
 2, 'active', NULL,
 now() - interval '12 hours', now() - interval '6 hours'),

('22222222-0000-0000-0000-000000000005', 'movement',
 'Sustainable Growth',
 'Concerns about scaling too fast and losing the intimacy and personal connections that define the movement. Calls for intentional growth strategies like chapter caps, mentorship, and sustainable pacing.',
 'concern',
 ARRAY['growth', 'scaling', 'intimacy', 'burnout', 'sustainability'],
 ARRAY['11111111-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000004'::uuid, '11111111-0000-0000-0000-000000000008'::uuid],
 3, 'active', NULL,
 now() - interval '12 hours', now() - interval '6 hours')

ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 3. Project: Mutual Aid Hub (spawned from theme)
-- ---------------------------------------------------------------------------

INSERT INTO projects (id, name, description, created_by, source_theme_id, status, created_at, updated_at) VALUES
('33333333-0000-0000-0000-000000000001',
 'Mutual Aid Hub',
 'A platform for coordinating mutual aid requests and offers across the community. Born from 6 voices calling for mutual aid infrastructure.',
 'user-seed-alice',
 '22222222-0000-0000-0000-000000000001',
 'active',
 now() - interval '6 hours', now() - interval '6 hours')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 4. Movement-level proposal (document type — project pitch)
-- ---------------------------------------------------------------------------

INSERT INTO proposals (id, description, user_prompt, author, branch, files, status, votes, votes_needed, body, source_theme_id, project_id, timestamp) VALUES
('44444444-0000-0000-0000-000000000001',
 'Community Storytelling Archive',
 'Launch a storytelling archive where members can share oral histories, photo essays, and written reflections about the movement.',
 'user-seed-carol',
 'proposal/storytelling-archive',
 '{}'::jsonb,
 'pending',
 '["user-seed-bob"]'::jsonb,
 3,
 '# Community Storytelling Archive

## Vision
A living archive where every member can contribute their story — oral histories, photo essays, written reflections, art, and more. Our stories are what bind us together and remind us why we started.

## What We Would Build
- **Story submission portal** — simple form for text, audio, images, or video
- **Curated collections** — themed galleries (e.g. "Founding Stories", "Mutual Aid Moments")
- **Monthly zine** — auto-compiled from recent submissions, available as PDF and print
- **Storytelling circles** — recurring events where members share in person, with recordings added to the archive

## Why This Matters
2 interviews specifically called for storytelling infrastructure. Carol and Alice both emphasized that documenting our collective history is essential for cohesion as we grow. Without intentional storytelling, we risk losing the narratives that make this movement unique.

## Open Questions
- How do we handle consent for stories that involve multiple people?
- Should stories be public by default or opt-in?
- Do we need a dedicated editorial team?',
 '22222222-0000-0000-0000-000000000004',
 '00000000-0000-0000-0000-000000000001',
 now() - interval '3 hours')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 5. Project-level proposal (code type — for Mutual Aid Hub)
-- ---------------------------------------------------------------------------

INSERT INTO proposals (id, description, user_prompt, author, branch, files, status, votes, votes_needed, spec, project_id, timestamp) VALUES
('44444444-0000-0000-0000-000000000002',
 'Add a request/offer board with categories and urgency levels',
 'Create a mutual aid board where members can post requests for help and offers of support, with categories like food, housing, transport, skills, and emotional support.',
 'user-seed-bob',
 'proposal/mutual-aid-board',
 '{"src/App.tsx": "import { motion } from ''framer-motion''\n\nconst CATEGORIES = [''Food'', ''Housing'', ''Transport'', ''Skills'', ''Emotional Support'']\n\nexport default function App() {\n  return (\n    <main className=\"min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 text-white px-6 py-12\">\n      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className=\"max-w-4xl mx-auto\">\n        <h1 className=\"text-4xl font-bold mb-8\">Mutual Aid Board</h1>\n        <div className=\"grid grid-cols-2 gap-4 mb-8\">\n          <button className=\"bg-indigo-600 hover:bg-indigo-500 rounded-xl p-4 text-lg font-medium\">I Need Help</button>\n          <button className=\"bg-emerald-600 hover:bg-emerald-500 rounded-xl p-4 text-lg font-medium\">I Can Help</button>\n        </div>\n        <div className=\"flex gap-2 mb-6\">\n          {CATEGORIES.map(c => <span key={c} className=\"px-3 py-1 bg-slate-800 rounded-full text-sm\">{c}</span>)}\n        </div>\n        <p className=\"text-slate-400\">No posts yet. Be the first to share a request or offer.</p>\n      </motion.div>\n    </main>\n  )\n}"}'::jsonb,
 'pending',
 '["user-seed-alice", "user-seed-carol"]'::jsonb,
 3,
 '# Mutual Aid Hub\n\n## Header\nMutual Aid Board title with movement branding.\n\n## Action Buttons\nTwo prominent buttons: "I Need Help" and "I Can Help".\n\n## Categories\nFilter chips: Food, Housing, Transport, Skills, Emotional Support.\n\n## Posts Feed\nList of requests and offers with category tags, urgency indicators, and reply buttons.',
 '33333333-0000-0000-0000-000000000001',
 now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 6. Suggestion on the movement-level proposal
-- ---------------------------------------------------------------------------

INSERT INTO proposal_suggestions (id, proposal_id, author, original_text, suggested_text, status, created_at) VALUES
('88888888-0000-0000-0000-000000000001',
 '44444444-0000-0000-0000-000000000001',
 'user-seed-dana',
 'Should stories be public by default or opt-in?',
 'Stories should be private by default and opt-in to public sharing, with clear consent forms.',
 'pending',
 now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 7. Tension (growth vs. gatherings)
-- ---------------------------------------------------------------------------

INSERT INTO tensions (id, scope, theme_a_id, theme_b_id, description, severity, status, created_at) VALUES
('55555555-0000-0000-0000-000000000001',
 'movement',
 '22222222-0000-0000-0000-000000000005',
 '22222222-0000-0000-0000-000000000003',
 'Growing the movement through more community events may conflict with concerns about maintaining intimacy and not scaling too fast. More gatherings attract new members, but rapid growth risks losing the personal connections that make events meaningful.',
 'medium',
 'active',
 now() - interval '6 hours')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 8. Notification (merge feedback for Carol)
-- ---------------------------------------------------------------------------

INSERT INTO notifications (id, user_id, type, payload, read, created_at) VALUES
('66666666-0000-0000-0000-000000000001',
 'user-seed-carol',
 'merge_feedback',
 '{
   "theme_id": "22222222-0000-0000-0000-000000000001",
   "theme_label": "Mutual Aid Network",
   "proposal_id": "44444444-0000-0000-0000-000000000001",
   "message": "The community merged a change about ''Mutual Aid Network''. Your interview helped shape this proposal. Does it match what you had in mind?"
 }'::jsonb,
 false,
 now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 9. Synthesis Run Log
-- ---------------------------------------------------------------------------

INSERT INTO synthesis_runs (id, scope, input_conversation_count, themes_created, themes_updated, ran_at) VALUES
('77777777-0000-0000-0000-000000000001',
 'movement',
 8, 5, 0,
 now() - interval '12 hours')
ON CONFLICT (id) DO NOTHING;
