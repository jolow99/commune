const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

async function callLLM(
  systemPrompt: string,
  userContent: string,
  temperature: number
): Promise<string> {
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
      temperature,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in LLM response')
  }

  // Strip markdown code fences if present
  let cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  return cleaned
}

function parseJSON<T>(raw: string, requiredFields: string[]): T {
  const parsed = JSON.parse(raw)
  for (const field of requiredFields) {
    if (parsed[field] === undefined) {
      throw new Error(`Invalid LLM response: missing "${field}"`)
    }
  }
  return parsed as T
}

// --- Spec-based functions ---

const EDIT_SPEC_PROMPT = `You edit a high-level markdown site spec based on a user's change request.

You will receive the current spec and a change request. Return ONLY valid JSON:
{
  "description": "short summary of what changed",
  "spec": "the complete updated markdown spec"
}

Rules:
- Return the COMPLETE spec, not just the changed parts.
- The spec uses markdown with sections (## headings) and bullet points describing each section.
- Make changes that honor the spirit of the request.
- This is a landing page for a social movement. Keep that context.
- Keep the spec concise and high-level — it describes WHAT the site shows, not implementation details.`

const RENDER_CODE_PROMPT = `You generate React component files from a site spec.

You will receive a markdown spec describing what the site should look like. Return ONLY valid JSON:
{
  "files": {
    "src/App.tsx": "complete file contents"
  }
}

Rules:
- Generate ALL files needed. Always include src/App.tsx as the entry point.
- You may create files under src/components/ if needed.
- The app uses React 18, Framer Motion, and Tailwind (via CDN). No other libraries.
- Make the site visually polished with smooth animations.
- This is a landing page for a social movement. Keep that context.
- Return complete file contents for every file.`

const REBASE_SPEC_PROMPT = `You reconcile a proposed site spec with a newer version of the main spec.

You will receive three inputs:
1. The CURRENT main spec (latest)
2. The PROPOSED spec (generated against an older version)
3. The original change request

Your job: produce a merged spec that preserves the intent of both the current main changes and the proposal.

Return ONLY valid JSON:
{
  "description": "short summary of the reconciled change",
  "spec": "the complete reconciled markdown spec"
}

Rules:
- Return the COMPLETE spec.
- Preserve all sections from the current main that the proposal didn't intend to change.
- Preserve the intent of the original proposal.
- Keep the spec concise and high-level.`

export async function editSpec(
  currentSpec: string,
  userPrompt: string
): Promise<{ description: string; spec: string }> {
  const raw = await callLLM(
    EDIT_SPEC_PROMPT,
    `Current spec:\n${currentSpec}\n\nChange request: ${userPrompt}`,
    0.7
  )
  return parseJSON(raw, ['description', 'spec'])
}

export async function renderCode(
  spec: string
): Promise<Record<string, string>> {
  const raw = await callLLM(
    RENDER_CODE_PROMPT,
    `Site spec:\n${spec}`,
    0.5
  )
  const parsed = parseJSON<{ files: Record<string, string> }>(raw, ['files'])
  return parsed.files
}

export async function rebaseSpec(
  currentMainSpec: string,
  proposalSpec: string,
  originalPrompt: string
): Promise<{ description: string; spec: string }> {
  const raw = await callLLM(
    REBASE_SPEC_PROMPT,
    `Current main spec:\n${currentMainSpec}\n\nProposed spec:\n${proposalSpec}\n\nOriginal change request: ${originalPrompt}`,
    0.5
  )
  return parseJSON(raw, ['description', 'spec'])
}

// --- Legacy functions (kept for backward compat) ---

const SYSTEM_PROMPT = `You are an agent that edits a React web application based on natural language instructions.

You will receive the current project files as JSON and a change request. Respond with ONLY valid JSON, no markdown:
{
  "description": "short summary of what changed",
  "files": {
    "src/App.tsx": "complete updated file contents"
  }
}

Rules:
- Only include files that changed. Always return complete file contents.
- You may create new files under src/components/ if needed.
- The app uses React 18, Framer Motion, and Tailwind (via CDN). No other libraries.
- Make changes that are visually interesting and honor the spirit of the request.
- This is a landing page for a social movement. Keep that context.`

const REBASE_SYSTEM_PROMPT = `You are an agent that reconciles a proposed React code change with a newer version of the codebase.

You will receive three inputs:
1. The CURRENT site files (the latest main state)
2. A PROPOSED change (code that was generated against an older version)
3. The original change request that produced the proposal

Your job: adapt the proposed change so it applies cleanly to the current files. Preserve the intent of the original proposal while keeping all changes from the current main that the proposal didn't intend to modify.

Respond with ONLY valid JSON, no markdown:
{
  "description": "short summary of the rebased change",
  "files": {
    "src/App.tsx": "complete updated file contents"
  }
}

Rules:
- Only include files that changed relative to the CURRENT files. Always return complete file contents.
- Preserve all existing content in current files that the proposal did not intend to change.
- The app uses React 18, Framer Motion, and Tailwind (via CDN). No other libraries.
- This is a landing page for a social movement. Keep that context.`

export async function generateProposal(
  currentFiles: Record<string, string>,
  userPrompt: string
): Promise<{ description: string; files: Record<string, string> }> {
  const raw = await callLLM(
    SYSTEM_PROMPT,
    `Current files:\n${JSON.stringify(currentFiles, null, 2)}\n\nChange request: ${userPrompt}`,
    0.7
  )
  return parseJSON(raw, ['description', 'files'])
}

export async function rebaseProposal(
  currentMainFiles: Record<string, string>,
  proposalFiles: Record<string, string>,
  originalPrompt: string
): Promise<{ description: string; files: Record<string, string> }> {
  const raw = await callLLM(
    REBASE_SYSTEM_PROMPT,
    `Current main files:\n${JSON.stringify(currentMainFiles, null, 2)}\n\nProposed change files:\n${JSON.stringify(proposalFiles, null, 2)}\n\nOriginal change request: ${originalPrompt}`,
    0.5
  )
  return parseJSON(raw, ['description', 'files'])
}
