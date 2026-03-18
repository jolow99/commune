import { supabase } from './supabase'
import { readSpec } from './git'
import { editSpec, renderCode } from './agent'
import type { Theme, ConversationSummary } from './types'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

const AUTO_PROPOSE_THRESHOLD = 5
const DEBOUNCE_MINUTES = 5

interface SynthesisItem {
  text: string
  category: 'priority' | 'idea' | 'concern' | 'vision'
  conversationId: string
}

interface ClusterResult {
  existingThemeId?: string
  label: string
  description: string
  keywords: string[]
  conversationIds: string[]
}

async function callSynthesisLLM(systemPrompt: string, userContent: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('No content in LLM response')

  let cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  return cleaned
}

const CLUSTER_SYSTEM_PROMPT = `You group similar items from community interviews into themes.

You will receive:
1. A list of items (each with text, category, and conversation ID)
2. Existing themes (if any) that items might merge into

Return ONLY valid JSON:
{
  "themes": [
    {
      "existing_theme_id": "uuid or null if new",
      "label": "short theme label (3-6 words)",
      "description": "one sentence describing the theme",
      "keywords": ["keyword1", "keyword2"],
      "conversation_ids": ["id1", "id2"]
    }
  ]
}

Rules:
- Group genuinely similar items. Don't force unrelated items together.
- A theme needs 2+ conversations to be created.
- If an item fits an existing theme, merge it (set existing_theme_id).
- Keep labels concise and human-readable.
- Keywords should be useful for search/matching.
- Single items without a match should be omitted (not enough support yet).`

async function clusterItems(
  items: SynthesisItem[],
  category: string,
  existingThemes: Theme[]
): Promise<ClusterResult[]> {
  if (items.length === 0) return []

  const existingForCategory = existingThemes.filter(t => t.category === category)

  const userContent = `Category: ${category}

Items:
${items.map((item, i) => `${i + 1}. [${item.conversationId}] ${item.text}`).join('\n')}

Existing themes for this category:
${existingForCategory.length > 0
    ? existingForCategory.map(t => `- ${t.id}: "${t.label}" (${t.supportCount} supporters, conversations: ${t.conversationIds.join(', ')})`).join('\n')
    : 'None'}`

  const raw = await callSynthesisLLM(CLUSTER_SYSTEM_PROMPT, userContent)
  const parsed = JSON.parse(raw)
  return (parsed.themes || []) as ClusterResult[]
}

const TENSION_SYSTEM_PROMPT = `You identify genuine tensions or contradictions between community themes.

You will receive a list of active themes. Identify pairs that represent real tensions — where pursuing one theme might conflict with another.

Return ONLY valid JSON:
{
  "tensions": [
    {
      "theme_a_id": "uuid",
      "theme_b_id": "uuid",
      "description": "One sentence explaining the tension",
      "severity": "low" | "medium" | "high"
    }
  ]
}

Rules:
- Only surface genuine tensions, not minor differences.
- A theme can appear in multiple tensions.
- Severity: "high" = fundamental disagreement, "medium" = trade-off, "low" = mild friction.
- Return empty array if no real tensions exist.`

export async function detectTensions(themes: Theme[], scope: string): Promise<void> {
  if (themes.length < 2) return

  const userContent = `Active themes:
${themes.map(t => `- ${t.id}: "${t.label}" (${t.category}, ${t.supportCount} supporters): ${t.description}`).join('\n')}`

  const raw = await callSynthesisLLM(TENSION_SYSTEM_PROMPT, userContent)
  const parsed = JSON.parse(raw)
  const tensions = parsed.tensions || []

  // Get existing tensions for this scope
  const { data: existing } = await supabase
    .from('tensions')
    .select('theme_a_id, theme_b_id')
    .eq('scope', scope)
    .eq('status', 'active')

  const existingPairs = new Set(
    (existing || []).map((t: { theme_a_id: string; theme_b_id: string }) =>
      [t.theme_a_id, t.theme_b_id].sort().join(':')
    )
  )

  for (const tension of tensions) {
    const pair = [tension.theme_a_id, tension.theme_b_id].sort().join(':')
    if (existingPairs.has(pair)) continue

    await supabase.from('tensions').insert({
      scope,
      theme_a_id: tension.theme_a_id,
      theme_b_id: tension.theme_b_id,
      description: tension.description,
      severity: tension.severity || 'medium',
    })
  }
}

async function autoPropose(theme: Theme): Promise<void> {
  const prompt = `Community priority (${theme.supportCount} participants): ${theme.description}. Key themes: ${theme.keywords.join(', ')}`

  const currentSpec = await readSpec()
  const { description, spec: updatedSpec } = await editSpec(currentSpec, prompt)
  const files = await renderCode(updatedSpec)

  const { createHash } = await import('crypto')
  const baseSpecHash = createHash('sha256').update(currentSpec).digest('hex').slice(0, 16)

  const { randomUUID } = await import('crypto')
  const id = randomUUID()
  const now = new Date().toISOString()

  await supabase.from('proposals').insert({
    id,
    description,
    user_prompt: prompt,
    author: 'synthesis-engine',
    timestamp: now,
    branch: `proposal/${id}`,
    files,
    base_files_hash: '',
    spec: updatedSpec,
    base_spec_hash: baseSpecHash,
    status: 'pending',
    votes: [],
    votes_needed: 3,
    source_theme_id: theme.id,
    project_id: theme.projectId || '00000000-0000-0000-0000-000000000001',
  })

  // Update theme status
  await supabase.from('themes').update({
    status: 'proposal_generated',
    proposal_id: id,
    updated_at: now,
  }).eq('id', theme.id)

  // Broadcast via PartyKit
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999'
  const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
  await fetch(`${proto}://${host}/parties/main/re-main`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'proposal_ready',
      proposal: {
        id,
        description,
        userPrompt: prompt,
        author: 'synthesis-engine',
        timestamp: now,
        branch: `proposal/${id}`,
        files,
        baseFilesHash: '',
        spec: updatedSpec,
        baseSpecHash,
        status: 'pending',
        votes: [],
        votesNeeded: 3,
        type: 'proposal',
        sourceThemeId: theme.id,
      },
    }),
  }).catch(console.error)
}

export async function synthesizeThemes(scope: string): Promise<void> {
  // Debounce: check last run
  const { data: lastRun } = await supabase
    .from('synthesis_runs')
    .select('ran_at')
    .eq('scope', scope)
    .order('ran_at', { ascending: false })
    .limit(1)
    .single()

  if (lastRun) {
    const lastRanAt = new Date(lastRun.ran_at).getTime()
    if (Date.now() - lastRanAt < DEBOUNCE_MINUTES * 60 * 1000) {
      return // Too soon
    }
  }

  // Fetch all completed conversations for this scope
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, summary')
    .eq('scope', scope)
    .not('summary', 'is', null)

  if (!conversations || conversations.length === 0) return

  // Flatten summaries into items
  const items: SynthesisItem[] = []
  for (const conv of conversations) {
    const summary = conv.summary as ConversationSummary
    if (!summary) continue

    if (summary.vision) {
      items.push({ text: summary.vision, category: 'vision', conversationId: conv.id })
    }
    for (const p of summary.priorities || []) {
      items.push({ text: p, category: 'priority', conversationId: conv.id })
    }
    for (const idea of summary.ideas || []) {
      items.push({ text: idea, category: 'idea', conversationId: conv.id })
    }
    for (const concern of summary.concerns || []) {
      items.push({ text: concern, category: 'concern', conversationId: conv.id })
    }
  }

  if (items.length === 0) return

  // Fetch existing themes
  const { data: existingThemes } = await supabase
    .from('themes')
    .select('*')
    .eq('scope', scope)
    .neq('status', 'archived')

  const themes: Theme[] = (existingThemes || []).map(mapThemeRow)

  // Cluster by category
  const categories = ['priority', 'idea', 'concern', 'vision'] as const
  let themesCreated = 0
  let themesUpdated = 0

  for (const category of categories) {
    const categoryItems = items.filter(i => i.category === category)
    if (categoryItems.length === 0) continue

    const clusters = await clusterItems(categoryItems, category, themes)

    for (const cluster of clusters) {
      if (cluster.existingThemeId) {
        // Merge into existing theme
        const existing = themes.find(t => t.id === cluster.existingThemeId)
        if (!existing) continue

        const mergedConvIds = Array.from(new Set([...existing.conversationIds, ...cluster.conversationIds]))
        await supabase.from('themes').update({
          conversation_ids: mergedConvIds,
          support_count: mergedConvIds.length,
          keywords: Array.from(new Set([...existing.keywords, ...cluster.keywords])),
          updated_at: new Date().toISOString(),
        }).eq('id', cluster.existingThemeId)
        themesUpdated++
      } else if (cluster.conversationIds.length >= 2) {
        // Create new theme
        const { data: newTheme } = await supabase.from('themes').insert({
          scope,
          label: cluster.label,
          description: cluster.description,
          category,
          keywords: cluster.keywords,
          conversation_ids: cluster.conversationIds,
          support_count: cluster.conversationIds.length,
        }).select('*').single()

        if (newTheme) {
          themes.push(mapThemeRow(newTheme))
        }
        themesCreated++
      }
    }
  }

  // Log the run
  await supabase.from('synthesis_runs').insert({
    scope,
    input_conversation_count: conversations.length,
    themes_created: themesCreated,
    themes_updated: themesUpdated,
  })

  // Check for auto-propose threshold
  const activeThemes = themes.filter(t => t.status === 'active' && t.supportCount >= AUTO_PROPOSE_THRESHOLD)
  for (const theme of activeThemes) {
    try {
      await autoPropose(theme)
    } catch (err) {
      console.error(`Auto-propose failed for theme ${theme.id}:`, err)
    }
  }

  // Detect tensions
  const allActiveThemes = themes.filter(t => t.status === 'active')
  if (allActiveThemes.length >= 2) {
    try {
      await detectTensions(allActiveThemes, scope)
    } catch (err) {
      console.error('Tension detection failed:', err)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapThemeRow(row: any): Theme {
  return {
    id: row.id,
    scope: row.scope,
    projectId: row.project_id || undefined,
    label: row.label,
    description: row.description,
    category: row.category,
    keywords: row.keywords || [],
    conversationIds: row.conversation_ids || [],
    supportCount: row.support_count || 0,
    status: row.status,
    proposalId: row.proposal_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
