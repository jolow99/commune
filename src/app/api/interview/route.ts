import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

const INTERVIEW_SYSTEM_PROMPT = `You are an interviewer for Revolution Engine, a platform where social movements collaboratively shape their direction through collective intelligence.

Your job is to have a conversation with participants to understand their vision, priorities, skills, ideas, and concerns about the movement.

Conversation style:
- Be warm, genuine, and curious — not corporate or survey-like
- Ask ONE question at a time
- Keep your responses concise (2-3 sentences plus a question)
- Follow interesting threads before moving on
- Remember this is about the MOVEMENT, not about technology

Early in the conversation: Start open-ended. Ask what brought them here, what they care about. Follow their energy.

As it develops: Fill gaps naturally. If they talked about ideas but not skills, ask about skills. If abstract, ask for examples.

After 5+ exchanges: When you feel you have a good understanding of the person's vision, priorities, skills, ideas, and concerns, offer a brief summary and ask if it feels right. If they confirm (or mostly confirm), use the complete_interview tool to save the structured summary.

You can also use complete_interview if the person explicitly says they're done or wants to wrap up.`

const COMPLETE_INTERVIEW_TOOL = {
  type: 'function' as const,
  function: {
    name: 'complete_interview',
    description: 'Call this when the interview has reached a natural conclusion and you have enough information to summarize the participant\'s vision, priorities, skills, ideas, and concerns.',
    parameters: {
      type: 'object',
      properties: {
        vision: {
          type: 'string',
          description: 'Their overall vision for the movement',
        },
        priorities: {
          type: 'array',
          items: { type: 'string' },
          description: 'What matters most to them',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Skills or expertise they can contribute',
        },
        ideas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Concrete ideas or suggestions',
        },
        concerns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Worries or things they want to avoid',
        },
      },
      required: ['vision', 'priorities', 'skills', 'ideas', 'concerns'],
    },
  },
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

async function callInterviewLLM(messages: LLMMessage[]): Promise<{
  content: string
  toolCall?: { name: string; arguments: Record<string, unknown> }
}> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5',
      messages: [
        { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
        ...messages,
      ],
      tools: [COMPLETE_INTERVIEW_TOOL],
      temperature: 0.8,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const choice = data.choices?.[0]

  if (!choice) throw new Error('No choice in LLM response')

  const content = choice.message?.content || ''
  const toolCalls = choice.message?.tool_calls

  if (toolCalls && toolCalls.length > 0) {
    const tc = toolCalls[0]
    const args = typeof tc.function.arguments === 'string'
      ? JSON.parse(tc.function.arguments)
      : tc.function.arguments
    return {
      content: content.trim(),
      toolCall: { name: tc.function.name, arguments: args },
    }
  }

  return { content: content.trim() }
}

// POST: send a message and get a response
export async function POST(req: NextRequest) {
  const { conversationId, message, userId } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  try {
    let messages: Message[] = []
    let id = conversationId
    let locked = false

    if (id) {
      const { data } = await supabase
        .from('conversations')
        .select('messages, summary')
        .eq('id', id)
        .single()

      if (data?.summary) {
        locked = true
      }
      messages = (data?.messages as Message[]) || []
    } else {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, scope: 'movement', messages: [] })
        .select('id')
        .single()

      if (error) throw error
      id = data.id
    }

    if (locked) {
      return NextResponse.json({
        conversationId: id,
        message: 'This conversation has been summarized. You can start a new one anytime!',
        completed: true,
      })
    }

    // Add user message
    messages.push({ role: 'user', content: message })

    // Get LLM response
    const result = await callInterviewLLM(messages)

    const assistantMessage = result.content || 'Thanks for sharing all of that!'
    messages.push({ role: 'assistant', content: assistantMessage })

    // Update database
    const updateData: Record<string, unknown> = {
      messages,
      updated_at: new Date().toISOString(),
    }

    let completed = false
    if (result.toolCall?.name === 'complete_interview') {
      updateData.summary = result.toolCall.arguments
      completed = true
    }

    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', id)

    return NextResponse.json({
      conversationId: id,
      message: assistantMessage,
      completed,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Interview error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET: start or resume a conversation
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  try {
    // Check for recent conversation without a summary (still active)
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, messages, summary')
      .eq('user_id', userId)
      .eq('scope', 'movement')
      .is('summary', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (existing && (existing.messages as Message[]).length > 0) {
      return NextResponse.json({
        conversationId: existing.id,
        messages: existing.messages,
        resumed: true,
      })
    }

    // Generate opening question
    const result = await callInterviewLLM([])
    const opening = result.content
    const messages: Message[] = [{ role: 'assistant', content: opening }]

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, scope: 'movement', messages })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({
      conversationId: data.id,
      messages,
      resumed: false,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Interview start error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
