const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

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
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Current files:\n${JSON.stringify(currentFiles, null, 2)}\n\nChange request: ${userPrompt}`,
        },
      ],
      temperature: 0.7,
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

  const parsed = JSON.parse(cleaned)
  if (!parsed.description || !parsed.files) {
    throw new Error('Invalid agent response format')
  }

  return { description: parsed.description, files: parsed.files }
}

export async function rebaseProposal(
  currentMainFiles: Record<string, string>,
  proposalFiles: Record<string, string>,
  originalPrompt: string
): Promise<{ description: string; files: Record<string, string> }> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5',
      messages: [
        { role: 'system', content: REBASE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Current main files:\n${JSON.stringify(currentMainFiles, null, 2)}\n\nProposed change files:\n${JSON.stringify(proposalFiles, null, 2)}\n\nOriginal change request: ${originalPrompt}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter API error during rebase: ${response.status} ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content in LLM rebase response')
  }

  let cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(cleaned)
  if (!parsed.description || !parsed.files) {
    throw new Error('Invalid agent rebase response format')
  }

  return { description: parsed.description, files: parsed.files }
}
